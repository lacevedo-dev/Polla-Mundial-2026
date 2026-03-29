import { Injectable, Logger } from '@nestjs/common';
import { AutomationStep, EmailJobPriority, EmailJobType, MatchStatus, NotificationType } from '@prisma/client';
import { AutomationObservabilityService } from '../automation-observability/automation-observability.service';
import { SchedulerObservationOutcome } from '../common/scheduler-observability.util';
import { EmailQueueService } from '../email/email-queue.service';
import { MatchEmailTemplateService } from '../email/match-email-template.service';
import {
  logExclusiveBackgroundJobSkip,
  tryRunExclusiveBackgroundJob,
} from '../prisma/background-job-lock.util';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { USER_STATUS } from '../users/user-status.constants';
import {
  getClosingAlertMatches,
  getNotificationLeagueMembers,
  getRelevantLeaguesForScheduledMatch,
  getReminderMatches,
  MatchAutomationSweepContext,
} from './match-automation-sweep-context';
import { NotificationsService } from './notifications.service';
import { TwilioService } from './twilio.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);
  private static readonly BACKGROUND_DB_JOB_KEY = 'background-db-job';
  private static readonly RESULT_NOTIFICATION_KEY_PREFIX = 'result-published';

  constructor(
    private readonly prisma: PrismaService,
    private readonly observability: AutomationObservabilityService,
    private readonly emailQueue: EmailQueueService,
    private readonly matchEmailTemplates: MatchEmailTemplateService,
    private readonly push: PushNotificationsService,
    private readonly notificationsService: NotificationsService,
    private readonly twilio: TwilioService,
  ) {}

  private async notifyUser(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, unknown>,
    trigger?: string,
  ): Promise<NotificationDeliveryResult> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: USER_STATUS.ACTIVE },
      select: { phone: true, countryCode: true },
    });

    if (!user) {
      return {
        pushSent: 0,
        pushFailed: 0,
        pushDevices: 0,
        whatsappSent: false,
        skipped: true,
      };
    }

    const pushResult = await this.push.sendToUser(userId, { title, body, data });

    let whatsappSent = false;
    if (this.twilio.isEnabled()) {
      if (user.phone) {
        const fullPhone = `${user.countryCode ?? '+57'}${user.phone}`;
        try {
          await this.twilio.sendWhatsApp(fullPhone, `${title}\n${body}`);
          whatsappSent = true;
        } catch {
          // Ignore WhatsApp failures so push/in-app still succeed.
        }
      }
    }

    const enrichedData: Record<string, unknown> = {
      ...data,
      _trigger: trigger ?? null,
      _pushSent: pushResult.sent,
      _pushFailed: pushResult.failed,
      _pushDevices: pushResult.devices,
      _whatsapp: whatsappSent,
    };

    await this.notificationsService.createInAppNotification({ userId, type, title, body, data: enrichedData });

    this.logger.log(
      `[${type}] ${title} -> user:${userId} | push:${pushResult.sent}/${pushResult.devices} wa:${whatsappSent}${trigger ? ` | trigger:"${trigger}"` : ''}`,
    );

    return {
      pushSent: pushResult.sent,
      pushFailed: pushResult.failed,
      pushDevices: pushResult.devices,
      whatsappSent,
      skipped: false,
    };
  }

  private async queueUserEmail(
    userId: string,
    type: EmailJobType,
    priority: EmailJobPriority,
    required: boolean,
    dedupeKey: string,
    content: { subject: string; html: string; text: string },
    matchId: string,
    leagueId: string,
  ): Promise<void> {
    await this.emailQueue.enqueueForUser(userId, {
      type,
      priority,
      required,
      dedupeKey,
      subject: content.subject,
      html: content.html,
      text: content.text,
      matchId,
      leagueId,
    });
  }

  private async getLeaguesForMatch(
    tournamentId: string | null,
    context?: MatchAutomationSweepContext,
  ): Promise<Array<{ id: string; members: Array<{ userId: string }> }>> {
    if (context) {
      return getRelevantLeaguesForScheduledMatch(context, tournamentId).map(
        (league) => ({
          id: league.id,
          members: getNotificationLeagueMembers(league),
        }),
      );
    }

    const [leaguesWithTournament, leaguesWithoutTournament] = await Promise.all([
      tournamentId
        ? this.prisma.league.findMany({
            where: {
              status: 'ACTIVE',
              leagueTournaments: { some: { tournamentId } },
            },
            select: {
              id: true,
              members: { where: { status: 'ACTIVE' }, select: { userId: true } },
            },
          })
        : [],
      this.prisma.league.findMany({
        where: {
          status: 'ACTIVE',
          leagueTournaments: { none: {} },
        },
        select: {
          id: true,
          members: { where: { status: 'ACTIVE' }, select: { userId: true } },
        },
      }),
    ]);

    const seen = new Set<string>();
    const result: Array<{ id: string; members: Array<{ userId: string }> }> = [];
    for (const league of [...leaguesWithTournament, ...leaguesWithoutTournament]) {
      if (!seen.has(league.id)) {
        seen.add(league.id);
        result.push(league);
      }
    }
    return result;
  }

  async sendMatchReminders(
    context?: MatchAutomationSweepContext,
  ): Promise<SchedulerObservationOutcome> {
    const execution = await tryRunExclusiveBackgroundJob(
      NotificationScheduler.BACKGROUND_DB_JOB_KEY,
      'sendMatchReminders',
      () => this.runSendMatchReminders(context),
    );
    if (!execution.ran) {
      logExclusiveBackgroundJobSkip(
        this.logger,
        'sendMatchReminders',
        execution,
      );
      return {
        status: 'skipped',
        summary: {
          reason: 'background_lock',
          lockHolder: execution.skip.holder,
          heldMs: execution.skip.heldMs,
          skipCount: execution.skip.skipCount,
        },
      };
    }

    return {
      status: 'completed',
      summary: {
        result: 'match_reminders_completed',
      },
    };
  }

  private async runSendMatchReminders(
    context?: MatchAutomationSweepContext,
  ): Promise<void> {
    try {
      const matches = context
        ? getReminderMatches(context)
        : await this.prisma.match.findMany({
            where: {
              status: MatchStatus.SCHEDULED,
              matchDate: {
                gte: new Date(Date.now() + 55 * 60 * 1000),
                lte: new Date(Date.now() + 65 * 60 * 1000),
              },
            },
            select: {
              id: true,
              matchDate: true,
              tournamentId: true,
              venue: true,
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
              predictions: { select: { userId: true } },
            },
          });

      const notified = new Set<string>();

      for (const match of matches) {
        const leagues = await this.getLeaguesForMatch(
          match.tournamentId ?? null,
          context,
        );
        const home = match.homeTeam.name;
        const away = match.awayTeam.name;
        const predictedUserIds = new Set(match.predictions.map((prediction) => prediction.userId));

        for (const league of leagues) {
          const scheduledAt = this.observability.getScheduledAt(
            AutomationStep.MATCH_REMINDER,
            {
              matchDate: match.matchDate,
              closeMinutes: null,
              matchStatus: MatchStatus.SCHEDULED,
            },
          );
          const runId = await this.observability.startRun({
            step: AutomationStep.MATCH_REMINDER,
            matchId: match.id,
            leagueId: league.id,
            scheduledAt,
            audienceCount: league.members.length,
            summary: `Evaluando recordatorio para ${home} vs ${away}`,
          });
          let deliveredCount = 0;
          let pushSent = 0;
          let pushFailed = 0;
          let pushDevices = 0;
          let whatsappSentCount = 0;
          let emailQueued = 0;
          let alreadySentCount = 0;

          try {
            // Pre-load all users who already received a reminder for this match
            // in a SINGLE query before iterating — eliminates per-user N+1 DB hits
            // and prevents the loop caused by unreliable substring JSON search.
            const memberUserIds = league.members.map((m) => m.userId);
            const alreadySentReminders = await this.prisma.notification.findMany({
              where: {
                userId: { in: memberUserIds },
                type: NotificationType.MATCH_REMINDER,
                // Use string_contains on the serialized JSON for matchId key
                data: { contains: `"matchId":"${match.id}"` },
              },
              select: { userId: true },
            });
            const alreadySentUserIds = new Set(alreadySentReminders.map((n) => n.userId));

            for (const member of league.members) {
              const userId = member.userId;
              const key = `${match.id}:${userId}`;
              if (notified.has(key)) continue;

              if (alreadySentUserIds.has(userId)) {
                notified.add(key);
                alreadySentCount++;
                continue;
              }

              const hasPrediction = predictedUserIds.has(userId);
              const title = 'Recordatorio de partido';
              const body = hasPrediction
                ? `Falta 1 hora para ${home} vs ${away}. Tu pronóstico ya está guardado.`
                : `Falta 1 hora para ${home} vs ${away}. Aún puedes enviar tu pronóstico.`;

              const delivery = await this.notifyUser(
                userId,
                NotificationType.MATCH_REMINDER,
                title,
                body,
                { matchId: match.id, leagueId: league.id },
                `Partido en ~60 min: ${home} vs ${away}`,
              );
              deliveredCount++;
              pushSent += delivery.pushSent;
              pushFailed += delivery.pushFailed;
              pushDevices += delivery.pushDevices;
              whatsappSentCount += delivery.whatsappSent ? 1 : 0;

              const emailContent = this.matchEmailTemplates.buildReminderEmail({
                homeTeam: home,
                awayTeam: away,
                matchDate: match.matchDate,
                venue: match.venue ?? undefined,
                hasPrediction,
              });

              await this.queueUserEmail(
                userId,
                EmailJobType.MATCH_REMINDER,
                EmailJobPriority.HIGH,
                true,
                `match-reminder:${match.id}:${userId}`,
                emailContent,
                match.id,
                league.id,
              );
              emailQueued++;

              notified.add(key);
            }

            await this.observability.finishRun(runId, {
              status:
                deliveredCount === 0 && alreadySentCount > 0
                  ? 'SKIPPED'
                  : pushFailed > 0
                    ? 'WARNING'
                    : deliveredCount > 0
                      ? 'SUCCESS'
                      : 'SKIPPED',
              summary: deliveredCount > 0
                ? `Recordatorio procesado para ${league.members.length} miembros`
                : 'No hubo envíos nuevos para este recordatorio.',
              deliveredCount,
              failedCount: pushFailed,
              warningCount: pushFailed > 0 ? pushFailed : 0,
              details: {
                matchId: match.id,
                leagueId: league.id,
                channelBreakdown: {
                  pushSent,
                  pushFailed,
                  pushDevices,
                  whatsappSentCount,
                  emailQueued,
                },
                alreadySentCount,
                predictedUsers: predictedUserIds.size,
              },
            });
          } catch (error) {
            await this.observability.failRun(
              runId,
              error,
              {
                matchId: match.id,
                leagueId: league.id,
                alreadySentCount,
              },
              'Falló el procesamiento del recordatorio automático.',
            );
            throw error;
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`sendMatchReminders failed: ${message}`);
    }
  }

  async sendPredictionClosingAlerts(
    context?: MatchAutomationSweepContext,
  ): Promise<SchedulerObservationOutcome> {
    const execution = await tryRunExclusiveBackgroundJob(
      NotificationScheduler.BACKGROUND_DB_JOB_KEY,
      'sendPredictionClosingAlerts',
      () => this.runSendPredictionClosingAlerts(context),
    );
    if (!execution.ran) {
      logExclusiveBackgroundJobSkip(
        this.logger,
        'sendPredictionClosingAlerts',
        execution,
      );
      return {
        status: 'skipped',
        summary: {
          reason: 'background_lock',
          lockHolder: execution.skip.holder,
          heldMs: execution.skip.heldMs,
          skipCount: execution.skip.skipCount,
        },
      };
    }

    return {
      status: 'completed',
      summary: {
        result: 'prediction_closing_alerts_completed',
      },
    };
  }

  private async runSendPredictionClosingAlerts(
    context?: MatchAutomationSweepContext,
  ): Promise<void> {
    try {
      const now = context?.now ?? new Date();
      const allLeagues = context
        ? context.activeLeagues.map((league) => ({
            id: league.id,
            closePredictionMinutes: league.closePredictionMinutes,
            members: getNotificationLeagueMembers(league),
            leagueTournaments: league.leagueTournaments,
          }))
        : await this.prisma.league.findMany({
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              closePredictionMinutes: true,
              members: { where: { status: 'ACTIVE' }, select: { userId: true } },
              leagueTournaments: { select: { tournamentId: true } },
            },
          });

      const closeGroups = new Map<number, typeof allLeagues>();
      for (const league of allLeagues) {
        const closeMinutes = league.closePredictionMinutes ?? 15;
        if (!closeGroups.has(closeMinutes)) closeGroups.set(closeMinutes, []);
        closeGroups.get(closeMinutes)?.push(league);
      }

      for (const [closeMinutes, leagues] of closeGroups) {
        const tournamentIds = [...new Set(leagues.flatMap((league) => league.leagueTournaments.map((entry) => entry.tournamentId)))];
        const leaguesWithoutTournament = leagues.filter((league) => league.leagueTournaments.length === 0);

        const matches = context
          ? getClosingAlertMatches(context, closeMinutes).filter((match) => {
              if (tournamentIds.length === 0) {
                return true;
              }

              if (leaguesWithoutTournament.length > 0 && match.tournamentId === null) {
                return true;
              }

              return tournamentIds.includes(match.tournamentId ?? '');
            })
          : await this.prisma.match.findMany({
              where: tournamentIds.length > 0
                ? {
                    status: MatchStatus.SCHEDULED,
                    matchDate: {
                      gte: new Date(now.getTime() + closeMinutes * 60 * 1000),
                      lte: new Date(
                        now.getTime() + (closeMinutes + 5) * 60 * 1000,
                      ),
                    },
                    OR: [
                      { tournamentId: { in: tournamentIds } },
                      ...(leaguesWithoutTournament.length > 0
                        ? [{ tournamentId: null as null }]
                        : []),
                    ],
                  }
                : {
                    status: MatchStatus.SCHEDULED,
                    matchDate: {
                      gte: new Date(now.getTime() + closeMinutes * 60 * 1000),
                      lte: new Date(
                        now.getTime() + (closeMinutes + 5) * 60 * 1000,
                      ),
                    },
                  },
              select: {
                id: true,
                matchDate: true,
                tournamentId: true,
                venue: true,
                homeTeam: { select: { name: true } },
                awayTeam: { select: { name: true } },
                predictions: { select: { userId: true } },
              },
            });

        for (const match of matches) {
          const predictedUserIds = new Set(match.predictions.map((prediction) => prediction.userId));
          const home = match.homeTeam.name;
          const away = match.awayTeam.name;
          const relevantLeagues = leagues.filter(
            (league) => league.leagueTournaments.length === 0 || league.leagueTournaments.some((entry) => entry.tournamentId === match.tournamentId),
          );

          for (const league of relevantLeagues) {
            const scheduledAt = this.observability.getScheduledAt(
              AutomationStep.PREDICTION_CLOSING,
              {
                matchDate: match.matchDate,
                closeMinutes,
                matchStatus: MatchStatus.SCHEDULED,
              },
            );
            const runId = await this.observability.startRun({
              step: AutomationStep.PREDICTION_CLOSING,
              matchId: match.id,
              leagueId: league.id,
              scheduledAt,
              audienceCount: league.members.length,
              summary: `Evaluando cierre de predicciones para ${home} vs ${away}`,
            });
            let deliveredCount = 0;
            let pushSent = 0;
            let pushFailed = 0;
            let pushDevices = 0;
            let whatsappSentCount = 0;
            let emailQueued = 0;
            let alreadySentCount = 0;

            try {
              // Pre-load sent users in one query — same pattern as MATCH_REMINDER fix
              const memberUserIds = league.members.map((m) => m.userId);
              const alreadySentReminders = await this.prisma.notification.findMany({
                where: {
                  userId: { in: memberUserIds },
                  type: NotificationType.PREDICTION_CLOSED,
                  data: { contains: `"matchId":"${match.id}"` },
                },
                select: { userId: true },
              });
              const alreadySentUserIds = new Set(alreadySentReminders.map((n) => n.userId));

              for (const member of league.members) {
                const userId = member.userId;

                if (alreadySentUserIds.has(userId)) {
                  alreadySentCount++;
                  continue;
                }

                const hasPrediction = predictedUserIds.has(userId);
                const title = hasPrediction ? 'Predicciones cerrando' : 'Predicciones cierran pronto';
                const body = hasPrediction
                  ? `Las predicciones para ${home} vs ${away} cierran en ${closeMinutes} minutos. Tu pronóstico ya está guardado.`
                  : `Quedan ${closeMinutes} minutos para ${home} vs ${away}. Envía tu pronóstico ahora.`;

                const delivery = await this.notifyUser(
                  userId,
                  NotificationType.PREDICTION_CLOSED,
                  title,
                  body,
                  { matchId: match.id, leagueId: league.id },
                  `Cierre en ${closeMinutes} min: ${home} vs ${away}`,
                );
                deliveredCount++;
                pushSent += delivery.pushSent;
                pushFailed += delivery.pushFailed;
                pushDevices += delivery.pushDevices;
                whatsappSentCount += delivery.whatsappSent ? 1 : 0;

                const emailContent = this.matchEmailTemplates.buildPredictionClosingEmail({
                  homeTeam: home,
                  awayTeam: away,
                  matchDate: match.matchDate,
                  venue: match.venue ?? undefined,
                  closeMinutes,
                  hasPrediction,
                });

                await this.queueUserEmail(
                  userId,
                  EmailJobType.PREDICTION_CLOSING,
                  EmailJobPriority.HIGH,
                  true,
                  `prediction-closing:${match.id}:${userId}`,
                  emailContent,
                  match.id,
                  league.id,
                );
                emailQueued++;
              }

              await this.observability.finishRun(runId, {
                status:
                  deliveredCount === 0 && alreadySentCount > 0
                    ? 'SKIPPED'
                    : pushFailed > 0
                      ? 'WARNING'
                      : deliveredCount > 0
                        ? 'SUCCESS'
                        : 'SKIPPED',
                summary: deliveredCount > 0
                  ? `Cierre procesado para ${league.members.length} miembros`
                  : 'No hubo alertas nuevas de cierre para esta polla.',
                deliveredCount,
                failedCount: pushFailed,
                warningCount: pushFailed > 0 ? pushFailed : 0,
                details: {
                  matchId: match.id,
                  leagueId: league.id,
                  closeMinutes,
                  channelBreakdown: {
                    pushSent,
                    pushFailed,
                    pushDevices,
                    whatsappSentCount,
                    emailQueued,
                  },
                  alreadySentCount,
                  predictedUsers: predictedUserIds.size,
                },
              });
            } catch (error) {
              await this.observability.failRun(
                runId,
                error,
                {
                  matchId: match.id,
                  leagueId: league.id,
                  closeMinutes,
                  alreadySentCount,
                },
                'Falló el procesamiento del cierre automático.',
              );
              throw error;
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`sendPredictionClosingAlerts failed: ${message}`);
    }
  }

  async sendMatchResultNotifications(): Promise<SchedulerObservationOutcome> {
    const execution = await tryRunExclusiveBackgroundJob(
      NotificationScheduler.BACKGROUND_DB_JOB_KEY,
      'sendMatchResultNotifications',
      () => this.runSendMatchResultNotifications(),
    );
    if (!execution.ran) {
      logExclusiveBackgroundJobSkip(
        this.logger,
        'sendMatchResultNotifications',
        execution,
      );
      return {
        status: 'skipped',
        summary: {
          reason: 'background_lock',
          lockHolder: execution.skip.holder,
          heldMs: execution.skip.heldMs,
          skipCount: execution.skip.skipCount,
        },
      };
    }

    return {
      status: 'completed',
      summary: {
        result: 'match_result_notifications_completed',
      },
    };
  }

  private async runSendMatchResultNotifications(): Promise<void> {
    try {
      const matches = await this.prisma.match.findMany({
        where: {
          status: MatchStatus.FINISHED,
          resultNotificationSentAt: null,
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          predictions: {
            select: { userId: true, points: true, leagueId: true },
          },
        },
        take: 20,
      });

      const processedNotificationKeys = new Set<string>();

      for (const match of matches) {
        const scheduledAt = this.observability.getScheduledAt(
          AutomationStep.RESULT_NOTIFICATION,
          {
            matchDate: match.matchDate,
            closeMinutes: null,
            matchStatus: MatchStatus.FINISHED,
          },
        );
        const runId = await this.observability.startRun({
          step: AutomationStep.RESULT_NOTIFICATION,
          matchId: match.id,
          scheduledAt,
          audienceCount: match.predictions.length,
          summary: `Procesando resultado para ${match.homeTeam.name} vs ${match.awayTeam.name}`,
        });
        const notificationKey = this.buildMatchResultNotificationKey(match);
        const claimTimestamp = new Date();

        if (processedNotificationKeys.has(notificationKey)) {
          await this.markResultNotificationsAsSent(match.id, match.externalId ?? null, claimTimestamp);
          this.logger.warn(`Skipping duplicate finished match ${match.id} for RESULT_PUBLISHED (notificationKey=${notificationKey})`);
          continue;
        }

        const claimed = await this.claimResultNotifications(match.id, match.externalId ?? null, claimTimestamp);
        if (!claimed) {
          continue;
        }

        const home = match.homeTeam.name;
        const away = match.awayTeam.name;
        const score = `${match.homeScore ?? '-'}-${match.awayScore ?? '-'}`;
        const byUser = new Map<string, { points: number; leagueId: string | null }>();

        for (const prediction of match.predictions) {
          if (!byUser.has(prediction.userId)) {
            byUser.set(prediction.userId, {
              points: Math.round(prediction.points ?? 0),
              leagueId: prediction.leagueId ?? null,
            });
          }
        }

        processedNotificationKeys.add(notificationKey);

        try {
          let deliveredCount = 0;
          let pushSent = 0;
          let pushFailed = 0;
          let pushDevices = 0;
          let whatsappSentCount = 0;
          let alreadySentCount = 0;

          for (const [userId, { points, leagueId }] of byUser) {
            const alreadySent = await this.prisma.notification.findFirst({
              where: {
                userId,
                type: NotificationType.RESULT_PUBLISHED,
                OR: [{ data: { contains: match.id } }, { data: { contains: notificationKey } }],
              },
            });
            if (alreadySent) {
              alreadySentCount++;
              continue;
            }

            const title = points >= 5 ? 'Acertaste el marcador exacto' : 'Resultado publicado';
            const body = points >= 5
              ? `${home} ${score} ${away}. Acertaste el marcador y ganaste ${points} puntos.`
              : `${home} ${score} ${away}. Ganaste ${points} puntos.`;

            const delivery = await this.notifyUser(
              userId,
              NotificationType.RESULT_PUBLISHED,
              title,
              body,
              { matchId: match.id, leagueId, points, matchNotificationKey: notificationKey },
              `Partido finalizado: ${home} ${score} ${away} | ${points} pts`,
            );
            deliveredCount++;
            pushSent += delivery.pushSent;
            pushFailed += delivery.pushFailed;
            pushDevices += delivery.pushDevices;
            whatsappSentCount += delivery.whatsappSent ? 1 : 0;
          }

          await this.observability.finishRun(runId, {
            status: pushFailed > 0 ? 'WARNING' : deliveredCount > 0 ? 'SUCCESS' : 'SKIPPED',
            summary: deliveredCount > 0
              ? `Resultado notificado a ${deliveredCount} usuario(s)`
              : 'No hubo usuarios nuevos para notificar el resultado.',
            deliveredCount,
            failedCount: pushFailed,
            warningCount: pushFailed > 0 ? pushFailed : 0,
            details: {
              matchId: match.id,
              notificationKey,
              alreadySentCount,
              impactedLeagueCount: new Set(
                match.predictions.map((prediction) => prediction.leagueId),
              ).size,
              channelBreakdown: {
                pushSent,
                pushFailed,
                pushDevices,
                whatsappSentCount,
              },
            },
          });
        } catch (error) {
          await this.observability.failRun(
            runId,
            error,
            {
              matchId: match.id,
              notificationKey,
            },
            'Falló la notificación automática de resultado.',
          );
          await this.releaseResultNotificationClaim(match.id);
          throw error;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`sendMatchResultNotifications failed: ${message}`);
    }
  }

  private buildMatchResultNotificationKey(match: {
    externalId: string | null;
    homeTeamId: string | null;
    awayTeamId: string | null;
    matchDate: Date;
  }): string {
    if (match.externalId?.trim()) {
      return `${NotificationScheduler.RESULT_NOTIFICATION_KEY_PREFIX}:fixture:${match.externalId}`;
    }

    return [
      NotificationScheduler.RESULT_NOTIFICATION_KEY_PREFIX,
      'fallback',
      match.homeTeamId ?? 'no-home',
      match.awayTeamId ?? 'no-away',
      match.matchDate.toISOString(),
    ].join(':');
  }

  private async claimResultNotifications(matchId: string, externalId: string | null, claimedAt: Date): Promise<boolean> {
    const result = await this.prisma.match.updateMany({
      where: externalId?.trim()
        ? {
            resultNotificationSentAt: null,
            OR: [{ id: matchId }, { externalId }],
          }
        : {
            id: matchId,
            resultNotificationSentAt: null,
          },
      data: { resultNotificationSentAt: claimedAt },
    });

    return result.count > 0;
  }

  private async markResultNotificationsAsSent(matchId: string, externalId: string | null, sentAt: Date): Promise<void> {
    await this.prisma.match.updateMany({
      where: externalId?.trim()
        ? {
            resultNotificationSentAt: null,
            OR: [{ id: matchId }, { externalId }],
          }
        : {
            id: matchId,
            resultNotificationSentAt: null,
          },
      data: { resultNotificationSentAt: sentAt },
    });
  }

  private async releaseResultNotificationClaim(matchId: string): Promise<void> {
    await this.prisma.match.update({
      where: { id: matchId },
      data: { resultNotificationSentAt: null },
    });
  }

  // ─── Métodos de reintento manual ─────────────────────────────────────────────

  /** Fuerza el envío del recordatorio de partido para un matchId y leagueId opcionales */
  async retryReminderForMatch(matchId: string, leagueId?: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        matchDate: true,
        tournamentId: true,
        venue: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        predictions: { select: { userId: true } },
      },
    });
    if (!match) return;

    const leagues = leagueId
      ? await this.prisma.league.findMany({
          where: { id: leagueId, status: 'ACTIVE' },
          select: { id: true, members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
        })
      : await this.getLeaguesForMatch(match.tournamentId ?? null);

    const home = match.homeTeam.name;
    const away = match.awayTeam.name;
    const predictedUserIds = new Set(match.predictions.map(p => p.userId));

    for (const league of leagues) {
      for (const member of league.members) {
        const hasPrediction = predictedUserIds.has(member.userId);
        const title = 'Recordatorio de partido';
        const body = hasPrediction
          ? `Falta 1 hora para ${home} vs ${away}. Tu pronóstico ya está guardado.`
          : `Falta 1 hora para ${home} vs ${away}. Aún puedes enviar tu pronóstico.`;
        await this.notifyUser(member.userId, NotificationType.MATCH_REMINDER, title, body, { matchId: match.id, leagueId: league.id }, `[MANUAL] Partido en ~60 min: ${home} vs ${away}`);
      }
    }
  }

  /** Fuerza el envío del cierre de predicciones para un matchId y leagueId opcionales */
  async retryClosingForMatch(matchId: string, leagueId?: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        matchDate: true,
        tournamentId: true,
        venue: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        predictions: { select: { userId: true } },
      },
    });
    if (!match) return;

    const leagues = leagueId
      ? await this.prisma.league.findMany({
          where: { id: leagueId, status: 'ACTIVE' },
          select: { id: true, closePredictionMinutes: true, members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
        })
      : await this.prisma.league.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true, closePredictionMinutes: true, members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
        });

    const home = match.homeTeam.name;
    const away = match.awayTeam.name;
    const predictedUserIds = new Set(match.predictions.map(p => p.userId));

    for (const league of leagues) {
      const closeMinutes = league.closePredictionMinutes ?? 15;
      for (const member of league.members) {
        const hasPrediction = predictedUserIds.has(member.userId);
        const title = hasPrediction ? 'Predicciones cerrando' : 'Predicciones cierran pronto';
        const body = hasPrediction
          ? `Las predicciones para ${home} vs ${away} cierran en ${closeMinutes} minutos. Tu pronóstico ya está guardado.`
          : `Quedan ${closeMinutes} minutos para ${home} vs ${away}. Envía tu pronóstico ahora.`;
        await this.notifyUser(member.userId, NotificationType.PREDICTION_CLOSED, title, body, { matchId: match.id, leagueId: league.id }, `[MANUAL] Cierre en ${closeMinutes} min: ${home} vs ${away}`);
      }
    }
  }

  /** Fuerza el reenvío de la notificación de resultado para un matchId específico */
  async retryResultNotificationForMatch(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        predictions: { select: { userId: true, points: true, leagueId: true } },
      },
    });
    if (!match || match.status !== 'FINISHED') return;

    const home = match.homeTeam.name;
    const away = match.awayTeam.name;
    const score = `${match.homeScore ?? '-'}-${match.awayScore ?? '-'}`;
    const byUser = new Map<string, { points: number; leagueId: string | null }>();
    for (const prediction of match.predictions) {
      if (!byUser.has(prediction.userId)) {
        byUser.set(prediction.userId, { points: Math.round(prediction.points ?? 0), leagueId: prediction.leagueId ?? null });
      }
    }

    for (const [userId, { points, leagueId }] of byUser) {
      const title = points >= 5 ? 'Acertaste el marcador exacto' : 'Resultado publicado';
      const body = points >= 5
        ? `${home} ${score} ${away}. Acertaste el marcador y ganaste ${points} puntos.`
        : `${home} ${score} ${away}. Ganaste ${points} puntos.`;
      await this.notifyUser(userId, NotificationType.RESULT_PUBLISHED, title, body, { matchId: match.id, leagueId, points }, `[MANUAL] Resultado: ${home} ${score} ${away} | ${points} pts`);
    }
  }
}


type NotificationDeliveryResult = {
  pushSent: number;
  pushFailed: number;
  pushDevices: number;
  whatsappSent: boolean;
  skipped: boolean;
};
