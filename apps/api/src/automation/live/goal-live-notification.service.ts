import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AutomationStep, NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappGroupService } from '../../whatsapp/whatsapp-group.service';
import { AutomationDeliveryService } from '../delivery/automation-delivery.service';
import { LiveOrchestratorService } from './live-orchestrator.service';
import type { LeagueGoalImpactSummary } from './goal-impact-analyzer.service';
import type { GoalImpactContext } from '../types/automation.types';
import { logGoalAutomation } from './goal-automation-observability.util';

export type GoalScoredDispatchParams = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  goalScorerTeam: string | null;
  awayGoalScorerTeam: string | null;
  elapsed: number | null;
  matchDate?: Date;
  scorerInfo?: {
    scorerName: string | null;
    assistName: string | null;
    goalDetail: string | null;
  };
};

@Injectable()
export class GoalLiveNotificationService {
  private readonly logger = new Logger(GoalLiveNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: AutomationDeliveryService,
    @Optional() @Inject(WhatsappGroupService) private readonly waGroup?: WhatsappGroupService,
    @Optional() private readonly liveOrchestrator?: LiveOrchestratorService,
  ) {}

  /**
   * Simula goles progresivos cuando el marcador sube varios goles de una vez
   * (sync con lag o ingreso manual admin) y dispara notificaciones por cada gol.
   */
  async dispatchScoreIncrease(params: {
    matchId: string;
    homeTeamName: string;
    awayTeamName: string;
    prevHome: number;
    prevAway: number;
    newHome: number;
    newAway: number;
    elapsed: number | null;
    matchDate?: Date;
  }): Promise<void> {
    const homeDelta = Math.max(0, params.newHome - params.prevHome);
    const awayDelta = Math.max(0, params.newAway - params.prevAway);
    const totalDelta = homeDelta + awayDelta;
    if (totalDelta === 0) return;

    let runHome = params.prevHome;
    let runAway = params.prevAway;

    for (let g = 0; g < totalDelta; g++) {
      const isHomeGoal = g < homeDelta;
      if (isHomeGoal) runHome++;
      else runAway++;

      await this.dispatchGoalScored({
        matchId: params.matchId,
        homeTeamName: params.homeTeamName,
        awayTeamName: params.awayTeamName,
        homeScore: runHome,
        awayScore: runAway,
        goalScorerTeam: isHomeGoal ? params.homeTeamName : null,
        awayGoalScorerTeam: isHomeGoal ? null : params.awayTeamName,
        elapsed: params.elapsed,
        matchDate: params.matchDate,
      });
    }
  }

  /**
   * Al detectar un gol: notifica participantes (push/in-app) y encola jobs WA Grupo
   * (GOAL_SCORED + GOAL_IMPACT por polla) en el mismo instante. El dispatcher envía
   * los jobs PENDING de forma masiva.
   */
  async dispatchGoalScored(params: GoalScoredDispatchParams): Promise<void> {
    try {
      const predictions = await this.prisma.prediction.findMany({
        where: { matchId: params.matchId },
        select: { userId: true, leagueId: true },
      });

      if (predictions.length === 0) {
        logGoalAutomation(this.logger, 'goal_dispatch_skipped', {
          matchId: params.matchId,
          homeScore: params.homeScore,
          awayScore: params.awayScore,
          reason: 'no_predictions',
        }, 'debug');
        return;
      }

      const leagueIds = [...new Set(predictions.map((p) => p.leagueId))];

      logGoalAutomation(this.logger, 'goal_dispatch_started', {
        matchId: params.matchId,
        homeScore: params.homeScore,
        awayScore: params.awayScore,
        leagueCount: leagueIds.length,
        source: 'goal_live_notification',
      });

      const leagues =
        leagueIds.length > 0
          ? await this.prisma.league.findMany({
              where: { id: { in: leagueIds } },
              select: { id: true, name: true },
            })
          : [];
      const leagueNameById = new Map(leagues.map((l) => [l.id, l.name]));

      const scoringTeam = params.goalScorerTeam ?? params.awayGoalScorerTeam;
      const { title, body, minuteLabel } = buildGoalNotificationText({
        homeTeamName: params.homeTeamName,
        awayTeamName: params.awayTeamName,
        homeScore: params.homeScore,
        awayScore: params.awayScore,
        goalScorerTeam: params.goalScorerTeam,
        awayGoalScorerTeam: params.awayGoalScorerTeam,
        elapsed: params.elapsed,
        scorerName: params.scorerInfo?.scorerName ?? null,
        assistName: params.scorerInfo?.assistName ?? null,
        goalDetail: params.scorerInfo?.goalDetail ?? null,
      });

      const matchDate =
        params.matchDate ??
        (
          await this.prisma.match.findUnique({
            where: { id: params.matchId },
            select: { matchDate: true },
          })
        )?.matchDate ??
        new Date();

      const impactCtx: GoalImpactContext = {
        matchId: params.matchId,
        homeTeam: params.homeTeamName,
        awayTeam: params.awayTeamName,
        homeScore: params.homeScore,
        awayScore: params.awayScore,
        matchDate,
        elapsed: params.elapsed,
        scoringTeam,
        scorerName: params.scorerInfo?.scorerName ?? null,
      };

      const impactSummaries = this.liveOrchestrator
        ? await this.liveOrchestrator.loadGoalImpactSummaries(impactCtx)
        : null;
      const impactByLeague = new Map<string, LeagueGoalImpactSummary>(
        (impactSummaries ?? []).map((summary) => [summary.leagueId, summary]),
      );

      logGoalAutomation(this.logger, 'goal_impact_summaries_loaded', {
        matchId: impactCtx.matchId,
        homeScore: impactCtx.homeScore,
        awayScore: impactCtx.awayScore,
        leagueCount: impactSummaries?.length ?? 0,
        orchestratorAvailable: !!this.liveOrchestrator,
      }, impactSummaries?.length ? 'log' : 'warn');

      let waScoredEnqueued = 0;
      let waImpactEnqueued = 0;

      await Promise.all([
        this.enqueueWaGoalJobs(
          params,
          leagueIds,
          leagueNameById,
          scoringTeam,
          impactCtx,
          impactByLeague,
          () => { waScoredEnqueued++; },
          () => { waImpactEnqueued++; },
        ),
        this.notifyParticipants(predictions, params, title, body, minuteLabel, scoringTeam),
      ]);

      logGoalAutomation(this.logger, 'goal_dispatch_completed', {
        matchId: params.matchId,
        homeScore: params.homeScore,
        awayScore: params.awayScore,
        waScoredEnqueued,
        waImpactEnqueued,
        participantCount: new Set(predictions.map((p) => p.userId)).size,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logGoalAutomation(this.logger, 'goal_dispatch_completed', {
        matchId: params.matchId,
        homeScore: params.homeScore,
        awayScore: params.awayScore,
        error: message,
        status: 'failed',
      }, 'error');
    }
  }

  /** Encola GOAL_SCORED y GOAL_IMPACT por polla (WhatsappGroupJob → PENDING). */
  private async enqueueWaGoalJobs(
    params: GoalScoredDispatchParams,
    leagueIds: string[],
    leagueNameById: Map<string, string>,
    scoringTeam: string | null,
    impactCtx: GoalImpactContext,
    impactByLeague: Map<string, LeagueGoalImpactSummary>,
    onScoredEnqueued: () => void,
    onImpactEnqueued: () => void,
  ): Promise<void> {
    if (!this.waGroup) {
      logGoalAutomation(this.logger, 'goal_wa_scored_skipped', {
        matchId: params.matchId,
        reason: 'whatsapp_group_service_unavailable',
      }, 'warn');
      return;
    }

    if (!this.liveOrchestrator) {
      logGoalAutomation(this.logger, 'goal_impact_skipped', {
        matchId: params.matchId,
        reason: 'live_orchestrator_unavailable',
      }, 'warn');
    }

    for (const leagueId of leagueIds) {
      const leagueName = leagueNameById.get(leagueId) ?? 'Polla';
      try {
        const enqueued = await this.waGroup.enqueueGoalNotification(params.matchId, leagueId, {
          homeTeam: params.homeTeamName,
          awayTeam: params.awayTeamName,
          homeScore: params.homeScore,
          awayScore: params.awayScore,
          scoringTeam,
          elapsed: params.elapsed,
          leagueName,
          scorerName: params.scorerInfo?.scorerName ?? null,
          assistName: params.scorerInfo?.assistName ?? null,
          goalDetail: params.scorerInfo?.goalDetail ?? null,
        });
        if (enqueued) {
          onScoredEnqueued();
          logGoalAutomation(this.logger, 'goal_wa_scored_enqueued', {
            matchId: params.matchId,
            leagueId,
            leagueName,
            homeScore: params.homeScore,
            awayScore: params.awayScore,
          });
        } else {
          logGoalAutomation(this.logger, 'goal_wa_scored_skipped', {
            matchId: params.matchId,
            leagueId,
            leagueName,
            reason: 'dedupe_or_create_failed',
          }, 'warn');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logGoalAutomation(this.logger, 'goal_wa_scored_skipped', {
          matchId: params.matchId,
          leagueId,
          leagueName,
          reason: message,
        }, 'warn');
      }

      const impactSummary = impactByLeague.get(leagueId);
      if (!impactSummary) {
        logGoalAutomation(this.logger, 'goal_impact_skipped', {
          matchId: params.matchId,
          leagueId,
          leagueName,
          reason: 'no_impact_summary_for_league',
        }, 'debug');
        continue;
      }
      if (!this.liveOrchestrator) continue;

      const impactOk = await this.liveOrchestrator.enqueueGoalImpactForLeague(
        impactCtx,
        impactSummary,
      );
      if (impactOk) onImpactEnqueued();
    }
  }

  private async notifyParticipants(
    predictions: Array<{ userId: string; leagueId: string }>,
    params: GoalScoredDispatchParams,
    title: string,
    body: string,
    minuteLabel: string | null,
    scoringTeam: string | null,
  ): Promise<void> {
    const channels = await this.delivery.resolveChannelFlags(
      AutomationStep.GOAL_SCORED,
    );
    if (!channels.push && !channels.inApp) {
      return;
    }

    const notifiedUsers = new Set<string>();
    for (const prediction of predictions) {
      if (notifiedUsers.has(prediction.userId)) continue;
      notifiedUsers.add(prediction.userId);

      await this.delivery.deliverToUser({
        userId: prediction.userId,
        type: NotificationType.GOAL_SCORED,
        title,
        body,
        data: {
          matchId: params.matchId,
          type: 'goal',
          homeScore: params.homeScore,
          awayScore: params.awayScore,
          scorerName: params.scorerInfo?.scorerName ?? null,
          elapsed: params.elapsed,
          assistName: params.scorerInfo?.assistName ?? null,
          goalDetail: params.scorerInfo?.goalDetail ?? null,
          scoringTeam,
          minute: minuteLabel,
        },
        step: AutomationStep.GOAL_SCORED,
        pushTag: `goal-${params.matchId}-${params.homeScore}-${params.awayScore}`,
        pushRequireInteraction: false,
      });
    }

    logGoalAutomation(this.logger, 'goal_participants_notified', {
      matchId: params.matchId,
      homeScore: params.homeScore,
      awayScore: params.awayScore,
      participantCount: notifiedUsers.size,
    });
  }
}

function buildGoalNotificationText(params: {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  goalScorerTeam: string | null;
  awayGoalScorerTeam: string | null;
  elapsed: number | null;
  scorerName: string | null;
  assistName: string | null;
  goalDetail: string | null;
}): { title: string; body: string; minuteLabel: string | null } {
  const score = `${params.homeScore ?? '-'}-${params.awayScore ?? '-'}`;
  const minuteLabel = params.elapsed != null ? `${params.elapsed}'` : null;
  const minuteSuffix = minuteLabel ? ` ${minuteLabel}` : '';

  const scorerLine = formatGoalScorerLine({
    scoringTeam: params.goalScorerTeam ?? params.awayGoalScorerTeam,
    scorerName: params.scorerName,
    assistName: params.assistName,
    goalDetail: params.goalDetail,
  });

  const title = params.scorerName ? `⚽ ¡GOL de ${params.scorerName}!` : '⚽ ¡GOL!';
  const body = `${scorerLine} — ${params.homeTeamName} ${score} ${params.awayTeamName}${minuteSuffix}`;

  return { title, body, minuteLabel };
}

function formatGoalScorerLine(params: {
  scoringTeam: string | null;
  scorerName: string | null;
  assistName: string | null;
  goalDetail: string | null;
}): string {
  if (params.goalDetail === 'Own Goal' && params.scorerName) {
    return `Autogol de ${params.scorerName}`;
  }

  if (params.scorerName) {
    const assist = params.assistName ? ` (asist. ${params.assistName})` : '';
    const penalty = params.goalDetail === 'Penalty' ? ' (penalti)' : '';
    return `${params.scorerName}${assist}${penalty}`;
  }

  if (params.scoringTeam) {
    return params.scoringTeam;
  }

  return 'Gol';
}
