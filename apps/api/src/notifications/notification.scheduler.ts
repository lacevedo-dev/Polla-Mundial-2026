import { Injectable, Logger } from '@nestjs/common';
import { EmailJobPriority, EmailJobType, MatchStatus, NotificationType } from '@prisma/client';
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
import { NotificationsService } from './notifications.service';
import { TwilioService } from './twilio.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);
  private static readonly BACKGROUND_DB_JOB_KEY = 'background-db-job';
  private static readonly RESULT_NOTIFICATION_KEY_PREFIX = 'result-published';

  constructor(
    private readonly prisma: PrismaService,
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
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: USER_STATUS.ACTIVE },
      select: { phone: true, countryCode: true },
    });

    if (!user) {
      return;
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

  private async getLeaguesForMatch(tournamentId: string | null): Promise<Array<{ id: string; members: Array<{ userId: string }> }>> {
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

  async sendMatchReminders(): Promise<SchedulerObservationOutcome> {
    const execution = await tryRunExclusiveBackgroundJob(
      NotificationScheduler.BACKGROUND_DB_JOB_KEY,
      'sendMatchReminders',
      () => this.runSendMatchReminders(),
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

  private async runSendMatchReminders(): Promise<void> {
    try {
      const now = new Date();
      const from = new Date(now.getTime() + 55 * 60 * 1000);
      const to = new Date(now.getTime() + 65 * 60 * 1000);

      const matches = await this.prisma.match.findMany({
        where: {
          status: MatchStatus.SCHEDULED,
          matchDate: { gte: from, lte: to },
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
        const leagues = await this.getLeaguesForMatch(match.tournamentId ?? null);
        const home = match.homeTeam.name;
        const away = match.awayTeam.name;
        const predictedUserIds = new Set(match.predictions.map((prediction) => prediction.userId));

        for (const league of leagues) {
          for (const member of league.members) {
            const userId = member.userId;
            const key = `${match.id}:${userId}`;
            if (notified.has(key)) continue;

            const alreadySent = await this.prisma.notification.findFirst({
              where: {
                userId,
                type: NotificationType.MATCH_REMINDER,
                data: { contains: match.id },
              },
            });
            if (alreadySent) {
              notified.add(key);
              continue;
            }

            const hasPrediction = predictedUserIds.has(userId);
            const title = 'Recordatorio de partido';
            const body = hasPrediction
              ? `Falta 1 hora para ${home} vs ${away}. Tu pronóstico ya está guardado.`
              : `Falta 1 hora para ${home} vs ${away}. Aún puedes enviar tu pronóstico.`;

            await this.notifyUser(
              userId,
              NotificationType.MATCH_REMINDER,
              title,
              body,
              { matchId: match.id, leagueId: league.id },
              `Partido en ~60 min: ${home} vs ${away}`,
            );

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

            notified.add(key);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`sendMatchReminders failed: ${message}`);
    }
  }

  async sendPredictionClosingAlerts(): Promise<SchedulerObservationOutcome> {
    const execution = await tryRunExclusiveBackgroundJob(
      NotificationScheduler.BACKGROUND_DB_JOB_KEY,
      'sendPredictionClosingAlerts',
      () => this.runSendPredictionClosingAlerts(),
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

  private async runSendPredictionClosingAlerts(): Promise<void> {
    try {
      const now = new Date();
      const allLeagues = await this.prisma.league.findMany({
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
        const windowStart = new Date(now.getTime() + closeMinutes * 60 * 1000);
        const windowEnd = new Date(now.getTime() + (closeMinutes + 5) * 60 * 1000);
        const tournamentIds = [...new Set(leagues.flatMap((league) => league.leagueTournaments.map((entry) => entry.tournamentId)))];
        const leaguesWithoutTournament = leagues.filter((league) => league.leagueTournaments.length === 0);

        const whereMatch = tournamentIds.length > 0
          ? {
              status: MatchStatus.SCHEDULED,
              matchDate: { gte: windowStart, lte: windowEnd },
              OR: [
                { tournamentId: { in: tournamentIds } },
                ...(leaguesWithoutTournament.length > 0 ? [{ tournamentId: null as null }] : []),
              ],
            }
          : {
              status: MatchStatus.SCHEDULED,
              matchDate: { gte: windowStart, lte: windowEnd },
            };

        const matches = await this.prisma.match.findMany({
          where: whereMatch,
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
            for (const member of league.members) {
              const userId = member.userId;

              const alreadySent = await this.prisma.notification.findFirst({
                where: {
                  userId,
                  type: NotificationType.PREDICTION_CLOSED,
                  data: { contains: match.id },
                },
              });
              if (alreadySent) continue;

              const hasPrediction = predictedUserIds.has(userId);
              const title = hasPrediction ? 'Predicciones cerrando' : 'Predicciones cierran pronto';
              const body = hasPrediction
                ? `Las predicciones para ${home} vs ${away} cierran en ${closeMinutes} minutos. Tu pronóstico ya está guardado.`
                : `Quedan ${closeMinutes} minutos para ${home} vs ${away}. Envía tu pronóstico ahora.`;

              await this.notifyUser(
                userId,
                NotificationType.PREDICTION_CLOSED,
                title,
                body,
                { matchId: match.id, leagueId: league.id },
                `Cierre en ${closeMinutes} min: ${home} vs ${away}`,
              );

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
          for (const [userId, { points, leagueId }] of byUser) {
            const alreadySent = await this.prisma.notification.findFirst({
              where: {
                userId,
                type: NotificationType.RESULT_PUBLISHED,
                OR: [{ data: { contains: match.id } }, { data: { contains: notificationKey } }],
              },
            });
            if (alreadySent) continue;

            const title = points >= 5 ? 'Acertaste el marcador exacto' : 'Resultado publicado';
            const body = points >= 5
              ? `${home} ${score} ${away}. Acertaste el marcador y ganaste ${points} puntos.`
              : `${home} ${score} ${away}. Ganaste ${points} puntos.`;

            await this.notifyUser(
              userId,
              NotificationType.RESULT_PUBLISHED,
              title,
              body,
              { matchId: match.id, leagueId, points, matchNotificationKey: notificationKey },
              `Partido finalizado: ${home} ${score} ${away} | ${points} pts`,
            );
          }
        } catch (error) {
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
}
