import { Injectable } from '@nestjs/common';
import {
  AutomationStep,
  MemberStatus,
  WhatsappGroupJobType,
} from '@prisma/client';
import { AUTOMATION_STEP_TO_WA_JOB } from '../../whatsapp/whatsapp-channel-status.util';
import { PrismaService } from '../../prisma/prisma.service';
import { automationStepToLiveEvent } from '../config/automation-step-scheduler.util';
import {
  automationStepToEscalationCheckpoint,
  escalationCheckpointToMinutes,
} from '../config/automation-timing.util';
import { escalationDedupeKey } from '../pre-match/pre-match-message.builder';
import {
  buildEscalationUserMessage,
  buildPreMatchEscalationWaCaption,
  buildT60ReminderMessage,
} from '../pre-match/pre-match-message.builder';
import {
  buildGoalImpactWaCaption,
  buildLiveUserMessage,
  buildLiveWaCaption,
} from '../live/live-message.builder';
import { GoalImpactAnalyzerService } from '../live/goal-impact-analyzer.service';
import {
  buildResultUserMessage,
  buildResultWaCaption,
  summarizeLeagueResults,
} from '../post-match/post-match-message.builder';
import {
  normalizeClosePredictionMinutes,
  type MatchAutomationSweepLeague,
  type MatchAutomationSweepMatch,
} from '../../notifications/match-automation-sweep-context';
import {
  countPredictionsForLeague,
  getMissingMembersForLeague,
} from '../audience/match-audience.resolver';

export type MessagePreviewChannel = 'waGroup' | 'push' | 'inApp';

export type MessagePreviewResult = {
  step: AutomationStep;
  channel: MessagePreviewChannel;
  source: 'job' | 'generated' | 'unavailable';
  dedupeKey: string | null;
  jobStatus: string | null;
  jobId: string | null;
  title: string | null;
  body: string;
};

type MatchPreviewContext = MatchAutomationSweepMatch & {
  homeScore: number | null;
  awayScore: number | null;
  elapsed: number | null;
};

@Injectable()
export class AutomationMessagePreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goalImpactAnalyzer: GoalImpactAnalyzerService,
  ) {}

  async getPreview(params: {
    matchId: string;
    step: AutomationStep;
    leagueId?: string;
    channel?: MessagePreviewChannel;
  }): Promise<MessagePreviewResult> {
    const channel = params.channel ?? 'waGroup';
    const jobType = AUTOMATION_STEP_TO_WA_JOB[params.step];
    const dedupeKey = await this.resolveDedupeKey(
      params.matchId,
      params.leagueId,
      params.step,
      jobType,
    );

    const existingJob =
      dedupeKey && channel === 'waGroup'
        ? await this.prisma.whatsappGroupJob.findUnique({
            where: { dedupeKey },
            select: { id: true, caption: true, status: true },
          })
        : null;

    if (existingJob?.caption && channel === 'waGroup') {
      return {
        step: params.step,
        channel,
        source: 'job',
        dedupeKey,
        jobStatus: existingJob.status,
        jobId: existingJob.id,
        title: null,
        body: existingJob.caption,
      };
    }

    const generated = await this.generatePreview(params, channel);
    return {
      ...generated,
      dedupeKey,
      jobStatus: existingJob?.status ?? null,
      jobId: existingJob?.id ?? null,
    };
  }

  private async resolveDedupeKey(
    matchId: string,
    leagueId: string | undefined,
    step: AutomationStep,
    jobType?: WhatsappGroupJobType,
  ): Promise<string | null> {
    if (jobType === WhatsappGroupJobType.PRE_MATCH_ESCALATION && leagueId) {
      const checkpoint = automationStepToEscalationCheckpoint(step);
      if (checkpoint) return escalationDedupeKey(checkpoint, matchId, leagueId);
    }

    if (jobType === WhatsappGroupJobType.GOAL_IMPACT && leagueId) {
      const job = await this.prisma.whatsappGroupJob.findFirst({
        where: { matchId, leagueId, type: jobType },
        orderBy: { createdAt: 'desc' },
        select: { dedupeKey: true },
      });
      return job?.dedupeKey ?? null;
    }

    return leagueId && jobType ? `${jobType}:${matchId}:${leagueId}` : null;
  }

  private async generatePreview(
    params: { matchId: string; step: AutomationStep; leagueId?: string },
    channel: MessagePreviewChannel,
  ): Promise<Omit<MessagePreviewResult, 'dedupeKey' | 'jobStatus' | 'jobId'>> {
    const match = await this.loadMatchContext(params.matchId);
    if (!match) {
      return unavailable(params.step, channel, 'Partido no encontrado.');
    }

    const league = params.leagueId
      ? await this.loadLeagueContext(params.leagueId)
      : null;

    switch (params.step) {
      case AutomationStep.MATCH_REMINDER:
        return this.previewReminder(match, league, channel);
      case AutomationStep.ESCALATION_T45:
      case AutomationStep.ESCALATION_T30:
      case AutomationStep.ESCALATION_FINAL:
        return this.previewEscalation(match, league, params.step, channel);
      case AutomationStep.MATCH_START:
      case AutomationStep.HALFTIME:
      case AutomationStep.SECOND_HALF_START:
      case AutomationStep.MATCH_LIVE_END:
        return this.previewLiveEvent(match, league, params.step, channel);
      case AutomationStep.GOAL_IMPACT:
        return this.previewGoalImpact(match, league, channel);
      case AutomationStep.RESULT_NOTIFICATION:
        return this.previewResult(match, league, channel);
      case AutomationStep.PREDICTION_CLOSING:
        return {
          step: params.step,
          channel,
          source: 'generated',
          title: 'Predicción pendiente',
          body: `Cierre de predicciones: ${match.homeTeam.name} vs ${match.awayTeam.name} (hora Bogotá).`,
        };
      case AutomationStep.PREDICTION_REPORT:
      case AutomationStep.RESULT_REPORT:
        return {
          step: params.step,
          channel,
          source: 'generated',
          title: null,
          body:
            channel === 'waGroup'
              ? `*${league?.name ?? 'Polla'}*\nReporte ${params.step === AutomationStep.PREDICTION_REPORT ? 'de predicciones' : 'de resultados'} (imagen/PDF).`
              : `Reporte por email — ${match.homeTeam.name} vs ${match.awayTeam.name}.`,
        };
      default:
        return unavailable(params.step, channel, 'Vista previa no disponible.');
    }
  }

  private previewReminder(
    match: MatchPreviewContext,
    league: MatchAutomationSweepLeague | null,
    channel: MessagePreviewChannel,
  ): Omit<MessagePreviewResult, 'dedupeKey' | 'jobStatus' | 'jobId'> {
    const closeMinutes = league
      ? normalizeClosePredictionMinutes(league.closePredictionMinutes)
      : 15;
    const { title, body } = buildT60ReminderMessage({
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      matchDate: match.matchDate,
      closeMinutes,
      allComplete: false,
      pendingLeagueNames: [league?.name ?? 'Polla'],
      totalPollas: 1,
      pollasWithPrediction: 0,
    });

    if (channel === 'waGroup') {
      return {
        step: AutomationStep.MATCH_REMINDER,
        channel,
        source: 'generated',
        title: null,
        body: `${title}\n${body}`,
      };
    }
    return {
      step: AutomationStep.MATCH_REMINDER,
      channel,
      source: 'generated',
      title,
      body,
    };
  }

  private previewEscalation(
    match: MatchPreviewContext,
    league: MatchAutomationSweepLeague | null,
    step: AutomationStep,
    channel: MessagePreviewChannel,
  ): Omit<MessagePreviewResult, 'dedupeKey' | 'jobStatus' | 'jobId'> {
    if (!league) {
      return unavailable(step, channel, 'Selecciona una liga para la vista previa.');
    }

    const checkpoint = automationStepToEscalationCheckpoint(step)!;
    const closeMinutes = normalizeClosePredictionMinutes(league.closePredictionMinutes);
    const minutesBeforeKickoff = escalationCheckpointToMinutes(checkpoint, closeMinutes);
    const missing = getMissingMembersForLeague(match, league);
    const activeMembers = league.members.filter((m) => m.status === MemberStatus.ACTIVE).length;

    if (channel === 'waGroup') {
      return {
        step,
        channel,
        source: 'generated',
        title: null,
        body: buildPreMatchEscalationWaCaption({
          leagueName: league.name,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          matchDate: match.matchDate,
          minutesBeforeKickoff,
          closeMinutes,
          missingMembers: missing,
          predictedCount: countPredictionsForLeague(match, league.id),
          totalMembers: activeMembers,
          checkpoint,
        }),
      };
    }

    const msg = buildEscalationUserMessage({
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      matchDate: match.matchDate,
      minutesBeforeKickoff,
      closeMinutes,
      pendingLeagueNames: [league.name],
      checkpoint,
    });

    return { step, channel, source: 'generated', title: msg.title, body: msg.body };
  }

  private previewLiveEvent(
    match: MatchPreviewContext,
    league: MatchAutomationSweepLeague | null,
    step: AutomationStep,
    channel: MessagePreviewChannel,
  ): Omit<MessagePreviewResult, 'dedupeKey' | 'jobStatus' | 'jobId'> {
    const event = automationStepToLiveEvent(step);
    if (!event) return unavailable(step, channel, 'Evento no reconocido.');

    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;

    if (channel === 'waGroup') {
      return {
        step,
        channel,
        source: 'generated',
        title: null,
        body: buildLiveWaCaption({
          event,
          leagueName: league?.name ?? 'Polla',
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          homeScore,
          awayScore,
          elapsed: match.elapsed,
        }),
      };
    }

    const msg = buildLiveUserMessage({
      event,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      homeScore,
      awayScore,
      elapsed: match.elapsed,
    });

    return { step, channel, source: 'generated', title: msg.title, body: msg.body };
  }

  private async previewGoalImpact(
    match: MatchPreviewContext,
    league: MatchAutomationSweepLeague | null,
    channel: MessagePreviewChannel,
  ): Promise<Omit<MessagePreviewResult, 'dedupeKey' | 'jobStatus' | 'jobId'>> {
    if (channel !== 'waGroup') {
      return unavailable(AutomationStep.GOAL_IMPACT, channel, 'Solo disponible para WA Grupo.');
    }
    if (!league || match.homeScore === null || match.awayScore === null) {
      return unavailable(AutomationStep.GOAL_IMPACT, channel, 'Requiere liga y marcador.');
    }

    const summary = (
      await this.goalImpactAnalyzer.summarizeByLeague(
        match.id,
        match.homeScore,
        match.awayScore,
      )
    ).find((s) => s.leagueId === league.id);

    if (!summary) {
      return unavailable(AutomationStep.GOAL_IMPACT, channel, 'Sin predicciones en la liga.');
    }

    return {
      step: AutomationStep.GOAL_IMPACT,
      channel,
      source: 'generated',
      title: null,
      body: buildGoalImpactWaCaption({
        leagueName: league.name,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        elapsed: match.elapsed,
        scoringTeam: null,
        summary,
      }),
    };
  }

  private async previewResult(
    match: MatchPreviewContext,
    league: MatchAutomationSweepLeague | null,
    channel: MessagePreviewChannel,
  ): Promise<Omit<MessagePreviewResult, 'dedupeKey' | 'jobStatus' | 'jobId'>> {
    if (match.homeScore === null || match.awayScore === null) {
      return unavailable(AutomationStep.RESULT_NOTIFICATION, channel, 'Sin marcador final.');
    }

    const predictions = await this.prisma.prediction.findMany({
      where: { matchId: match.id, ...(league ? { leagueId: league.id } : {}) },
      include: { user: { select: { name: true, username: true } } },
      take: 50,
    });

    if (channel === 'waGroup' && league) {
      const entries = predictions.map((p) => ({
        userId: p.userId,
        displayName: p.user.name?.trim() || p.user.username?.trim() || 'Participante',
        points: p.points ?? 0,
        detailType: parseDetailType(p.pointDetail, p.points),
      }));

      return {
        step: AutomationStep.RESULT_NOTIFICATION,
        channel,
        source: 'generated',
        title: null,
        body: buildResultWaCaption({
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          summary: summarizeLeagueResults(league.id, league.name, entries),
        }),
      };
    }

    const points = predictions[0]?.points ?? 0;
    const msg = buildResultUserMessage({
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      matchDate: match.matchDate,
      totalPoints: points,
      totalPollas: 1,
      pollasWithExact: points >= 5 ? 1 : 0,
      maxPoints: points,
    });

    return {
      step: AutomationStep.RESULT_NOTIFICATION,
      channel,
      source: 'generated',
      title: msg.title,
      body: msg.body,
    };
  }

  private async loadMatchContext(matchId: string): Promise<MatchPreviewContext | null> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
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
    if (!match) return null;

    return {
      id: match.id,
      status: match.status,
      matchDate: match.matchDate,
      tournamentId: match.tournamentId,
      venue: match.venue,
      round: match.round,
      predictionReportSentAt: match.predictionReportSentAt,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      elapsed: match.elapsed,
      predictions: match.predictions.map((p) => ({
        userId: p.userId,
        leagueId: p.leagueId,
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        submittedAt: p.submittedAt,
        user: p.user,
      })),
    };
  }

  private async loadLeagueContext(
    leagueId: string,
  ): Promise<MatchAutomationSweepLeague | null> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
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
    return league as MatchAutomationSweepLeague | null;
  }
}

function unavailable(
  step: AutomationStep,
  channel: MessagePreviewChannel,
  body: string,
): Omit<MessagePreviewResult, 'dedupeKey' | 'jobStatus' | 'jobId'> {
  return { step, channel, source: 'unavailable', title: null, body };
}

function parseDetailType(pointDetail: string | null, points: number | null): string {
  if (!pointDetail) return (points ?? 0) >= 5 ? 'EXACT_SCORE' : 'NONE';
  try {
    return (JSON.parse(pointDetail) as { type?: string }).type ?? 'NONE';
  } catch {
    return (points ?? 0) >= 5 ? 'EXACT_SCORE' : 'NONE';
  }
}
