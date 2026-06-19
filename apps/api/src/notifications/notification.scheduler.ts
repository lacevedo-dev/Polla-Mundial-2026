import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AutomationStep, EmailJobPriority, EmailJobType, MatchStatus, NotificationType, WhatsappGroupJobType } from '@prisma/client';
import { AutomationObservabilityService } from '../automation-observability/automation-observability.service';
import { AutomationFeatureFlagsService } from '../automation/config/automation-feature-flags.service';
import { AutomationStepConfigService } from '../automation/config/automation-step-config.service';
import { AutomationDeliveryService } from '../automation/delivery/automation-delivery.service';
import { SchedulerObservationOutcome } from '../common/scheduler-observability.util';
import { EmailQueueService } from '../email/email-queue.service';
import { MatchEmailTemplateService } from '../email/match-email-template.service';
import {
  logExclusiveBackgroundJobSkip,
  tryRunExclusiveBackgroundJob,
} from '../prisma/background-job-lock.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  getClosingAlertMatches,
  getNotificationLeagueMembers,
  MatchAutomationSweepContext,
} from './match-automation-sweep-context';
import { WhatsappGroupService } from '../whatsapp/whatsapp-group.service';

export type { MatchReminderRetrySummary } from '../automation/delivery/automation-delivery.types';

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
    private readonly delivery: AutomationDeliveryService,
    @Optional() @Inject(WhatsappGroupService) private readonly waGroup?: WhatsappGroupService,
    @Optional() private readonly featureFlags?: AutomationFeatureFlagsService,
    @Optional() private readonly stepConfig?: AutomationStepConfigService,
  ) {}

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

  /**
   * Obtiene datos completos de las pollas para un usuario, incluyendo participantes
   */
  private async getLeagueDataForUser(
    leagueIds: string[],
    matchId: string,
  ): Promise<Array<{
    id: string;
    name: string;
    hasPrediction: boolean;
    participants: Array<{ name: string; hasPrediction: boolean }>;
  }>> {
    const leagues = await this.prisma.league.findMany({
      where: { id: { in: leagueIds } },
      select: {
        id: true,
        name: true,
        members: {
          where: { status: 'ACTIVE' },
          select: {
            user: {
              select: {
                id: true,
                name: true,
                predictions: {
                  where: { matchId, leagueId: { in: leagueIds } },
                  select: { leagueId: true },
                },
              },
            },
          },
        },
      },
    });

    return leagues.map((league) => ({
      id: league.id,
      name: league.name,
      hasPrediction: false, // Se establecerá desde el contexto del usuario
      participants: league.members.map((member) => ({
        name: member.user.name ?? 'Usuario',
        hasPrediction: member.user.predictions.some((p) => p.leagueId === league.id),
      })),
    }));
  }

  async sendPredictionClosingAlerts(
    context?: MatchAutomationSweepContext,
  ): Promise<SchedulerObservationOutcome> {
    if (this.featureFlags && (await this.featureFlags.isPreMatchV2Enabled())) {
      return {
        status: 'skipped',
        summary: {
          reason: 'pre_match_v2_active',
          result: 'prediction_closing_delegated_to_escalations',
        },
      };
    }

    if (
      this.stepConfig &&
      !(await this.stepConfig.isStepOperational(AutomationStep.PREDICTION_CLOSING))
    ) {
      return {
        status: 'skipped',
        summary: { reason: 'prediction_closing_step_disabled' },
      };
    }

    await this.runSendPredictionClosingAlerts(context);

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
                predictions: { select: { userId: true, leagueId: true } },
              },
            });

        for (const match of matches) {
          const predictedUserIds = new Set(match.predictions.map((p) => p.userId));
          const home = match.homeTeam.name;
          const away = match.awayTeam.name;
          const relevantLeagues = leagues.filter(
            (league) => league.leagueTournaments.length === 0 || league.leagueTournaments.some((entry) => entry.tournamentId === match.tournamentId),
          );

          // Agrupar usuarios por partido para evitar notificaciones duplicadas
          const userLeaguesMap = new Map<string, Array<{ leagueId: string; hasPrediction: boolean }>>();
          for (const league of relevantLeagues) {
            for (const member of league.members) {
              const userId = member.userId;
              if (!userLeaguesMap.has(userId)) {
                userLeaguesMap.set(userId, []);
              }
              const userPrediction = match.predictions.find(
                (p) => p.userId === userId && p.leagueId === league.id
              );
              userLeaguesMap.get(userId)!.push({
                leagueId: league.id,
                hasPrediction: !!userPrediction,
              });
            }
          }

          // Obtener usuarios únicos y sus contactos
          const allUserIds = [...userLeaguesMap.keys()];
          const [alreadySentAlerts, userContacts] = await Promise.all([
            this.prisma.notification.findMany({
              where: {
                userId: { in: allUserIds },
                type: NotificationType.PREDICTION_CLOSED,
                data: { contains: `"matchId":"${match.id}"` },
              },
              select: { userId: true },
            }),
            this.delivery.fetchActiveUserContacts(allUserIds),
          ]);
          const alreadySentUserIds = new Set(alreadySentAlerts.map((n) => n.userId));

          // Enviar una notificación por usuario (agrupada)
          let totalDelivered = 0;
          let totalPushSent = 0;
          let totalPushFailed = 0;
          let totalPushDevices = 0;
          let totalWhatsappSent = 0;
          let totalEmailQueued = 0;
          let totalAlreadySent = 0;

          for (const [userId, userLeagues] of userLeaguesMap) {
            if (alreadySentUserIds.has(userId)) {
              totalAlreadySent++;
              continue;
            }

            const pollasWithPrediction = userLeagues.filter((ul) => ul.hasPrediction).length;
            const pollasPending = userLeagues.filter((ul) => !ul.hasPrediction).length;
            const totalPollas = userLeagues.length;

            // Construir mensaje optimizado
            const title = pollasPending > 0 ? '⚠️ Predicciones cierran pronto' : '⚠️ Predicciones cerrando';
            let body: string;
            if (totalPollas === 1) {
              body = pollasWithPrediction > 0
                ? `Las predicciones para ${home} vs ${away} cierran en ${closeMinutes} minutos. Tu pronóstico ya está guardado.`
                : `Quedan ${closeMinutes} minutos para ${home} vs ${away}. Envía tu pronóstico ahora.`;
            } else {
              if (pollasPending === 0) {
                body = `Las predicciones para ${home} vs ${away} cierran en ${closeMinutes} minutos. Tienes pronósticos en ${totalPollas} polla${totalPollas > 1 ? 's' : ''}.`;
              } else if (pollasWithPrediction === 0) {
                body = `Quedan ${closeMinutes} minutos para ${home} vs ${away}. Tienes ${totalPollas} polla${totalPollas > 1 ? 's' : ''} pendiente${totalPollas > 1 ? 's' : ''}.`;
              } else {
                body = `Quedan ${closeMinutes} minutos para ${home} vs ${away}. Tienes ${pollasPending} polla${pollasPending > 1 ? 's' : ''} pendiente${pollasPending > 1 ? 's' : ''} de ${totalPollas}.`;
              }
            }

            const delivery = await this.delivery.deliverToUser({
              userId,
              type: NotificationType.PREDICTION_CLOSED,
              title,
              body,
              data: {
                matchId: match.id,
                leagueIds: userLeagues.map((ul) => ul.leagueId),
                totalPollas,
                pollasPending,
                pollasWithPrediction,
              },
              step: AutomationStep.PREDICTION_CLOSING,
              trigger: `Cierre en ${closeMinutes} min: ${home} vs ${away}`,
              userContact: userContacts.get(userId) ?? null,
            });
            totalDelivered++;
            totalPushSent += delivery.pushSent;
            totalPushFailed += delivery.pushFailed;
            totalPushDevices += delivery.pushDevices;
            totalWhatsappSent += delivery.whatsappSent ? 1 : 0;

            // Obtener datos completos de las pollas con participantes
            const leagueData = await this.getLeagueDataForUser(
              userLeagues.map(ul => ul.leagueId),
              match.id,
            );

            // Actualizar hasPrediction para cada polla según el usuario actual
            const leaguesWithUserStatus = leagueData.map((league) => {
              const userLeague = userLeagues.find(ul => ul.leagueId === league.id);
              return {
                ...league,
                hasPrediction: userLeague?.hasPrediction ?? false,
              };
            });

            const emailContent = totalPollas > 1
              ? this.matchEmailTemplates.buildMultiLeaguePredictionClosingEmail({
                  homeTeam: home,
                  awayTeam: away,
                  matchDate: match.matchDate,
                  venue: match.venue ?? undefined,
                  closeMinutes,
                  leagues: leaguesWithUserStatus.map(league => ({
                    leagueName: league.name,
                    leagueId: league.id,
                    hasPrediction: league.hasPrediction,
                    participants: league.participants,
                  })),
                })
              : this.matchEmailTemplates.buildPredictionClosingEmail({
                  homeTeam: home,
                  awayTeam: away,
                  matchDate: match.matchDate,
                  venue: match.venue ?? undefined,
                  closeMinutes,
                  hasPrediction: pollasWithPrediction > 0,
                });

            await this.queueUserEmail(
              userId,
              EmailJobType.PREDICTION_CLOSING,
              EmailJobPriority.HIGH,
              true,
              `prediction-closing:${match.id}:${userId}`,
              emailContent,
              match.id,
              userLeagues[0].leagueId,
            );
            totalEmailQueued++;
          }

          // Registrar observabilidad por liga
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

            try {

              await this.observability.finishRun(runId, {
                status:
                  totalDelivered === 0 && totalAlreadySent > 0
                    ? 'SKIPPED'
                    : totalPushFailed > 0
                      ? 'WARNING'
                      : totalDelivered > 0
                        ? 'SUCCESS'
                        : 'SKIPPED',
                summary: totalDelivered > 0
                  ? `Cierre agrupado procesado para ${league.members.length} miembros`
                  : 'No hubo alertas nuevas de cierre para esta polla.',
                deliveredCount: totalDelivered,
                failedCount: totalPushFailed,
                warningCount: totalPushFailed > 0 ? totalPushFailed : 0,
                details: {
                  matchId: match.id,
                  leagueId: league.id,
                  closeMinutes,
                  channelBreakdown: {
                    pushSent: totalPushSent,
                    pushFailed: totalPushFailed,
                    pushDevices: totalPushDevices,
                    whatsappSentCount: totalWhatsappSent,
                    emailQueued: totalEmailQueued,
                    waGroupEnqueued: await this.enqueueWaGroupNotif(
                      WhatsappGroupJobType.PREDICTION_CLOSED, match.id, league.id, '',
                    ),
                  },
                  alreadySentCount: totalAlreadySent,
                  predictedUsers: predictedUserIds.size,
                  groupedNotifications: true,
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
                  alreadySentCount: totalAlreadySent,
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
      if (
        this.stepConfig &&
        !(await this.stepConfig.isStepOperational(AutomationStep.RESULT_NOTIFICATION))
      ) {
        this.logger.debug('RESULT_NOTIFICATION deshabilitado en Admin — omitiendo');
        return;
      }

      const matches = await this.prisma.match.findMany({
        where: {
          status: MatchStatus.FINISHED,
          resultNotificationSentAt: null,
          // Never notify a match without a real score. Force-closed/stale matches
          // are left scoreless on purpose; sending "- - -" would be misleading.
          homeScore: { not: null },
          awayScore: { not: null },
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
        
        // Agrupar por usuario con todas sus pollas y puntos
        const byUser = new Map<string, { totalPoints: number; pollas: Array<{ leagueId: string; points: number }> }>();

        for (const prediction of match.predictions) {
          const userId = prediction.userId;
          const points = Math.round(prediction.points ?? 0);
          const leagueId = prediction.leagueId ?? '';
          
          if (!byUser.has(userId)) {
            byUser.set(userId, { totalPoints: 0, pollas: [] });
          }
          
          const userData = byUser.get(userId)!;
          userData.totalPoints += points;
          userData.pollas.push({ leagueId, points });
        }

        processedNotificationKeys.add(notificationKey);

        try {
          let deliveredCount = 0;
          let pushSent = 0;
          let pushFailed = 0;
          let pushDevices = 0;
          let whatsappSentCount = 0;
          let alreadySentCount = 0;

          const resultUserIds = [...byUser.keys()];

          // Batch-load already-sent check and contact info — one query each.
          const [alreadySentNotifications, userContacts] = await Promise.all([
            this.prisma.notification.findMany({
              where: {
                userId: { in: resultUserIds },
                type: NotificationType.RESULT_PUBLISHED,
                OR: [{ data: { contains: match.id } }, { data: { contains: notificationKey } }],
              },
              select: { userId: true },
            }),
            this.delivery.fetchActiveUserContacts(resultUserIds),
          ]);
          const alreadySentUserIds = new Set(alreadySentNotifications.map((n) => n.userId));

          for (const [userId, { totalPoints, pollas }] of byUser) {
            if (alreadySentUserIds.has(userId)) {
              alreadySentCount++;
              continue;
            }

            const maxPoints = Math.max(...pollas.map(p => p.points));
            const hasExactScore = maxPoints >= 5;
            const totalPollas = pollas.length;
            
            // Construir mensaje optimizado
            let title: string;
            let body: string;
            
            if (totalPollas === 1) {
              title = hasExactScore ? '🎯 Acertaste el marcador exacto' : '✅ Resultado publicado';
              body = hasExactScore
                ? `${home} ${score} ${away}. Acertaste el marcador y ganaste ${totalPoints} puntos.`
                : `${home} ${score} ${away}. Ganaste ${totalPoints} puntos.`;
            } else {
              title = hasExactScore ? '🎯 Acertaste el marcador exacto' : '✅ Resultado publicado';
              if (hasExactScore) {
                body = `${home} ${score} ${away}. Acertaste en ${pollas.filter(p => p.points >= 5).length} de ${totalPollas} polla${totalPollas > 1 ? 's' : ''}. Total: ${totalPoints} puntos.`;
              } else {
                body = `${home} ${score} ${away}. Ganaste ${totalPoints} puntos en ${totalPollas} polla${totalPollas > 1 ? 's' : ''}.`;
              }
            }

            const delivery = await this.delivery.deliverToUser({
              userId,
              type: NotificationType.RESULT_PUBLISHED,
              title,
              body,
              data: {
                matchId: match.id,
                leagueIds: pollas.map((p) => p.leagueId),
                totalPoints,
                totalPollas,
                hasExactScore,
                matchNotificationKey: notificationKey,
              },
              step: AutomationStep.RESULT_NOTIFICATION,
              trigger: `Partido finalizado: ${home} ${score} ${away} | ${totalPoints} pts`,
              userContact: userContacts.get(userId) ?? null,
            });
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
                waGroupEnqueued: await (async () => {
                  const leagueIds = [...new Set(match.predictions.map((p) => p.leagueId))];
                  let count = 0;
                  for (const leagueId of leagueIds) {
                    const caption = `🏁 *Resultado Final* | ${match.homeTeam.name} ${match.homeScore} – ${match.awayScore} ${match.awayTeam.name}\n\n¡El partido terminó! Los puntos serán calculados y el reporte completo llegará en breve.`;
                    const enqueued = await this.enqueueWaGroupNotif(WhatsappGroupJobType.RESULT_NOTIFICATION, match.id, leagueId, caption);
                    count += enqueued;
                  }
                  return count;
                })(),
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

  /** Best-effort WhatsApp group enqueue — never throws, returns 1 if enqueued, 0 if skipped/failed */
  private async enqueueWaGroupNotif(
    type: WhatsappGroupJobType,
    matchId: string,
    leagueId: string,
    caption: string,
  ): Promise<number> {
    if (!this.waGroup) return 0;
    try {
      const ok = await this.waGroup.enqueueNotification(type, matchId, leagueId, caption);
      return ok ? 1 : 0;
    } catch {
      return 0;
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
        predictions: { select: { userId: true, leagueId: true } },
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

    // Determinar closeMinutes (tomar el primer valor de las ligas, ya que se agrupa por partido)
    const closeMinutes = leagues[0]?.closePredictionMinutes ?? 15;

    // Agrupar usuarios por partido para evitar notificaciones duplicadas
    const userLeaguesMap = new Map<string, Array<{ leagueId: string; hasPrediction: boolean }>>();

    // Construir mapa de usuarios con sus pollas para este partido
    for (const league of leagues) {
      for (const member of league.members) {
        const userId = member.userId;
        if (!userLeaguesMap.has(userId)) {
          userLeaguesMap.set(userId, []);
        }
        const userPrediction = match.predictions.find(
          (p) => p.userId === userId && p.leagueId === league.id
        );
        userLeaguesMap.get(userId)!.push({
          leagueId: league.id,
          hasPrediction: !!userPrediction,
        });
      }
    }

    // Obtener contactos de usuarios
    const allUserIds = [...userLeaguesMap.keys()];
    const userContacts = await this.delivery.fetchActiveUserContacts(allUserIds);

    // Enviar una notificación por usuario (agrupada)
    for (const [userId, userLeagues] of userLeaguesMap) {
      const pollasWithPrediction = userLeagues.filter((ul) => ul.hasPrediction).length;
      const pollasPending = userLeagues.filter((ul) => !ul.hasPrediction).length;
      const totalPollas = userLeagues.length;

      // Construir mensaje optimizado
      const title = pollasPending > 0 ? '⚠️ Predicciones cierran pronto' : '⚠️ Predicciones cerrando';
      let body: string;
      if (totalPollas === 1) {
        body = pollasWithPrediction > 0
          ? `Las predicciones para ${home} vs ${away} cierran en ${closeMinutes} minutos. Tu pronóstico ya está guardado.`
          : `Quedan ${closeMinutes} minutos para ${home} vs ${away}. Envía tu pronóstico ahora.`;
      } else {
        if (pollasPending === 0) {
          body = `Las predicciones para ${home} vs ${away} cierran en ${closeMinutes} minutos. Tienes pronósticos en ${totalPollas} polla${totalPollas > 1 ? 's' : ''}.`;
        } else if (pollasWithPrediction === 0) {
          body = `Quedan ${closeMinutes} minutos para ${home} vs ${away}. Tienes ${totalPollas} polla${totalPollas > 1 ? 's' : ''} pendiente${totalPollas > 1 ? 's' : ''}.`;
        } else {
          body = `Quedan ${closeMinutes} minutos para ${home} vs ${away}. Tienes ${pollasPending} polla${pollasPending > 1 ? 's' : ''} pendiente${pollasPending > 1 ? 's' : ''} de ${totalPollas}.`;
        }
      }

      await this.delivery.deliverToUser({
        userId,
        type: NotificationType.PREDICTION_CLOSED,
        title,
        body,
        data: {
          matchId: match.id,
          leagueIds: userLeagues.map((ul) => ul.leagueId),
          totalPollas,
          pollasPending,
          pollasWithPrediction,
        },
        step: AutomationStep.PREDICTION_CLOSING,
        trigger: `[MANUAL] Cierre en ${closeMinutes} min: ${home} vs ${away}`,
        userContact: userContacts.get(userId) ?? null,
      });

      // Obtener datos completos de las pollas con participantes
      const leagueData = await this.getLeagueDataForUser(
        userLeagues.map(ul => ul.leagueId),
        match.id,
      );

      // Actualizar hasPrediction para cada polla según el usuario actual
      const leaguesWithUserStatus = leagueData.map((league) => {
        const userLeague = userLeagues.find(ul => ul.leagueId === league.id);
        return {
          ...league,
          hasPrediction: userLeague?.hasPrediction ?? false,
        };
      });

      // Enviar email agrupado
      const emailContent = totalPollas > 1
        ? this.matchEmailTemplates.buildMultiLeaguePredictionClosingEmail({
            homeTeam: home,
            awayTeam: away,
            matchDate: match.matchDate,
            venue: match.venue ?? undefined,
            closeMinutes,
            leagues: leaguesWithUserStatus.map(league => ({
              leagueName: league.name,
              leagueId: league.id,
              hasPrediction: league.hasPrediction,
              participants: league.participants,
            })),
          })
        : this.matchEmailTemplates.buildPredictionClosingEmail({
            homeTeam: home,
            awayTeam: away,
            matchDate: match.matchDate,
            venue: match.venue ?? undefined,
            closeMinutes,
            hasPrediction: pollasWithPrediction > 0,
          });

      await this.queueUserEmail(
        userId,
        EmailJobType.PREDICTION_CLOSING,
        EmailJobPriority.HIGH,
        true,
        `prediction-closing:${match.id}:${userId}`,
        emailContent,
        match.id,
        userLeagues[0].leagueId,
      );
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
      await this.delivery.deliverToUser({
        userId,
        type: NotificationType.RESULT_PUBLISHED,
        title,
        body,
        data: { matchId: match.id, leagueId, points },
        step: AutomationStep.RESULT_NOTIFICATION,
        trigger: `[MANUAL] Resultado: ${home} ${score} ${away} | ${points} pts`,
      });
    }
  }
}
