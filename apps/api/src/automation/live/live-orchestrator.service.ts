import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  AutomationStep,
  MatchStatus,
  NotificationType,
  WhatsappGroupJobType,
} from '@prisma/client';
import { AutomationObservabilityService } from '../../automation-observability/automation-observability.service';
import { NotificationScheduler } from '../../notifications/notification.scheduler';
import { PrismaService } from '../../prisma/prisma.service';
import type { WhatsappGroupService } from '../../whatsapp/whatsapp-group.service';
import { AutomationStepConfigService } from '../config/automation-step-config.service';
import { automationStepToLiveEvent } from '../config/automation-step-scheduler.util';
import type {
  GoalImpactContext,
  LiveMatchContext,
  LivePhaseEventId,
} from '../types/automation.types';
import { GoalImpactAnalyzerService } from './goal-impact-analyzer.service';
import {
  buildGoalImpactWaCaption,
  buildLiveUserMessage,
  buildLiveWaCaption,
  goalImpactDedupeKey,
  liveEventNotificationDataKey,
  liveEventToAutomationStep,
} from './live-message.builder';

@Injectable()
export class LiveOrchestratorService {
  private readonly logger = new Logger(LiveOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stepConfig: AutomationStepConfigService,
    private readonly observability: AutomationObservabilityService,
    private readonly notificationScheduler: NotificationScheduler,
    private readonly goalImpactAnalyzer: GoalImpactAnalyzerService,
    @Optional() private readonly waGroup?: WhatsappGroupService,
  ) {}

  async handleMatchStart(ctx: LiveMatchContext): Promise<void> {
    await this.dispatchLiveEvent(ctx, 'MATCH_START');
  }

  async handleHalftime(ctx: LiveMatchContext): Promise<void> {
    await this.dispatchLiveEvent(ctx, 'HALFTIME');
  }

  async handleSecondHalfStart(ctx: LiveMatchContext): Promise<void> {
    await this.dispatchLiveEvent(ctx, 'SECOND_HALF_START');
  }

  async handleMatchLiveEnd(ctx: LiveMatchContext): Promise<void> {
    await this.dispatchLiveEvent(ctx, 'MATCH_LIVE_END');
  }

  async handleGoalImpact(ctx: GoalImpactContext): Promise<void> {
    if (!(await this.stepConfig.isStepEnabled(AutomationStep.GOAL_IMPACT))) {
      this.logger.warn(
        `GOAL_IMPACT desactivado en configuración — omitido para ${ctx.matchId} (${ctx.homeScore}-${ctx.awayScore})`,
      );
      return;
    }

    if (!this.waGroup) {
      this.logger.warn(
        `WhatsappGroupService no disponible — GOAL_IMPACT omitido para ${ctx.matchId}`,
      );
      return;
    }

    try {
      const summaries = await this.goalImpactAnalyzer.summarizeByLeague(
        ctx.matchId,
        ctx.homeScore,
        ctx.awayScore,
      );
      if (summaries.length === 0) {
        this.logger.debug(
          `Goal impact skipped for match ${ctx.matchId}: sin ligas con predicciones`,
        );
        return;
      }

      let waEnqueued = 0;

      for (const summary of summaries) {
        const caption = buildGoalImpactWaCaption({
          leagueName: summary.leagueName,
          homeTeam: ctx.homeTeam,
          awayTeam: ctx.awayTeam,
          homeScore: ctx.homeScore,
          awayScore: ctx.awayScore,
          elapsed: ctx.elapsed,
          scoringTeam: ctx.scoringTeam,
          scorerName: ctx.scorerName,
          summary,
        });

        const enqueued = await this.enqueueGoalImpactWa(
          ctx.matchId,
          summary.leagueId,
          caption,
          goalImpactDedupeKey(
            ctx.matchId,
            summary.leagueId,
            ctx.homeScore,
            ctx.awayScore,
          ),
        );
        if (enqueued) waEnqueued++;

        await this.recordRun({
          step: AutomationStep.GOAL_IMPACT,
          matchId: ctx.matchId,
          leagueId: summary.leagueId,
          matchDate: ctx.matchDate,
          audienceCount: summary.scoringCount,
          summary: enqueued
            ? `Impacto gol ${ctx.homeTeam} vs ${ctx.awayTeam} ${ctx.homeScore}-${ctx.awayScore} (${summary.leagueName})`
            : `Impacto gol no encolado (${summary.leagueName}) — revisar WA Grupo`,
          delivered: enqueued ? 1 : 0,
          pushSent: 0,
          pushFailed: 0,
          waEnqueued: enqueued ? 1 : 0,
          extraDetails: {
            homeScore: ctx.homeScore,
            awayScore: ctx.awayScore,
            exactScoreCount: summary.exactScoreCount,
            provisionalRanking: summary.provisionalRanking,
          },
        });

        if (!enqueued) {
          this.logger.warn(
            `GOAL_IMPACT no encolado para liga ${summary.leagueId} (${summary.leagueName}) en partido ${ctx.matchId}`,
          );
        }
      }

      this.logger.log(
        `Goal impact WA for match ${ctx.matchId}: ${waEnqueued} grupo(s) encolados`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`handleGoalImpact failed: ${message}`);
    }
  }

  private async dispatchLiveEvent(
    ctx: LiveMatchContext,
    event: LivePhaseEventId,
    options?: { forceResend?: boolean; leagueIds?: string[] },
  ): Promise<void> {
    if (event === 'GOAL_IMPACT') return;

    const automationStep = liveEventToAutomationStep(event);
    if (!(await this.stepConfig.isStepEnabled(automationStep))) {
      return;
    }

    try {
      const predictions = await this.prisma.prediction.findMany({
        where: { matchId: ctx.matchId },
        select: { userId: true, leagueId: true },
      });
      if (predictions.length === 0) return;

      const leagueIds = options?.leagueIds?.length
        ? options.leagueIds
        : [...new Set(predictions.map((p) => p.leagueId))];
      const leagues = await this.prisma.league.findMany({
        where: { id: { in: leagueIds } },
        select: { id: true, name: true },
      });
      const leagueNameById = new Map(leagues.map((l) => [l.id, l.name]));

      const userIds = [...new Set(predictions.map((p) => p.userId))];
      const dataNeedle = liveEventNotificationDataKey(event, ctx.matchId);
      const alreadySentIds = new Set<string>();
      if (!options?.forceResend) {
        const alreadySent = await this.prisma.notification.findMany({
          where: {
            userId: { in: userIds },
            type: NotificationType.LEAGUE_UPDATE,
            data: { contains: dataNeedle },
          },
          select: { userId: true },
        });
        for (const row of alreadySent) {
          alreadySentIds.add(row.userId);
        }
      }

      const { title, body } = buildLiveUserMessage({
        event,
        homeTeam: ctx.homeTeam,
        awayTeam: ctx.awayTeam,
        homeScore: ctx.homeScore,
        awayScore: ctx.awayScore,
        elapsed: ctx.elapsed,
      });

      let delivered = 0;
      let pushSent = 0;
      let pushFailed = 0;

      for (const userId of userIds) {
        if (alreadySentIds.has(userId)) continue;

        const delivery = await this.notificationScheduler.deliverUserNotification(
          userId,
          NotificationType.LEAGUE_UPDATE,
          title,
          body,
          {
            matchId: ctx.matchId,
            liveEvent: event,
            livePhaseV2: true,
            homeScore: ctx.homeScore,
            awayScore: ctx.awayScore,
            elapsed: ctx.elapsed,
          },
          `Live ${event}: ${ctx.homeTeam} vs ${ctx.awayTeam}`,
        );

        delivered++;
        pushSent += delivery.pushSent;
        pushFailed += delivery.pushFailed;
      }

      const waType = this.liveEventToWaJobType(event);
      let waEnqueued = 0;

      if (waType && this.waGroup) {
        for (const leagueId of leagueIds) {
          const caption = buildLiveWaCaption({
            event,
            leagueName: leagueNameById.get(leagueId) ?? 'Polla',
            homeTeam: ctx.homeTeam,
            awayTeam: ctx.awayTeam,
            homeScore: ctx.homeScore,
            awayScore: ctx.awayScore,
            elapsed: ctx.elapsed,
          });
          const ok = options?.forceResend
            ? await this.waGroup
                .retryStepDelivery(ctx.matchId, leagueId, waType, {
                  automationStep: liveEventToAutomationStep(event),
                  forceResend: true,
                })
                .then((r) => r.ok)
            : await this.waGroup.enqueueNotification(
                waType,
                ctx.matchId,
                leagueId,
                caption,
              );
          if (ok) waEnqueued++;
        }
      }

      for (const leagueId of leagueIds) {
        await this.recordRun({
          step: automationStep,
          matchId: ctx.matchId,
          leagueId,
          matchDate: ctx.matchDate,
          audienceCount: userIds.length,
          summary: `${event} ${ctx.homeTeam} vs ${ctx.awayTeam}`,
          delivered,
          pushSent,
          pushFailed,
          waEnqueued: waEnqueued > 0 ? 1 : 0,
          extraDetails: { liveEvent: event },
        });
      }

      this.logger.log(
        `Live ${event} for match ${ctx.matchId}: ${delivered} usuario(s), WA ${waEnqueued} grupo(s)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`dispatchLiveEvent(${event}) failed: ${message}`);
    }
  }

  private liveEventToWaJobType(
    event: LivePhaseEventId,
  ): WhatsappGroupJobType | null {
    switch (event) {
      case 'MATCH_START':
        return WhatsappGroupJobType.MATCH_START;
      case 'HALFTIME':
        return WhatsappGroupJobType.HALFTIME;
      case 'SECOND_HALF_START':
        return WhatsappGroupJobType.SECOND_HALF_START;
      case 'MATCH_LIVE_END':
        return WhatsappGroupJobType.MATCH_LIVE_END;
      default:
        return null;
    }
  }

  private async enqueueGoalImpactWa(
    matchId: string,
    leagueId: string,
    caption: string,
    dedupeKey: string,
  ): Promise<boolean> {
    if (!this.waGroup) return false;
    return this.waGroup.enqueueGoalImpact(matchId, leagueId, caption, dedupeKey);
  }

  private async recordRun(params: {
    step: AutomationStep;
    matchId: string;
    leagueId: string;
    matchDate: Date;
    audienceCount: number;
    summary: string;
    delivered: number;
    pushSent: number;
    pushFailed: number;
    waEnqueued: number;
    extraDetails?: Record<string, unknown>;
  }): Promise<void> {
    const scheduledAt = this.observability.getScheduledAt(params.step, {
      matchDate: params.matchDate,
      closeMinutes: 0,
      matchStatus: MatchStatus.LIVE,
    });

    const runId = await this.observability.startRun({
      step: params.step,
      matchId: params.matchId,
      leagueId: params.leagueId,
      scheduledAt,
      audienceCount: params.audienceCount,
      summary: params.summary,
    });

    await this.observability.finishRun(runId, {
      status: this.resolveRunStatus(params),
      summary: params.summary,
      deliveredCount: params.delivered,
      failedCount: params.pushFailed,
      warningCount: params.pushFailed > 0 ? params.pushFailed : 0,
      details: {
        livePhaseV2: true,
        channelBreakdown: {
          pushSent: params.pushSent,
          pushFailed: params.pushFailed,
          waGroupEnqueued: params.waEnqueued,
        },
        ...params.extraDetails,
      },
    });
  }

  private resolveRunStatus(params: {
    step: AutomationStep;
    delivered: number;
    pushFailed: number;
    waEnqueued: number;
  }): 'SUCCESS' | 'WARNING' | 'SKIPPED' | 'FAILED' {
    if (params.step === AutomationStep.GOAL_IMPACT) {
      if (params.waEnqueued > 0) return 'SUCCESS';
      return 'FAILED';
    }

    if (params.pushFailed > 0) return 'WARNING';
    if (params.delivered > 0 || params.waEnqueued > 0) return 'SUCCESS';
    return 'SKIPPED';
  }

  /** Reintento manual desde admin — ignora dedupe de in-app y fuerza WA si aplica. */
  async retryLiveStep(
    matchId: string,
    step: AutomationStep,
    leagueId?: string,
  ): Promise<void> {
    const event = automationStepToLiveEvent(step);
    if (!event) {
      throw new Error(`El step ${step} no es un evento en vivo reintentable.`);
    }

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    });
    if (!match) {
      throw new Error(`Partido ${matchId} no encontrado.`);
    }

    await this.dispatchLiveEvent(
      {
        matchId: match.id,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        matchDate: match.matchDate,
        elapsed: match.elapsed,
      },
      event,
      {
        forceResend: true,
        leagueIds: leagueId ? [leagueId] : undefined,
      },
    );
  }
}
