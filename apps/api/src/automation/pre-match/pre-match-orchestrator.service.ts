import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  AutomationStep,
  MatchStatus,
  MemberStatus,
  NotificationType,
  WhatsappGroupJobType,
} from '@prisma/client';
import { AutomationObservabilityService } from '../../automation-observability/automation-observability.service';
import { SchedulerObservationOutcome } from '../../common/scheduler-observability.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildUserMatchAudiences,
  countPredictionsForLeague,
  getMatchesInMinutesBeforeKickoffWindow,
  getMissingMembersForLeague,
  getRelevantLeaguesForMatch,
  groupLeaguesByCloseMinutes,
} from '../audience/match-audience.resolver';
import {
  automationStepToEscalationCheckpoint,
  checkpointMinutesToId,
  escalationCheckpointToAutomationStep,
  escalationCheckpointToMinutes,
  getEscalationCheckpointsMinutes,
} from '../config/automation-timing.util';
import { AutomationStepConfigService } from '../config/automation-step-config.service';
import { normalizeClosePredictionMinutes } from '../../notifications/match-automation-sweep-context';
import {
  getReminderMatches,
  MatchAutomationSweepContext,
  MatchAutomationSweepLeague,
  MatchAutomationSweepMatch,
} from '../../notifications/match-automation-sweep-context';
import { NotificationScheduler } from '../../notifications/notification.scheduler';
import type { EscalationCheckpointId } from '../types/automation.types';
import {
  buildEscalationUserMessage,
  buildPreMatchEscalationWaCaption,
  buildT60ReminderMessage,
  buildT60WaGroupCaption,
  escalationDedupeKey,
  escalationNotificationDataKey,
} from './pre-match-message.builder';
import type { WhatsappGroupService } from '../../whatsapp/whatsapp-group.service';

@Injectable()
export class PreMatchOrchestratorService {
  private readonly logger = new Logger(PreMatchOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly observability: AutomationObservabilityService,
    private readonly notificationScheduler: NotificationScheduler,
    private readonly stepConfig: AutomationStepConfigService,
    @Optional() private readonly waGroup?: WhatsappGroupService,
  ) {}

  async run(context: MatchAutomationSweepContext): Promise<SchedulerObservationOutcome> {
    try {
      await this.processT60Reminders(context);
      await this.processEscalations(context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`PreMatchOrchestrator failed: ${message}`);
    }

    return {
      status: 'completed',
      summary: { result: 'pre_match_v2_completed' },
    };
  }

  private async processT60Reminders(
    context: MatchAutomationSweepContext,
  ): Promise<void> {
    if (!(await this.stepConfig.isStepEnabled(AutomationStep.MATCH_REMINDER))) {
      return;
    }

    const matches = getReminderMatches(context);

    for (const match of matches) {
      const leagues = getRelevantLeaguesForMatch(context, match);
      if (leagues.length === 0) continue;

      const closeMinutes = Math.min(
        ...leagues.map((l) =>
          normalizeClosePredictionMinutes(l.closePredictionMinutes),
        ),
      );
      const audiences = buildUserMatchAudiences(match, leagues);
      const home = match.homeTeam.name;
      const away = match.awayTeam.name;

      const userIds = audiences.map((a) => a.userId);
      const alreadySent = await this.prisma.notification.findMany({
        where: {
          userId: { in: userIds },
          type: NotificationType.MATCH_REMINDER,
          data: { contains: `"matchId":"${match.id}"` },
        },
        select: { userId: true },
      });
      const alreadySentIds = new Set(alreadySent.map((n) => n.userId));

      let delivered = 0;
      let pushSent = 0;
      let pushFailed = 0;
      let pushDevices = 0;
      let inAppSent = 0;

      for (const audience of audiences) {
        if (alreadySentIds.has(audience.userId)) continue;

        const pollasWithPrediction = audience.leagues.filter(
          (l) => l.hasPrediction,
        ).length;
        const { title, body } = buildT60ReminderMessage({
          homeTeam: home,
          awayTeam: away,
          matchDate: match.matchDate,
          closeMinutes,
          allComplete: audience.allComplete,
          pendingLeagueNames: audience.pendingLeagueNames,
          totalPollas: audience.leagues.length,
          pollasWithPrediction,
        });

        const delivery = await this.notificationScheduler.deliverUserNotification(
          audience.userId,
          NotificationType.MATCH_REMINDER,
          title,
          body,
          {
            matchId: match.id,
            leagueIds: audience.leagues.map((l) => l.leagueId),
            allComplete: audience.allComplete,
            closeMinutes,
            preMatchV2: true,
          },
          `Recordatorio T-60: ${home} vs ${away}`,
        );

        inAppSent++;
        if (delivery.pushSent > 0) delivered++;
        pushSent += delivery.pushSent;
        pushFailed += delivery.pushFailed;
        pushDevices += delivery.pushDevices;
      }

      for (const league of leagues) {
        let waGroupEnqueued = 0;
        if (this.waGroup) {
          try {
            const missing = getMissingMembersForLeague(match, league);
            const activeMembers = league.members.filter(
              (m) => m.status === MemberStatus.ACTIVE,
            ).length;
            const predictedCount = countPredictionsForLeague(match, league.id);
            const waCaption = buildT60WaGroupCaption({
              leagueName: league.name,
              homeTeam: home,
              awayTeam: away,
              matchDate: match.matchDate,
              closeMinutes,
              missingMembers: missing,
              predictedCount,
              totalMembers: activeMembers,
            });
            const ok = await this.waGroup.enqueueNotification(
              WhatsappGroupJobType.MATCH_REMINDER,
              match.id,
              league.id,
              waCaption,
            );
            if (ok) waGroupEnqueued = 1;
          } catch {
            // best-effort
          }
        }

        const scheduledAt = this.observability.getScheduledAt(
          AutomationStep.MATCH_REMINDER,
          {
            matchDate: match.matchDate,
            closeMinutes,
            matchStatus: MatchStatus.SCHEDULED,
          },
        );
        const runId = await this.observability.startRun({
          step: AutomationStep.MATCH_REMINDER,
          matchId: match.id,
          leagueId: league.id,
          scheduledAt,
          audienceCount: league.members.length,
          summary: `Recordatorio T-60 (v2) ${home} vs ${away}`,
        });

        const hasExternalDelivery = delivered > 0 || waGroupEnqueued > 0;
        const runStatus =
          pushFailed > 0
            ? 'WARNING'
            : hasExternalDelivery
              ? 'SUCCESS'
              : inAppSent > 0
                ? 'WARNING'
                : 'SKIPPED';

        await this.observability.finishRun(runId, {
          status: runStatus,
          summary:
            hasExternalDelivery
              ? `T-60: push ${pushSent}/${pushDevices}, WA grupo ${waGroupEnqueued ? 'encolado' : 'omitido'}`
              : inAppSent > 0
                ? `T-60: solo in-app (${inAppSent}) — sin push ni WA grupo`
                : 'Sin recordatorios T-60 nuevos',
          deliveredCount: delivered,
          failedCount: pushFailed,
          warningCount: pushFailed > 0 || (inAppSent > 0 && !hasExternalDelivery) ? 1 : 0,
          details: {
            preMatchV2: true,
            channelBreakdown: {
              pushSent,
              pushFailed,
              pushDevices,
              inAppSent,
              waGroupEnqueued: waGroupEnqueued,
            },
          },
        });
      }
    }
  }

  private async processEscalations(
    context: MatchAutomationSweepContext,
  ): Promise<void> {
    const closeGroups = groupLeaguesByCloseMinutes(context.activeLeagues);

    for (const [closeMinutes, _leaguesInGroup] of closeGroups) {
      const checkpoints = getEscalationCheckpointsMinutes(closeMinutes);

      for (const minutesBeforeKickoff of checkpoints) {
        const checkpoint = checkpointMinutesToId(
          minutesBeforeKickoff,
          closeMinutes,
        );
        if (!checkpoint) continue;

        const escalationStep = escalationCheckpointToAutomationStep(checkpoint);
        if (!(await this.stepConfig.isStepOperational(escalationStep))) {
          continue;
        }

        const matches = getMatchesInMinutesBeforeKickoffWindow(
          context,
          minutesBeforeKickoff,
        );

        for (const match of matches) {
          const relevantLeagues = getRelevantLeaguesForMatch(context, match).filter(
            (league) =>
              normalizeClosePredictionMinutes(league.closePredictionMinutes) ===
              closeMinutes,
          );

          if (relevantLeagues.length === 0) continue;

          await this.processEscalationForMatch({
            match,
            leagues: relevantLeagues,
            closeMinutes,
            minutesBeforeKickoff,
            checkpoint,
          });
        }
      }
    }
  }

  private async processEscalationForMatch(params: {
    match: MatchAutomationSweepMatch;
    leagues: MatchAutomationSweepLeague[];
    closeMinutes: number;
    minutesBeforeKickoff: number;
    checkpoint: EscalationCheckpointId;
    forceResend?: boolean;
  }): Promise<void> {
    const { match, leagues, closeMinutes, minutesBeforeKickoff, checkpoint } =
      params;
    const home = match.homeTeam.name;
    const away = match.awayTeam.name;
    const automationStep = escalationCheckpointToAutomationStep(checkpoint);
    const audiences = buildUserMatchAudiences(match, leagues).filter(
      (a) => !a.allComplete,
    );

    if (audiences.length === 0) {
      for (const league of leagues) {
        const scheduledAt = this.observability.getScheduledAt(automationStep, {
          matchDate: match.matchDate,
          closeMinutes,
          matchStatus: MatchStatus.SCHEDULED,
        });
        const runId = await this.observability.startRun({
          step: automationStep,
          matchId: match.id,
          leagueId: league.id,
          scheduledAt,
          audienceCount: 0,
          summary: `Escalada ${checkpoint} ${home} vs ${away}`,
        });
        await this.observability.finishRun(runId, {
          status: 'SKIPPED',
          summary: `Escalada ${checkpoint}: todos completos en ${league.name}`,
          deliveredCount: 0,
          details: { checkpoint, minutesBeforeKickoff, closeMinutes, reason: 'all_complete' },
        });
      }
      return;
    }

    const userIds = audiences.map((a) => a.userId);
    const dataNeedle = escalationNotificationDataKey(checkpoint, match.id);
    const alreadySentIds = new Set<string>();
    if (!params.forceResend) {
      const alreadySent = await this.prisma.notification.findMany({
        where: {
          userId: { in: userIds },
          type: NotificationType.PREDICTION_CLOSED,
          data: { contains: dataNeedle },
        },
        select: { userId: true },
      });
      for (const row of alreadySent) {
        alreadySentIds.add(row.userId);
      }
    }

    let delivered = 0;
    let pushSent = 0;
    let pushFailed = 0;
    let waEnqueued = 0;

    for (const audience of audiences) {
      if (alreadySentIds.has(audience.userId)) continue;

      const { title, body } = buildEscalationUserMessage({
        homeTeam: home,
        awayTeam: away,
        matchDate: match.matchDate,
        minutesBeforeKickoff,
        closeMinutes,
        pendingLeagueNames: audience.pendingLeagueNames,
        checkpoint,
      });

      const delivery = await this.notificationScheduler.deliverUserNotification(
        audience.userId,
        NotificationType.PREDICTION_CLOSED,
        title,
        body,
        {
          matchId: match.id,
          leagueIds: audience.pendingLeagueIds,
          escalationStep: checkpoint,
          minutesBeforeKickoff,
          closeMinutes,
          preMatchV2: true,
        },
        `Escalada ${checkpoint}: ${home} vs ${away}`,
      );

      delivered++;
      pushSent += delivery.pushSent;
      pushFailed += delivery.pushFailed;
    }

    for (const league of leagues) {
      const missing = getMissingMembersForLeague(match, league);
      if (missing.length === 0) continue;

      const enqueued = await this.enqueueWaEscalation({
        match,
        league,
        missing,
        closeMinutes,
        minutesBeforeKickoff,
        checkpoint,
        home,
        away,
        forceResend: params.forceResend,
      });
      if (enqueued) waEnqueued++;
    }

    for (const league of leagues) {
      const scheduledAt = this.observability.getScheduledAt(automationStep, {
        matchDate: match.matchDate,
        closeMinutes,
        matchStatus: MatchStatus.SCHEDULED,
      });

      const runId = await this.observability.startRun({
        step: automationStep,
        matchId: match.id,
        leagueId: league.id,
        scheduledAt,
        audienceCount: audiences.length,
        summary: `Escalada ${checkpoint} ${home} vs ${away}`,
      });

      await this.observability.finishRun(runId, {
        status:
          pushFailed > 0
            ? 'WARNING'
            : delivered > 0 || waEnqueued > 0
              ? 'SUCCESS'
              : 'SKIPPED',
        summary:
          delivered > 0
            ? `Escalada ${checkpoint}: ${delivered} usuario(s), WA ${waEnqueued} grupo(s)`
            : `Escalada ${checkpoint}: sin destinatarios nuevos`,
        deliveredCount: delivered,
        failedCount: pushFailed,
        details: {
          checkpoint,
          minutesBeforeKickoff,
          closeMinutes,
          channelBreakdown: {
            pushSent,
            pushFailed,
            waGroupEnqueued: waEnqueued,
          },
        },
      });
    }
  }

  private async enqueueWaEscalation(params: {
    match: MatchAutomationSweepMatch;
    league: MatchAutomationSweepLeague;
    missing: ReturnType<typeof getMissingMembersForLeague>;
    closeMinutes: number;
    minutesBeforeKickoff: number;
    checkpoint: EscalationCheckpointId;
    home: string;
    away: string;
    forceResend?: boolean;
  }): Promise<boolean> {
    if (!this.waGroup) return false;

    const activeMembers = params.league.members.filter(
      (m) => m.status === MemberStatus.ACTIVE,
    ).length;
    const predictedCount = countPredictionsForLeague(
      params.match,
      params.league.id,
    );

    const caption = buildPreMatchEscalationWaCaption({
      leagueName: params.league.name,
      homeTeam: params.home,
      awayTeam: params.away,
      matchDate: params.match.matchDate,
      minutesBeforeKickoff: params.minutesBeforeKickoff,
      closeMinutes: params.closeMinutes,
      missingMembers: params.missing,
      predictedCount,
      totalMembers: activeMembers,
      checkpoint: params.checkpoint,
    });

    if (params.forceResend) {
      const result = await this.waGroup.retryStepDelivery(
        params.match.id,
        params.league.id,
        WhatsappGroupJobType.PRE_MATCH_ESCALATION,
        {
          automationStep: escalationCheckpointToAutomationStep(
            params.checkpoint,
          ),
          forceResend: true,
          caption,
        },
      );
      return result.ok;
    }

    return this.waGroup.enqueuePreMatchEscalation(
      params.match.id,
      params.league.id,
      caption,
      escalationDedupeKey(
        params.checkpoint,
        params.match.id,
        params.league.id,
      ),
    );
  }

  /** Reintento manual de escalada pre-partido (T-45 / T-30 / T-final). */
  async retryEscalation(params: {
    matchId: string;
    step:
      | typeof AutomationStep.ESCALATION_T45
      | typeof AutomationStep.ESCALATION_T30
      | typeof AutomationStep.ESCALATION_FINAL;
    leagueId?: string;
  }): Promise<void> {
    const checkpoint = automationStepToEscalationCheckpoint(params.step);
    if (!checkpoint) {
      throw new Error(`Step de escalada no válido: ${params.step}`);
    }

    const match = await this.prisma.match.findUnique({
      where: { id: params.matchId },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        predictions: {
          select: {
            userId: true,
            leagueId: true,
            homeScore: true,
            awayScore: true,
            submittedAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!match) {
      throw new Error(`Partido ${params.matchId} no encontrado.`);
    }

    const leagueIds = [
      ...new Set(match.predictions.map((p) => p.leagueId)),
    ];
    const targetLeagueIds = params.leagueId
      ? leagueIds.filter((id) => id === params.leagueId)
      : leagueIds;

    if (targetLeagueIds.length === 0) {
      throw new Error('No hay ligas con predicciones para este partido.');
    }

    const leagues = await this.prisma.league.findMany({
      where: { id: { in: targetLeagueIds }, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        closePredictionMinutes: true,
        leagueTournaments: { select: { tournamentId: true } },
        members: {
          where: { status: MemberStatus.ACTIVE },
          select: {
            userId: true,
            status: true,
            role: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const sweepMatch: MatchAutomationSweepMatch = {
      id: match.id,
      status: match.status,
      matchDate: match.matchDate,
      tournamentId: match.tournamentId,
      venue: match.venue,
      round: match.round,
      predictionReportSentAt: match.predictionReportSentAt,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      predictions: match.predictions.map((p) => ({
        userId: p.userId,
        leagueId: p.leagueId,
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        submittedAt: p.submittedAt,
        user: p.user,
      })),
    };

    for (const league of leagues) {
      const closeMinutes = normalizeClosePredictionMinutes(
        league.closePredictionMinutes,
      );
      const minutesBeforeKickoff = escalationCheckpointToMinutes(
        checkpoint,
        closeMinutes,
      );

      await this.processEscalationForMatch({
        match: sweepMatch,
        leagues: [league as MatchAutomationSweepLeague],
        closeMinutes,
        minutesBeforeKickoff,
        checkpoint,
        forceResend: true,
      });
    }
  }
}
