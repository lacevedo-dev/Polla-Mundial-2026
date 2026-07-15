import { Injectable, Logger, Optional } from '@nestjs/common';
import { AutomationStep, EmailJobType, MatchStatus, MemberStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AutomationStepConfigService } from '../automation/config/automation-step-config.service';
import type { AutomationStepChannelId } from '../automation/config/automation-step-catalog';
import { getSchedulerIdForStep } from '../automation/config/automation-step-scheduler.util';
import { AutomationTimingConfigService } from '../automation/config/automation-timing-config.service';
import { AutomationObservabilityService } from '../automation-observability/automation-observability.service';
import {
  getPendingReportMatches,
  getReportAudienceFromLeague,
  MatchAutomationSweepContext,
  MatchAutomationSweepLeague,
} from '../notifications/match-automation-sweep-context';
import { getPredictionReportDueAt } from '../automation/config/automation-timing.util';
import { PrismaService } from '../prisma/prisma.service';
import { PdfReportService } from './pdf-report.service';
import { PredictionReportEmailService, PredictorEntry, ResultEntry, ResultOutcome } from './prediction-report-email.service';
import {
  buildReportMatchInfo,
  mapPredictorEntry,
  mapResultEntry,
  type AdvancePickByUser,
  type ReportMatchSource,
} from './prediction-report.mapper';

export const WA_RESULT_REPORT_EVENT = 'whatsapp.result_report';
export const WA_PREDICTION_REPORT_EVENT = 'whatsapp.prediction_report';

export interface WhatsappReportEvent {
  matchId: string;
  leagueId: string;
}

type PendingReportLeague = {
  id: string;
  name: string;
  code: string;
  closePredictionMinutes: number;
  prefetchedLeague?: MatchAutomationSweepLeague;
};

@Injectable()
export class PredictionReportService {
  private readonly logger = new Logger(PredictionReportService.name);
  private static readonly REPORTABLE_MEMBER_STATUSES = [
    MemberStatus.ACTIVE,
    MemberStatus.PENDING_PAYMENT,
  ] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly observability: AutomationObservabilityService,
    private readonly emailService: PredictionReportEmailService,
    private readonly pdfReport: PdfReportService,
    private readonly timingConfig: AutomationTimingConfigService,
    @Optional() private readonly stepConfig?: AutomationStepConfigService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  private async isReportStepOperational(step: AutomationStep): Promise<boolean> {
    if (!this.stepConfig) return true;
    return this.stepConfig.isStepOperational(step);
  }

  private async isReportChannelEnabled(
    step: AutomationStep,
    channel: AutomationStepChannelId,
  ): Promise<boolean> {
    if (!this.stepConfig) return true;
    const schedulerId = getSchedulerIdForStep(step);
    if (!schedulerId) return false;
    return this.stepConfig.isSchedulerChannelEnabled(schedulerId, channel, step);
  }

  private readonly hasCompletePredictionScores = <
    T extends { homeScore: number | null; awayScore: number | null },
  >(
    prediction: T,
  ): prediction is T & { homeScore: number; awayScore: number } =>
    prediction.homeScore !== null && prediction.awayScore !== null;

  /**
   * Busca matches cuya ventana de predicciones acaba de cerrarse (por liga)
   * y envÃ­a el reporte a todos los miembros activos de cada liga.
   */
async sendPendingReports(
    context?: MatchAutomationSweepContext,
  ): Promise<void> {
    if (!(await this.isReportStepOperational(AutomationStep.PREDICTION_REPORT))) {
      return;
    }

    const emailEnabled = await this.isReportChannelEnabled(
      AutomationStep.PREDICTION_REPORT,
      'email',
    );
    const waGroupEnabled = await this.isReportChannelEnabled(
      AutomationStep.PREDICTION_REPORT,
      'waGroup',
    );
    if (!emailEnabled && !waGroupEnabled) {
      return;
    }

    const now = context?.now ?? new Date();
    const minutesAfterClose =
      await this.timingConfig.getPredictionReportMinutesAfterClose();

    const leagues: PendingReportLeague[] = context
      ? context.activeLeagues.map((league) => ({
          id: league.id,
          name: league.name,
          code: league.code,
          closePredictionMinutes: league.closePredictionMinutes,
          prefetchedLeague: league,
        }))
      : await this.prisma.league.findMany({
          select: {
            id: true,
            name: true,
            code: true,
            closePredictionMinutes: true,
          },
        });

    const matchesData = new Map<string, {
      match: import('./prediction-report-email.service').ReportMatchInfo;
      leaguesData: Array<{
        leagueId: string;
        leagueName: string;
        leagueCode: string;
        predictors: any[];
        standings: Map<string, { points: number; position: number }>;
      }>;
    }>();
    const matchSourcesCache = new Map<string, ReportMatchSource>();

    for (const league of leagues) {
      const matches = context
        ? getPendingReportMatches(
            context,
            league.id,
            league.closePredictionMinutes,
            minutesAfterClose,
          )
        : await this.prisma.match.findMany({
            where: {
              predictionReportSentAt: null,
              matchDate: {
                gt: new Date(now.getTime() - 10 * 60_000),
                lte: new Date(
                  now.getTime() +
                    Math.max(
                      league.closePredictionMinutes,
                      30,
                    ) *
                      60_000,
                ),
              },
              predictions: {
                some: { leagueId: league.id },
              },
            },
            include: {
              homeTeam: true,
              awayTeam: true,
              advancingTeam: { select: { name: true } },
              predictions: {
                where: { leagueId: league.id },
                include: {
                  user: { select: { id: true, name: true, email: true } },
                  advanceTeam: { select: { name: true } },
                },
                orderBy: { submittedAt: 'asc' },
              },
            },
          });

      for (const match of matches) {
        if (
          !context &&
          now.getTime() <
            getPredictionReportDueAt(
              match.matchDate,
              league.closePredictionMinutes,
              minutesAfterClose,
            ).getTime()
        ) {
          continue;
        }

        const leaguePredictions = match.predictions
          .filter((prediction) => prediction.leagueId === league.id)
          .sort(
            (left, right) =>
              left.submittedAt.getTime() - right.submittedAt.getTime(),
          );
        if (leaguePredictions.length === 0) continue;

        const { members, recipients } = await this.getLeagueReportAudience(
          league.id,
          league.prefetchedLeague,
        );
        if (recipients.length === 0) continue;

        const advanceByUser = context
          ? await this.loadAdvancePicksByUser(match.id, league.id)
          : undefined;
        const matchSource = await this.ensureReportMatchSource(match.id, matchSourcesCache);
        if (!matchSource) continue;

        const predictors = leaguePredictions.filter(this.hasCompletePredictionScores).map((prediction) => {
          const member = members.find(
            (leagueMember) => leagueMember.userId === prediction.userId,
          );
          return mapPredictorEntry(
            prediction,
            member,
            matchSource,
            (user, userId) => this.resolvePredictorName(user, userId),
            advanceByUser?.get(prediction.userId),
          );
        });

        const standings = await this.getStandings(league.id);
        const reportMatch = buildReportMatchInfo(matchSource);

        if (!matchesData.has(match.id)) {
          matchesData.set(match.id, {
            match: reportMatch,
            leaguesData: [],
          });
        }

        matchesData.get(match.id)!.leaguesData.push({
          leagueId: league.id,
          leagueName: league.name,
          leagueCode: league.code,
          predictors,
          standings,
        });
      }
    }

    for (const [matchId, data] of matchesData) {
      this.logger.log(
        `Enviando reporte agrupado: ${data.match.homeTeam} vs ${data.match.awayTeam} ` +
          `| ${data.leaguesData.length} pollas`,
      );

      const scheduledAt = this.observability.getScheduledAt(
        AutomationStep.PREDICTION_REPORT,
        {
          matchDate: data.match.matchDate,
          closeMinutes: Math.min(
            ...data.leaguesData.map((entry) => {
              const league = leagues.find((item) => item.id === entry.leagueId);
              return league?.closePredictionMinutes ?? 15;
            }),
          ),
          minutesAfterClose,
          matchStatus: MatchStatus.SCHEDULED,
        },
      );

      try {
        if (emailEnabled) {
          await this.emailService.sendMultiLeaguePredictionsReport({
            matchId,
            match: data.match,
            leaguesData: data.leaguesData,
            sentAt: now,
          });
        }

        await this.prisma.match.update({
          where: { id: matchId },
          data: { predictionReportSentAt: now },
        });

        this.logger.log(
          `Reporte agrupado enviado para match ${matchId}` +
            (emailEnabled ? '' : ' (sin email — solo WA grupo)'),
        );

        if (waGroupEnabled && this.eventEmitter) {
          for (const { leagueId } of data.leaguesData) {
            try {
              this.eventEmitter.emit(WA_PREDICTION_REPORT_EVENT, { matchId, leagueId } satisfies WhatsappReportEvent);
            } catch { /* ignore */ }
          }
        }
} catch (error) {
        this.logger.error(`Error enviando reporte agrupado para match ${matchId}: ${error}`);
      }
    }
  }

  async sendPendingResultReports(limit: number = 3): Promise<void> {
    if (!(await this.isReportStepOperational(AutomationStep.RESULT_REPORT))) {
      return;
    }

    const emailEnabled = await this.isReportChannelEnabled(
      AutomationStep.RESULT_REPORT,
      'email',
    );
    const waGroupEnabled = await this.isReportChannelEnabled(
      AutomationStep.RESULT_REPORT,
      'waGroup',
    );
    if (!emailEnabled && !waGroupEnabled) {
      return;
    }

    const candidates = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.FINISHED,
        homeScore: { not: null },
        awayScore: { not: null },
      },
      select: {
        id: true,
      },
      orderBy: { lastSyncAt: 'desc' },
      take: limit,
    });

    for (const match of candidates) {
      const alreadyQueued = await this.prisma.emailJob.findFirst({
        where: {
          matchId: match.id,
          type: EmailJobType.MATCH_RESULTS_REPORT,
        },
        select: { id: true },
      });

      if (alreadyQueued) {
        continue;
      }

      await this.sendMatchResultsReport(match.id, { emailEnabled, waGroupEnabled });
    }
  }

  /**
   * Genera el reporte para un match/liga especÃƒÂ­fico (para preview o envÃƒÂ­o manual).
   */
  async sendReportForMatch(matchId: string, leagueId: string, testEmail?: string): Promise<void> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        advancingTeam: { select: { name: true } },
        predictions: {
          where: { leagueId },
          include: {
            user: { select: { id: true, name: true, email: true } },
            advanceTeam: { select: { name: true } },
          },
          orderBy: { submittedAt: 'asc' },
        },
      },
    });

    const league = await this.prisma.league.findUniqueOrThrow({
      where: { id: leagueId },
      select: { name: true, code: true },
    });

    const { members, recipients: allRecipients } = await this.getLeagueReportAudience(leagueId);
    const matchSource = this.toReportMatchSource(match);

    const predictors = match.predictions.filter(this.hasCompletePredictionScores).map(p => {
      const member = members.find(m => m.userId === p.userId);
      return mapPredictorEntry(
        p,
        member,
        matchSource,
        (user, userId) => this.resolvePredictorName(user, userId),
      );
    });

    const standings = await this.getStandings(leagueId);
    const recipients = testEmail ? [testEmail] : allRecipients;

    await this.emailService.sendPredictionsReport({
      recipients,
      leagueName: league.name,
      leagueCode: league.code,
      leagueId,
      matchId,
      match: buildReportMatchInfo(matchSource),
      predictors,
      standings,
      sentAt: new Date(),
    });
  }

  async getPreviewHtml(matchId: string, leagueId: string): Promise<string> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        advancingTeam: { select: { name: true } },
        predictions: {
          where: { leagueId },
          include: {
            user: { select: { id: true, name: true, email: true } },
            advanceTeam: { select: { name: true } },
          },
          orderBy: { submittedAt: 'asc' },
        },
      },
    });

    const league = await this.prisma.league.findUniqueOrThrow({
      where: { id: leagueId },
      select: { name: true, code: true },
    });

    const { members } = await this.getLeagueReportAudience(leagueId);
    const matchSource = this.toReportMatchSource(match);

    const predictors = match.predictions.filter(this.hasCompletePredictionScores).map(p => {
      const member = members.find(m => m.userId === p.userId);
      return mapPredictorEntry(
        p,
        member,
        matchSource,
        (user, userId) => this.resolvePredictorName(user, userId),
      );
    });

    const standings = await this.getStandings(leagueId);

    return this.emailService.buildHtml({
      leagueName: league.name,
      leagueCode: league.code,
      match: buildReportMatchInfo(matchSource),
      predictors,
      standings,
      sentAt: new Date(),
    });
  }

  /**
   * EnvÃƒÂ­a el correo de resultados automÃƒÂ¡ticamente cuando un partido termina.
   * Llamado desde MatchSyncService despuÃƒÂ©s de calcular los puntos.
   */
  async sendMatchResultsReport(
    matchId: string,
    channelOptions?: { emailEnabled?: boolean; waGroupEnabled?: boolean },
  ): Promise<void> {
    if (!(await this.isReportStepOperational(AutomationStep.RESULT_REPORT))) {
      return;
    }

    const emailEnabled =
      channelOptions?.emailEnabled ??
      (await this.isReportChannelEnabled(AutomationStep.RESULT_REPORT, 'email'));
    const waGroupEnabled =
      channelOptions?.waGroupEnabled ??
      (await this.isReportChannelEnabled(AutomationStep.RESULT_REPORT, 'waGroup'));
    if (!emailEnabled && !waGroupEnabled) {
      return;
    }

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        advancingTeam: { select: { name: true } },
      },
    });
    if (!match || match.homeScore === null || match.awayScore === null) return;

    const realHome = match.homeScore;
    const realAway = match.awayScore;
    const matchSource = this.toReportMatchSource(match);
    const reportMatch = {
      ...buildReportMatchInfo(matchSource, { includeResult: true }),
      homeScore: realHome,
      awayScore: realAway,
    };

    // Recopilar todas las ligas con predicciones para este partido
    const leagueRows = await this.prisma.prediction.findMany({
      where: { matchId },
      select: { leagueId: true },
      distinct: ['leagueId'],
    });

    // Construir datos por liga
    const leaguesData: Array<{
      leagueId: string;
      leagueName: string;
      leagueCode: string;
      results: import('./prediction-report-email.service').ResultEntry[];
    }> = [];

    for (const { leagueId } of leagueRows) {
      const league = await this.prisma.league.findUnique({
        where: { id: leagueId },
        select: { name: true, code: true },
      });
      if (!league) continue;

      const { members } = await this.getLeagueReportAudience(leagueId);

      const predictions = await this.prisma.prediction.findMany({
        where: { matchId, leagueId, points: { not: null } },
        include: {
          user: { select: { id: true, name: true, email: true } },
          advanceTeam: { select: { name: true } },
        },
        orderBy: { submittedAt: 'asc' },
      });
      if (predictions.length === 0) continue;

      const prevPreds = await this.prisma.prediction.findMany({
        where: { leagueId, points: { not: null }, matchId: { not: matchId } },
        select: { userId: true, points: true },
      });
      const prevTotals = new Map<string, number>();
      for (const p of prevPreds) prevTotals.set(p.userId, (prevTotals.get(p.userId) ?? 0) + (p.points ?? 0));

      const afterTotals = new Map<string, number>(prevTotals);
      for (const p of predictions) afterTotals.set(p.userId, (afterTotals.get(p.userId) ?? 0) + (p.points ?? 0));

      const prevStandings  = new Map([...prevTotals.entries()].sort((a, b) => b[1] - a[1]).map(([uid, pts], i) => [uid, { points: pts, position: i + 1 }]));
      const afterStandings = new Map([...afterTotals.entries()].sort((a, b) => b[1] - a[1]).map(([uid, pts], i) => [uid, { points: pts, position: i + 1 }]));

      const results = predictions.filter(this.hasCompletePredictionScores).map(p => {
        const member  = members.find(m => m.userId === p.userId);
        return mapResultEntry(
          p,
          member,
          matchSource,
          (user, userId) => this.resolvePredictorName(user, userId),
          (pointDetail, points) => this.parseOutcomeFromDetail(pointDetail, points),
          {
            pointsEarned: p.points ?? 0,
            totalPoints: afterStandings.get(p.userId)?.points ?? 0,
            prevPosition: prevStandings.get(p.userId)?.position ?? 99,
            newPosition: afterStandings.get(p.userId)?.position ?? 99,
          },
        );
      });

      leaguesData.push({ leagueId, leagueName: league.name, leagueCode: league.code, results });
    }

    if (leaguesData.length === 0) return;

    this.logger.log(
      `Enviando correo de resultados: ${match.homeTeam.name} ${realHome}-${realAway} ${match.awayTeam.name} | ${leaguesData.length} polla(s)`,
    );

    const scheduledAt = this.observability.getScheduledAt(
      AutomationStep.RESULT_REPORT,
      { matchDate: match.matchDate, closeMinutes: null, matchStatus: MatchStatus.FINISHED },
    );
    const runId = await this.observability.startRun({
      step: AutomationStep.RESULT_REPORT,
      matchId,
      leagueId: leaguesData.map(l => l.leagueId).join(','),
      scheduledAt,
      audienceCount: leaguesData.reduce((s, l) => s + l.results.length, 0),
      summary: `Preparando reporte multi-liga de resultados (${leaguesData.length} polla(s))`,
    });

    try {
      if (emailEnabled) {
        await this.emailService.sendMultiLeagueResultsReport({
          matchId,
          match: reportMatch,
          leaguesData,
          sentAt: new Date(),
        });
      }

      const totalRecipients = leaguesData.reduce((s, l) => s + l.results.length, 0);
      await this.observability.finishRun(runId, {
        status: 'SUCCESS',
        summary: emailEnabled
          ? `Reporte de resultados enviado (${leaguesData.length} polla(s), ~${totalRecipients} participantes)`
          : `Reporte WA grupo encolado (${leaguesData.length} polla(s))`,
        deliveredCount: emailEnabled ? totalRecipients : 0,
        details: { matchId, leagues: leaguesData.map(l => l.leagueCode), emailEnabled, waGroupEnabled },
      });

      if (waGroupEnabled && this.eventEmitter) {
        for (const { leagueId } of leaguesData) {
          try {
            this.eventEmitter.emit(WA_RESULT_REPORT_EVENT, { matchId, leagueId } satisfies WhatsappReportEvent);
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      await this.observability.failRun(
        runId, error,
        { matchId, leagues: leaguesData.map(l => l.leagueCode) },
        'Falló el envío del reporte multi-liga de resultados.',
      );
      throw error;
    }
  }

  async getPreviewStartHtml(matchId: string): Promise<string> {
    const firstPrediction = await this.prisma.prediction.findFirst({
      where: { matchId },
      select: { leagueId: true },
    });
    if (!firstPrediction) return '<p style="font-family:sans-serif;padding:2rem">No hay predicciones para este partido.</p>';
    return this.getPreviewHtml(matchId, firstPrediction.leagueId);
  }

  async getMatchLeagues(matchId: string): Promise<{ id: string; name: string; code: string }[]> {
    const leagueIds = await this.prisma.prediction.findMany({
      where: { matchId },
      select: { leagueId: true },
      distinct: ['leagueId'],
    });
    const leagues = await Promise.all(
      leagueIds.map(({ leagueId }) =>
        this.prisma.league.findUnique({
          where: { id: leagueId },
          select: { id: true, name: true, code: true },
        }),
      ),
    );
    return leagues.filter(Boolean) as { id: string; name: string; code: string }[];
  }

  async getPreviewResultsHtml(matchId: string): Promise<string> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        advancingTeam: { select: { name: true } },
      },
    });
    if (match.homeScore === null || match.awayScore === null) {
      return '<p style="font-family:sans-serif;padding:2rem">Este partido no tiene resultado registrado.</p>';
    }

    const firstPrediction = await this.prisma.prediction.findFirst({
      where: { matchId, points: { not: null } },
      select: { leagueId: true },
    });
    if (!firstPrediction) {
      return '<p style="font-family:sans-serif;padding:2rem">No hay predicciones con puntos calculados para este partido.</p>';
    }

    return this.getPreviewResultsHtmlForLeague(matchId, firstPrediction.leagueId);
  }

  async getPreviewResultsHtmlForLeague(matchId: string, leagueId: string): Promise<string> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        advancingTeam: { select: { name: true } },
      },
    });
    if (match.homeScore === null || match.awayScore === null) {
      return '<p style="font-family:sans-serif;padding:2rem">Este partido no tiene resultado registrado.</p>';
    }

    const league = await this.prisma.league.findUniqueOrThrow({
      where: { id: leagueId },
      select: { name: true, code: true },
    });

    const matchSource = this.toReportMatchSource(match);
    const results = await this.buildLeagueResultEntries(matchId, leagueId, matchSource);
    if (results.length === 0) {
      return '<p style="font-family:sans-serif;padding:2rem">No hay predicciones con puntos calculados para esta polla.</p>';
    }

    return this.emailService.buildResultHtml({
      leagueName: league.name,
      leagueCode: league.code,
      match: {
        ...buildReportMatchInfo(matchSource, { includeResult: true }),
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      },
      results,
      sentAt: new Date(),
    });
  }

  async resendPredictionsReport(matchId: string): Promise<{ leagues: number; recipients: number }> {
    const leagueIds = await this.prisma.prediction.findMany({
      where: { matchId },
      select: { leagueId: true },
      distinct: ['leagueId'],
    });

    let recipients = 0;
    for (const { leagueId } of leagueIds) {
      const { recipients: leagueRecipients } = await this.getLeagueReportAudience(leagueId);
      if (!leagueRecipients.length) continue;
      await this.sendReportForMatch(matchId, leagueId);
      recipients += leagueRecipients.length;
    }

    return { leagues: leagueIds.length, recipients };
  }

  async resendResultsReport(matchId: string): Promise<{ leagues: number; recipients: number }> {
    const leagueIds = await this.prisma.prediction.findMany({
      where: { matchId },
      select: { leagueId: true },
      distinct: ['leagueId'],
    });

    const recipientCounts = await Promise.all(
      leagueIds.map(async ({ leagueId }) => {
        const { recipients } = await this.getLeagueReportAudience(leagueId);
        return recipients.length;
      }),
    );

    await this.sendMatchResultsReport(matchId);

    return {
      leagues: leagueIds.length,
      recipients: recipientCounts.reduce((sum, count) => sum + count, 0),
    };
  }

  private parseOutcomeFromDetail(pointDetail: string | null, points: number | null): ResultOutcome {
    if (pointDetail) {
      try {
        const detail = JSON.parse(pointDetail) as { type: string; uniqueBonus?: number };
        if (detail.type === 'EXACT_SCORE' && (detail.uniqueBonus ?? 0) > 0) return 'EXACT_UNIQUE';
        if (detail.type === 'EXACT_SCORE')         return 'EXACT';
        if (detail.type === 'CORRECT_WINNER_GOAL') return 'WINNER_GOAL';
        if (detail.type === 'CORRECT_WINNER')      return 'WINNER';
        if (detail.type === 'TEAM_GOALS')          return 'GOAL';
        // Legacy: CORRECT_DIFF was old name for winner+diff, treat as WINNER
        if (detail.type === 'CORRECT_DIFF')        return 'WINNER';
      } catch (_) { /* pointDetail malformado */ }
    }
    // Fallback for predictions without pointDetail
    return (points ?? 0) > 0 ? 'WINNER' : 'WRONG';
  }

  private resolvePredictorName(
    user: { name: string | null; email?: string | null },
    userId: string,
  ): string {
    return user.name ?? user.email ?? userId;
  }

  private toReportMatchSource(match: {
    homeTeamId: string;
    awayTeamId: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    matchDate: Date;
    venue?: string | null;
    round?: string | null;
    phase: string;
    homeScore?: number | null;
    awayScore?: number | null;
    penaltyHomeScore?: number | null;
    penaltyAwayScore?: number | null;
    advancingTeamId?: string | null;
    advancingTeam?: { name: string } | null;
  }): ReportMatchSource {
    return {
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      matchDate: match.matchDate,
      venue: match.venue,
      round: match.round,
      phase: match.phase,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      penaltyHomeScore: match.penaltyHomeScore,
      penaltyAwayScore: match.penaltyAwayScore,
      advancingTeamId: match.advancingTeamId,
      advancingTeam: match.advancingTeam,
    };
  }

  private async loadReportMatchSource(matchId: string): Promise<ReportMatchSource | null> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        matchDate: true,
        venue: true,
        round: true,
        phase: true,
        homeScore: true,
        awayScore: true,
        penaltyHomeScore: true,
        penaltyAwayScore: true,
        advancingTeamId: true,
        advancingTeam: { select: { name: true } },
      },
    });
    return match ? this.toReportMatchSource(match) : null;
  }

  private async ensureReportMatchSource(
    matchId: string,
    cache: Map<string, ReportMatchSource>,
  ): Promise<ReportMatchSource | null> {
    if (cache.has(matchId)) return cache.get(matchId)!;
    const loaded = await this.loadReportMatchSource(matchId);
    if (loaded) cache.set(matchId, loaded);
    return loaded;
  }

  private async loadAdvancePicksByUser(
    matchId: string,
    leagueId: string,
  ): Promise<AdvancePickByUser> {
    const rows = await this.prisma.prediction.findMany({
      where: { matchId, leagueId },
      select: {
        userId: true,
        advanceTeamId: true,
        advanceTeam: { select: { name: true } },
      },
    });
    return new Map(
      rows.map((row) => [
        row.userId,
        {
          advanceTeamId: row.advanceTeamId,
          advanceTeamName: row.advanceTeam?.name ?? null,
        },
      ]),
    );
  }

  private async buildLeagueResultEntries(
    matchId: string,
    leagueId: string,
    matchSource: ReportMatchSource,
  ): Promise<ResultEntry[]> {
    const { members } = await this.getLeagueReportAudience(leagueId);
    const predictions = await this.prisma.prediction.findMany({
      where: { matchId, leagueId, points: { not: null } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        advanceTeam: { select: { name: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    const prevPreds = await this.prisma.prediction.findMany({
      where: { leagueId, points: { not: null }, matchId: { not: matchId } },
      select: { userId: true, points: true },
    });
    const prevTotals = new Map<string, number>();
    for (const p of prevPreds) prevTotals.set(p.userId, (prevTotals.get(p.userId) ?? 0) + (p.points ?? 0));

    const afterTotals = new Map<string, number>(prevTotals);
    for (const p of predictions) afterTotals.set(p.userId, (afterTotals.get(p.userId) ?? 0) + (p.points ?? 0));

    const sortedPrev  = [...prevTotals.entries()].sort((a, b) => b[1] - a[1]);
    const sortedAfter = [...afterTotals.entries()].sort((a, b) => b[1] - a[1]);
    const prevStandings  = new Map(sortedPrev.map(([uid, pts], i)  => [uid, { points: pts, position: i + 1 }]));
    const afterStandings = new Map(sortedAfter.map(([uid, pts], i) => [uid, { points: pts, position: i + 1 }]));

    return predictions.filter(this.hasCompletePredictionScores).map((p) => {
      const member = members.find((m) => m.userId === p.userId);
      return mapResultEntry(
        p,
        member,
        matchSource,
        (user, userId) => this.resolvePredictorName(user, userId),
        (pointDetail, points) => this.parseOutcomeFromDetail(pointDetail, points),
        {
          pointsEarned: p.points ?? 0,
          totalPoints: afterStandings.get(p.userId)?.points ?? 0,
          prevPosition: prevStandings.get(p.userId)?.position ?? 99,
          newPosition: afterStandings.get(p.userId)?.position ?? 99,
        },
      );
    });
  }

  private async getStandings(leagueId: string): Promise<Map<string, { points: number; position: number }>> {
    const predictions = await this.prisma.prediction.findMany({
      where: { leagueId, points: { not: null } },
      select: { userId: true, points: true },
    });

    const totals = new Map<string, number>();
    for (const p of predictions) {
      totals.set(p.userId, (totals.get(p.userId) ?? 0) + (p.points ?? 0));
    }

    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const result = new Map<string, { points: number; position: number }>();
    sorted.forEach(([userId, points], idx) => {
      result.set(userId, { points, position: idx + 1 });
    });
    return result;
  }

  async getPredictionsPdfBuffer(matchId: string, leagueId: string): Promise<Buffer> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        advancingTeam: { select: { name: true } },
        predictions: {
          where: { leagueId },
          include: {
            user: { select: { id: true, name: true, email: true } },
            advanceTeam: { select: { name: true } },
          },
          orderBy: { submittedAt: 'asc' },
        },
      },
    });

    const league = await this.prisma.league.findUniqueOrThrow({
      where: { id: leagueId },
      select: { name: true, code: true },
    });

    const { members } = await this.getLeagueReportAudience(leagueId);
    const matchSource = this.toReportMatchSource(match);

    const predictors = match.predictions.filter(this.hasCompletePredictionScores).map(p => {
      const member = members.find(m => m.userId === p.userId);
      return mapPredictorEntry(
        p,
        member,
        matchSource,
        (user, userId) => this.resolvePredictorName(user, userId),
      );
    });

    const standings = await this.getStandings(leagueId);

    return this.pdfReport.buildPredictionsReportPdf({
      match: buildReportMatchInfo(matchSource),
      leaguesData: [{ leagueName: league.name, leagueCode: league.code, predictors, standings }],
      sentAt: new Date(),
    });
  }

  async getResultsPdfBuffer(matchId: string, leagueId: string): Promise<Buffer> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        advancingTeam: { select: { name: true } },
      },
    });
    if (match.homeScore === null || match.awayScore === null) {
      throw new Error('Este partido no tiene resultado registrado.');
    }

    const league = await this.prisma.league.findUniqueOrThrow({
      where: { id: leagueId },
      select: { name: true, code: true },
    });

    const matchSource = this.toReportMatchSource(match);
    const results = await this.buildLeagueResultEntries(matchId, leagueId, matchSource);
    if (results.length === 0) {
      throw new Error('No hay predicciones con puntos calculados para esta polla.');
    }

    return this.pdfReport.buildResultsReportPdf({
      match: {
        ...buildReportMatchInfo(matchSource, { includeResult: true }),
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      },
      leagueName: league.name,
      leagueCode: league.code,
      results,
      sentAt: new Date(),
    });
  }

  async getLeagueAudience(leagueId: string) {
    return this.getLeagueReportAudience(leagueId);
  }

  /**
   * Returns structured results data for a league+match (used by WhatsApp group publisher).
   */
  async getResultsDataForLeague(matchId: string, leagueId: string): Promise<{
    match: import('./prediction-report-email.service').ReportMatchInfo & {
      homeScore: number;
      awayScore: number;
    };
    results: ResultEntry[];
  }> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        advancingTeam: { select: { name: true } },
      },
    });
    if (match.homeScore === null || match.awayScore === null) {
      throw new Error('Este partido no tiene resultado registrado.');
    }

    const matchSource = this.toReportMatchSource(match);
    const results = await this.buildLeagueResultEntries(matchId, leagueId, matchSource);

    return {
      match: {
        ...buildReportMatchInfo(matchSource, { includeResult: true }),
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      },
      results,
    };
  }

  /**
   * Returns structured predictors data for a league+match (used by WhatsApp group publisher).
   */
  async getPredictionsDataForLeague(matchId: string, leagueId: string): Promise<{
    match: import('./prediction-report-email.service').ReportMatchInfo;
    predictors: PredictorEntry[];
  }> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        advancingTeam: { select: { name: true } },
        predictions: {
          where: { leagueId },
          include: {
            user: { select: { id: true, name: true, email: true } },
            advanceTeam: { select: { name: true } },
          },
          orderBy: { submittedAt: 'asc' },
        },
      },
    });

    const { members } = await this.getLeagueReportAudience(leagueId);
    const matchSource = this.toReportMatchSource(match);

    const predictors = match.predictions.filter(this.hasCompletePredictionScores).map(p => {
      const member = members.find(m => m.userId === p.userId);
      return mapPredictorEntry(
        p,
        member,
        matchSource,
        (user, userId) => this.resolvePredictorName(user, userId),
      );
    });

    return {
      match: buildReportMatchInfo(matchSource),
      predictors,
    };
  }

  private async getLeagueReportAudience(
    leagueId: string,
    prefetchedLeague?: MatchAutomationSweepLeague,
  ) {
    if (prefetchedLeague) {
      return getReportAudienceFromLeague(prefetchedLeague);
    }

    const members = await this.prisma.leagueMember.findMany({
      where: {
        leagueId,
        status: { in: [...PredictionReportService.REPORTABLE_MEMBER_STATUSES] },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const recipients = [...new Set(
      members
        .map((member) => member.user.email)
        .filter(Boolean) as string[],
    )];

    return { members, recipients };
  }
}
