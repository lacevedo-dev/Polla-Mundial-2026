import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  AutomationStep,
  MatchStatus,
  NotificationType,
  WhatsappGroupJobType,
} from '@prisma/client';
import { AutomationObservabilityService } from '../../automation-observability/automation-observability.service';
import { SchedulerObservationOutcome } from '../../common/scheduler-observability.util';
import {
  logExclusiveBackgroundJobSkip,
  tryRunExclusiveBackgroundJob,
} from '../../prisma/background-job-lock.util';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationScheduler } from '../../notifications/notification.scheduler';
import { WhatsappGroupService } from '../../whatsapp/whatsapp-group.service';
import { AutomationFeatureFlagsService } from '../config/automation-feature-flags.service';
import { buildMatchResultNotificationKey } from './post-match-dedupe.util';
import {
  buildResultUserMessage,
  buildResultWaCaption,
  summarizeLeagueResults,
} from './post-match-message.builder';

@Injectable()
export class PostMatchOrchestratorService {
  private static readonly BACKGROUND_DB_JOB_KEY = 'background-db-job';
  private readonly logger = new Logger(PostMatchOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: AutomationFeatureFlagsService,
    private readonly observability: AutomationObservabilityService,
    private readonly notificationScheduler: NotificationScheduler,
    @Optional() @Inject(WhatsappGroupService) private readonly waGroup?: WhatsappGroupService,
  ) {}

  async runResultNotifications(): Promise<SchedulerObservationOutcome> {
    if (!(await this.featureFlags.isPostMatchV2Enabled())) {
      return this.notificationScheduler.sendMatchResultNotifications();
    }

    const execution = await tryRunExclusiveBackgroundJob(
      PostMatchOrchestratorService.BACKGROUND_DB_JOB_KEY,
      'sendMatchResultNotifications',
      () => this.processFinishedMatches(),
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
      summary: { result: 'post_match_v2_result_notifications_completed' },
    };
  }

  private async processFinishedMatches(): Promise<void> {
    try {
      const matches = await this.prisma.match.findMany({
        where: {
          status: MatchStatus.FINISHED,
          resultNotificationSentAt: null,
          homeScore: { not: null },
          awayScore: { not: null },
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          predictions: {
            include: {
              user: { select: { id: true, name: true, username: true } },
              league: { select: { id: true, name: true } },
            },
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
          summary: `Resultado v2: ${match.homeTeam.name} vs ${match.awayTeam.name}`,
        });

        const notificationKey = buildMatchResultNotificationKey(match);
        const claimTimestamp = new Date();

        if (processedNotificationKeys.has(notificationKey)) {
          await this.markResultNotificationsAsSent(
            match.id,
            match.externalId ?? null,
            claimTimestamp,
          );
          continue;
        }

        const claimed = await this.claimResultNotifications(
          match.id,
          match.externalId ?? null,
          claimTimestamp,
        );
        if (!claimed) continue;

        const home = match.homeTeam.name;
        const away = match.awayTeam.name;
        const homeScore = match.homeScore!;
        const awayScore = match.awayScore!;

        const byUser = new Map<
          string,
          {
            totalPoints: number;
            pollas: Array<{ leagueId: string; points: number }>;
          }
        >();

        const leagueEntries = new Map<
          string,
          {
            leagueName: string;
            entries: Array<{
              userId: string;
              displayName: string;
              points: number;
              detailType: string;
            }>;
          }
        >();

        for (const prediction of match.predictions) {
          const points = Math.round(prediction.points ?? 0);
          const leagueId = prediction.leagueId;
          const displayName =
            prediction.user.name?.trim() ||
            prediction.user.username?.trim() ||
            'Participante';

          let detailType = 'NONE';
          if (prediction.pointDetail) {
            try {
              const parsed = JSON.parse(prediction.pointDetail) as {
                type?: string;
              };
              detailType = parsed.type ?? 'NONE';
            } catch {
              detailType = points >= 5 ? 'EXACT_SCORE' : 'OTHER';
            }
          }

          if (!byUser.has(prediction.userId)) {
            byUser.set(prediction.userId, { totalPoints: 0, pollas: [] });
          }
          const userData = byUser.get(prediction.userId)!;
          userData.totalPoints += points;
          userData.pollas.push({ leagueId, points });

          let leagueBucket = leagueEntries.get(leagueId);
          if (!leagueBucket) {
            leagueBucket = {
              leagueName: prediction.league.name,
              entries: [],
            };
            leagueEntries.set(leagueId, leagueBucket);
          }
          leagueBucket.entries.push({
            userId: prediction.userId,
            displayName,
            points,
            detailType,
          });
        }

        processedNotificationKeys.add(notificationKey);

        try {
          let deliveredCount = 0;
          let pushSent = 0;
          let pushFailed = 0;
          let waEnqueued = 0;

          const resultUserIds = [...byUser.keys()];
          const [alreadySentNotifications] = await Promise.all([
            this.prisma.notification.findMany({
              where: {
                userId: { in: resultUserIds },
                type: NotificationType.RESULT_PUBLISHED,
                OR: [
                  { data: { contains: match.id } },
                  { data: { contains: notificationKey } },
                ],
              },
              select: { userId: true },
            }),
          ]);
          const alreadySentUserIds = new Set(
            alreadySentNotifications.map((n) => n.userId),
          );

          for (const [userId, { totalPoints, pollas }] of byUser) {
            if (alreadySentUserIds.has(userId)) continue;

            const maxPoints = Math.max(...pollas.map((p) => p.points), 0);
            const pollasWithExact = pollas.filter((p) => p.points >= 5).length;

            const { title, body } = buildResultUserMessage({
              homeTeam: home,
              awayTeam: away,
              homeScore,
              awayScore,
              matchDate: match.matchDate,
              totalPoints,
              totalPollas: pollas.length,
              pollasWithExact,
              maxPoints,
            });

            const delivery =
              await this.notificationScheduler.deliverUserNotification(
                userId,
                NotificationType.RESULT_PUBLISHED,
                title,
                body,
                {
                  matchId: match.id,
                  leagueIds: pollas.map((p) => p.leagueId),
                  totalPoints,
                  totalPollas: pollas.length,
                  hasExactScore: maxPoints >= 5,
                  matchNotificationKey: notificationKey,
                  postMatchV2: true,
                },
                `Resultado v2: ${home} ${homeScore}-${awayScore} ${away}`,
              );

            deliveredCount++;
            pushSent += delivery.pushSent;
            pushFailed += delivery.pushFailed;
          }

          if (this.waGroup) {
            for (const [leagueId, bucket] of leagueEntries) {
              const summary = summarizeLeagueResults(
                leagueId,
                bucket.leagueName,
                bucket.entries,
              );
              const caption = buildResultWaCaption({
                homeTeam: home,
                awayTeam: away,
                homeScore,
                awayScore,
                summary,
              });
              const ok = await this.waGroup.enqueueNotification(
                WhatsappGroupJobType.RESULT_NOTIFICATION,
                match.id,
                leagueId,
                caption,
              );
              if (ok) waEnqueued++;
            }
          }

          await this.observability.finishRun(runId, {
            status:
              pushFailed > 0
                ? 'WARNING'
                : deliveredCount > 0 || waEnqueued > 0
                  ? 'SUCCESS'
                  : 'SKIPPED',
            summary:
              deliveredCount > 0
                ? `Resultado v2 notificado a ${deliveredCount} usuario(s), WA ${waEnqueued} grupo(s)`
                : 'Sin destinatarios nuevos para resultado v2',
            deliveredCount,
            failedCount: pushFailed,
            warningCount: pushFailed > 0 ? pushFailed : 0,
            details: {
              postMatchV2: true,
              matchId: match.id,
              notificationKey,
              channelBreakdown: {
                pushSent,
                pushFailed,
                waGroupEnqueued: waEnqueued,
              },
            },
          });
        } catch (error) {
          await this.observability.failRun(
            runId,
            error,
            { matchId: match.id, notificationKey, postMatchV2: true },
            'Falló la notificación de resultado v2.',
          );
          await this.releaseResultNotificationClaim(match.id);
          throw error;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`PostMatchOrchestrator failed: ${message}`);
    }
  }

  private async claimResultNotifications(
    matchId: string,
    externalId: string | null,
    claimedAt: Date,
  ): Promise<boolean> {
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

  private async markResultNotificationsAsSent(
    matchId: string,
    externalId: string | null,
    sentAt: Date,
  ): Promise<void> {
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

  /** Reintento manual — fuerza reenvío push/in-app y WA con mensajes v2. */
  async retryResultNotification(
    matchId: string,
    leagueId?: string,
  ): Promise<void> {
    if (!(await this.featureFlags.isPostMatchV2Enabled())) {
      await this.notificationScheduler.retryResultNotificationForMatch(matchId);
      return;
    }

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        predictions: {
          include: {
            user: { select: { id: true, name: true, username: true } },
            league: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!match || match.status !== MatchStatus.FINISHED) {
      throw new Error('El partido debe estar finalizado para reintentar el resultado.');
    }
    if (match.homeScore === null || match.awayScore === null) {
      throw new Error('El partido no tiene marcador final.');
    }

    const home = match.homeTeam.name;
    const away = match.awayTeam.name;
    const homeScore = match.homeScore;
    const awayScore = match.awayScore;

    const byUser = new Map<
      string,
      { totalPoints: number; pollas: Array<{ leagueId: string; points: number }> }
    >();
    const leagueEntries = new Map<
      string,
      {
        leagueName: string;
        entries: Array<{
          userId: string;
          displayName: string;
          points: number;
          detailType: string;
        }>;
      }
    >();

    for (const prediction of match.predictions) {
      if (leagueId && prediction.leagueId !== leagueId) continue;

      const points = Math.round(prediction.points ?? 0);
      const displayName =
        prediction.user.name?.trim() ||
        prediction.user.username?.trim() ||
        'Participante';

      let detailType = 'NONE';
      if (prediction.pointDetail) {
        try {
          detailType =
            (JSON.parse(prediction.pointDetail) as { type?: string }).type ??
            'NONE';
        } catch {
          detailType = points >= 5 ? 'EXACT_SCORE' : 'OTHER';
        }
      }

      if (!byUser.has(prediction.userId)) {
        byUser.set(prediction.userId, { totalPoints: 0, pollas: [] });
      }
      const userData = byUser.get(prediction.userId)!;
      userData.totalPoints += points;
      userData.pollas.push({ leagueId: prediction.leagueId, points });

      let bucket = leagueEntries.get(prediction.leagueId);
      if (!bucket) {
        bucket = { leagueName: prediction.league.name, entries: [] };
        leagueEntries.set(prediction.leagueId, bucket);
      }
      bucket.entries.push({
        userId: prediction.userId,
        displayName,
        points,
        detailType,
      });
    }

    for (const [userId, { totalPoints, pollas }] of byUser) {
      const maxPoints = Math.max(...pollas.map((p) => p.points), 0);
      const pollasWithExact = pollas.filter((p) => p.points >= 5).length;
      const { title, body } = buildResultUserMessage({
        homeTeam: home,
        awayTeam: away,
        homeScore,
        awayScore,
        matchDate: match.matchDate,
        totalPoints,
        totalPollas: pollas.length,
        pollasWithExact,
        maxPoints,
      });

      await this.notificationScheduler.deliverUserNotification(
        userId,
        NotificationType.RESULT_PUBLISHED,
        title,
        body,
        {
          matchId: match.id,
          leagueIds: pollas.map((p) => p.leagueId),
          totalPoints,
          totalPollas: pollas.length,
          hasExactScore: maxPoints >= 5,
          postMatchV2: true,
          manualRetry: true,
        },
        `[MANUAL] Resultado v2: ${home} ${homeScore}-${awayScore} ${away}`,
      );
    }

    if (this.waGroup) {
      for (const [lid, bucket] of leagueEntries) {
        if (leagueId && lid !== leagueId) continue;
        const summary = summarizeLeagueResults(lid, bucket.leagueName, bucket.entries);
        const caption = buildResultWaCaption({
          homeTeam: home,
          awayTeam: away,
          homeScore,
          awayScore,
          summary,
        });
        await this.waGroup.retryStepDelivery(
          match.id,
          lid,
          WhatsappGroupJobType.RESULT_NOTIFICATION,
          {
            automationStep: AutomationStep.RESULT_NOTIFICATION,
            forceResend: true,
            caption,
          },
        );
      }
    }
  }
}
