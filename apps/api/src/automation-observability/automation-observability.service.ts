import { Injectable, Logger } from '@nestjs/common';
import {
  AutomationRun,
  AutomationRunStatus,
  AutomationRunTrigger,
  AutomationStep,
  MatchStatus,
  Prisma,
  SyncLogStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type StepState =
  | 'NOT_APPLICABLE'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'WARNING'
  | 'FAILED'
  | 'SKIPPED'
  | 'OVERDUE'
  | 'MANUAL';

type OperationSyncStatus = Exclude<StepState, 'NOT_APPLICABLE' | 'MANUAL'>;

type StepScheduledContext = {
  matchDate: Date;
  closeMinutes: number | null;
  matchStatus: MatchStatus;
};

type StartRunInput = {
  step: AutomationStep;
  matchId: string;
  leagueId?: string | null;
  scheduledAt?: Date | null;
  trigger?: AutomationRunTrigger;
  correlationId?: string | null;
  summary?: string | null;
  details?: Prisma.InputJsonValue | null;
  audienceCount?: number | null;
};

type FinishRunInput = {
  status: Exclude<AutomationRunStatus, 'RUNNING'>;
  summary?: string | null;
  errorMessage?: string | null;
  details?: Prisma.InputJsonValue | null;
  deliveredCount?: number | null;
  failedCount?: number | null;
  warningCount?: number | null;
};

@Injectable()
export class AutomationObservabilityService {
  private readonly logger = new Logger(AutomationObservabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async startRun(input: StartRunInput): Promise<string | null> {
    try {
      const run = await this.prisma.automationRun.create({
        data: {
          step: input.step,
          status: AutomationRunStatus.RUNNING,
          trigger: input.trigger ?? AutomationRunTrigger.SCHEDULER,
          matchId: input.matchId,
          leagueId: input.leagueId ?? null,
          scheduledAt: input.scheduledAt ?? null,
          startedAt: new Date(),
          correlationId: input.correlationId ?? null,
          summary: input.summary ?? null,
          details: input.details ? JSON.stringify(input.details) : null,
          audienceCount: input.audienceCount ?? null,
        },
      });

      return run.id;
    } catch (error) {
      this.logger.warn(
        `No pude registrar inicio de observabilidad (${input.step}) para match ${input.matchId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async finishRun(runId: string | null, input: FinishRunInput): Promise<void> {
    if (!runId) {
      return;
    }

    try {
      await this.prisma.automationRun.update({
        where: { id: runId },
        data: {
          status: input.status,
          finishedAt: new Date(),
          summary: input.summary ?? null,
          errorMessage: input.errorMessage ?? null,
          details: input.details ? JSON.stringify(input.details) : null,
          deliveredCount: input.deliveredCount ?? null,
          failedCount: input.failedCount ?? null,
          warningCount: input.warningCount ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `No pude cerrar observabilidad ${runId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async failRun(
    runId: string | null,
    error: unknown,
    details?: Prisma.InputJsonValue | null,
    summary?: string | null,
  ): Promise<void> {
    await this.finishRun(runId, {
      status: AutomationRunStatus.FAILED,
      summary,
      errorMessage: error instanceof Error ? error.message : String(error),
      details: details ?? null,
    });
  }

  getScheduledAt(step: AutomationStep, context: StepScheduledContext): Date | null {
    const { matchDate, closeMinutes, matchStatus } = context;

    switch (step) {
      case AutomationStep.MATCH_REMINDER:
        return new Date(matchDate.getTime() - 60 * 60 * 1000);
      case AutomationStep.PREDICTION_CLOSING:
      case AutomationStep.PREDICTION_REPORT:
        return new Date(matchDate.getTime() - (closeMinutes ?? 15) * 60 * 1000);
      case AutomationStep.RESULT_NOTIFICATION:
      case AutomationStep.RESULT_REPORT:
        if (matchStatus !== MatchStatus.FINISHED) {
          return new Date(matchDate.getTime() + 130 * 60 * 1000);
        }
        return new Date(matchDate.getTime() + 130 * 60 * 1000);
      default:
        return null;
    }
  }

  async getDailyOperations(dateKey?: string) {
    const normalizedDateKey = dateKey ?? this.getBogotaDateKey();
    const { dayStart, dayEnd, carryOverStart } = this.getOperationalWindow(normalizedDateKey);
    const now = new Date();

    const matches = await this.prisma.match.findMany({
      where: {
        OR: [
          { matchDate: { gte: dayStart, lte: dayEnd } },
          {
            matchDate: { gte: carryOverStart, lt: dayStart },
            OR: [
              { status: { in: [MatchStatus.SCHEDULED, MatchStatus.LIVE] } },
              { status: MatchStatus.FINISHED, resultNotificationSentAt: null },
              { status: MatchStatus.FINISHED, predictionReportSentAt: null },
            ],
          },
        ],
      },
      select: {
        id: true,
        matchDate: true,
        status: true,
        round: true,
        predictionReportSentAt: true,
        resultNotificationSentAt: true,
        tournament: { select: { name: true } },
        homeTeam: { select: { name: true, code: true } },
        awayTeam: { select: { name: true, code: true } },
        predictions: {
          select: {
            leagueId: true,
          },
        },
        tournamentId: true,
      },
      orderBy: { matchDate: 'asc' },
    });

    if (matches.length === 0) {
      return { date: normalizedDateKey, matches: [] };
    }

    const matchIds = matches.map((match) => match.id);
    const [activeLeagues, runs, syncLogs] = await Promise.all([
      this.prisma.league.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          code: true,
          name: true,
          closePredictionMinutes: true,
          leagueTournaments: {
            select: { tournamentId: true },
          },
        },
      }),
      this.prisma.automationRun.findMany({
        where: { matchId: { in: matchIds } },
        include: {
          league: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.footballSyncLog.findMany({
        where: {
          matchId: { in: matchIds },
          createdAt: {
            gte: new Date(carryOverStart.getTime() - 6 * 60 * 60 * 1000),
            lte: new Date(dayEnd.getTime() + 6 * 60 * 60 * 1000),
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);

    const runsByMatch = new Map<string, Array<AutomationRun & { league: { id: string; code: string; name: string } | null }>>();
    for (const run of runs as Array<AutomationRun & { league: { id: string; code: string; name: string } | null }>) {
      if (!runsByMatch.has(run.matchId)) {
        runsByMatch.set(run.matchId, []);
      }
      runsByMatch.get(run.matchId)?.push(run);
    }

    const syncLogsByMatch = new Map<string, typeof syncLogs>();
    for (const log of syncLogs) {
      if (!log.matchId) {
        continue;
      }
      if (!syncLogsByMatch.has(log.matchId)) {
        syncLogsByMatch.set(log.matchId, []);
      }
      syncLogsByMatch.get(log.matchId)?.push(log);
    }

    const operations = matches.map((match) => {
      const relevantLeagues = activeLeagues
        .filter((league) => {
          if (league.leagueTournaments.length === 0) {
            return true;
          }
          return league.leagueTournaments.some(
            (entry) => entry.tournamentId === match.tournamentId,
          );
        })
        .map((league) => ({
          id: league.id,
          code: league.code,
          name: league.name,
          closePredictionMinutes: league.closePredictionMinutes ?? 15,
        }));

      const closeMinutes =
        relevantLeagues.length > 0
          ? Math.min(...relevantLeagues.map((league) => league.closePredictionMinutes))
          : 15;
      const matchRuns = runsByMatch.get(match.id) ?? [];
      const matchSyncLogs = syncLogsByMatch.get(match.id) ?? [];
      const sync = this.buildSyncSummary(matchSyncLogs, now);

      const steps = [
        AutomationStep.MATCH_REMINDER,
        AutomationStep.PREDICTION_CLOSING,
        AutomationStep.RESULT_NOTIFICATION,
        AutomationStep.PREDICTION_REPORT,
        AutomationStep.RESULT_REPORT,
      ].map((step) =>
        this.buildStepSummary({
          step,
          match,
          matchRuns,
          relevantLeagues,
          closeMinutes,
          now,
        }),
      );

      return {
        id: match.id,
        trackingScope: match.matchDate < dayStart ? 'CARRY_OVER' : 'TODAY',
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeTeamCode: match.homeTeam.code,
        awayTeamCode: match.awayTeam.code,
        matchDate: match.matchDate.toISOString(),
        status: match.status,
        tournament: match.tournament?.name ?? null,
        overallStatus: this.combineStatuses([
          sync.status,
          ...steps.map((step) => step.status),
        ]),
        sync,
        steps,
      };
    });

    return {
      date: normalizedDateKey,
      generatedAt: now.toISOString(),
      matches: operations,
    };
  }

  private buildSyncSummary(
    logs: Array<{
      id: string;
      status: SyncLogStatus;
      message: string;
      duration: number | null;
      requestsUsed: number;
      createdAt: Date;
      details: string | null;
      error: string | null;
      type: string;
    }>,
    now: Date,
  ) {
    const recentLogs = logs.slice(0, 5).map((log) => ({
      id: log.id,
      type: log.type,
      status: log.status,
      message: log.message,
      error: log.error,
      details: log.details,
      startedAt: log.createdAt.toISOString(),
      finishedAt: log.duration ? new Date(log.createdAt.getTime() + log.duration).toISOString() : null,
      durationMs: log.duration,
      requestsUsed: log.requestsUsed,
    }));

    const latest = recentLogs[0];
    if (!latest) {
      return {
        status: 'SCHEDULED' as OperationSyncStatus,
        lastStartedAt: null,
        lastFinishedAt: null,
        durationMs: null,
        summary: 'Sin sincronizaciones registradas en la ventana operativa.',
        errorMessage: null,
        recentLogs: [],
      };
    }

    return {
      status: this.mapSyncStatus(latest.status),
      lastStartedAt: latest.startedAt,
      lastFinishedAt: latest.finishedAt,
      durationMs: latest.durationMs,
      summary: latest.message,
      errorMessage: latest.error,
      recentLogs,
      staleMinutes: Math.max(
        0,
        Math.floor((now.getTime() - new Date(latest.startedAt).getTime()) / 60000),
      ),
    };
  }

  private buildStepSummary(params: {
    step: AutomationStep;
    match: {
      id: string;
      matchDate: Date;
      status: MatchStatus;
      predictionReportSentAt: Date | null;
      resultNotificationSentAt: Date | null;
    };
    matchRuns: Array<AutomationRun & { league: { id: string; code: string; name: string } | null }>;
    relevantLeagues: Array<{ id: string; code: string; name: string; closePredictionMinutes: number }>;
    closeMinutes: number;
    now: Date;
  }) {
    const scheduledAt = this.getScheduledAt(params.step, {
      matchDate: params.match.matchDate,
      closeMinutes: params.closeMinutes,
      matchStatus: params.match.status,
    });

    const stepRuns = params.matchRuns.filter((run) => run.step === params.step);
    const leagueLatest = new Map<string, AutomationRun & { league: { id: string; code: string; name: string } | null }>();
    for (const run of stepRuns) {
      const key = run.leagueId ?? '__MATCH__';
      if (!leagueLatest.has(key)) {
        leagueLatest.set(key, run);
      }
    }

    const perLeague = [...leagueLatest.values()]
      .filter((run) => run.leagueId)
      .map((run) => ({
        runId: run.id,
        leagueId: run.leagueId!,
        leagueCode: run.league?.code ?? 'N/A',
        leagueName: run.league?.name ?? 'Liga desconocida',
        status: this.mapRunToStepState(run.status, run.trigger),
        scheduledAt: run.scheduledAt?.toISOString() ?? scheduledAt?.toISOString() ?? null,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        summary: run.summary,
        errorMessage: run.errorMessage,
        trigger: run.trigger,
        audienceCount: run.audienceCount,
        deliveredCount: run.deliveredCount,
        failedCount: run.failedCount,
        warningCount: run.warningCount,
        details: run.details,
      }));

    const overallStatus =
      stepRuns.length > 0
        ? this.combineStatuses(
            [...leagueLatest.values()].map((run) =>
              this.mapRunToStepState(run.status, run.trigger),
            ),
          )
        : this.deriveExpectedStatus(
            params.step,
            params.match.status,
            scheduledAt,
            params.now,
          );

    const latestRun = stepRuns[0];

    return {
      key: params.step,
      label: this.getStepLabel(params.step),
      status: overallStatus,
      scheduledAt: scheduledAt?.toISOString() ?? null,
      lastStartedAt: latestRun?.startedAt.toISOString() ?? null,
      lastFinishedAt: latestRun?.finishedAt?.toISOString() ?? null,
      summary: latestRun?.summary ?? this.getDerivedSummary(overallStatus),
      errorMessage: latestRun?.errorMessage ?? null,
      trigger: latestRun?.trigger ?? AutomationRunTrigger.SCHEDULER,
      leagues: perLeague,
      latestDetails: latestRun?.details ?? null,
      recentRuns: stepRuns.slice(0, 5).map((run) => ({
        runId: run.id,
        leagueId: run.leagueId,
        leagueCode: run.league?.code ?? null,
        leagueName: run.league?.name ?? null,
        status: this.mapRunToStepState(run.status, run.trigger),
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        summary: run.summary,
        errorMessage: run.errorMessage,
        trigger: run.trigger,
      })),
      relevantLeagueCount: params.relevantLeagues.length,
    };
  }

  private deriveExpectedStatus(
    step: AutomationStep,
    matchStatus: MatchStatus,
    scheduledAt: Date | null,
    now: Date,
  ): StepState {
    if (
      (step === AutomationStep.RESULT_NOTIFICATION ||
        step === AutomationStep.RESULT_REPORT) &&
      matchStatus !== MatchStatus.FINISHED
    ) {
      return scheduledAt && now < scheduledAt ? 'SCHEDULED' : 'NOT_APPLICABLE';
    }

    if (!scheduledAt) {
      return 'NOT_APPLICABLE';
    }

    if (now < scheduledAt) {
      return 'SCHEDULED';
    }

    return 'OVERDUE';
  }

  private combineStatuses(statuses: Array<string | null | undefined>): StepState {
    const filtered = statuses.filter(Boolean) as StepState[];
    if (filtered.includes('FAILED') || filtered.includes('OVERDUE')) return 'FAILED';
    if (filtered.includes('WARNING')) return 'WARNING';
    if (filtered.includes('RUNNING')) return 'RUNNING';
    if (filtered.includes('MANUAL')) return 'MANUAL';
    if (filtered.includes('SUCCESS')) return 'SUCCESS';
    if (filtered.includes('SKIPPED')) return 'SKIPPED';
    if (filtered.includes('SCHEDULED')) return 'SCHEDULED';
    return 'NOT_APPLICABLE';
  }

  private getDerivedSummary(status: StepState): string {
    switch (status) {
      case 'SCHEDULED':
        return 'Programado, aún dentro de la ventana esperada.';
      case 'OVERDUE':
      case 'FAILED':
        return 'La automatización debía ejecutarse y no hay evidencia de éxito.';
      case 'NOT_APPLICABLE':
        return 'No aplica todavía para el estado actual del partido.';
      case 'SKIPPED':
        return 'La automatización fue omitida de forma controlada.';
      default:
        return 'Sin resumen adicional.';
    }
  }

  private getStepLabel(step: AutomationStep): string {
    switch (step) {
      case AutomationStep.MATCH_REMINDER:
        return 'Recordatorio 60 min';
      case AutomationStep.PREDICTION_CLOSING:
        return 'Cierre de predicciones';
      case AutomationStep.RESULT_NOTIFICATION:
        return 'Notificación de resultado';
      case AutomationStep.PREDICTION_REPORT:
        return 'Reporte de predicciones';
      case AutomationStep.RESULT_REPORT:
        return 'Reporte de resultados';
      default:
        return step;
    }
  }

  private mapRunToStepState(
    status: AutomationRunStatus,
    trigger: AutomationRunTrigger,
  ): StepState {
    if (trigger === AutomationRunTrigger.MANUAL && status === AutomationRunStatus.SUCCESS) {
      return 'MANUAL';
    }

    switch (status) {
      case AutomationRunStatus.RUNNING:
        return 'RUNNING';
      case AutomationRunStatus.SUCCESS:
        return 'SUCCESS';
      case AutomationRunStatus.WARNING:
        return 'WARNING';
      case AutomationRunStatus.FAILED:
        return 'FAILED';
      case AutomationRunStatus.SKIPPED:
        return 'SKIPPED';
      default:
        return 'NOT_APPLICABLE';
    }
  }

  private mapSyncStatus(status: SyncLogStatus): OperationSyncStatus {
    switch (status) {
      case SyncLogStatus.SUCCESS:
        return 'SUCCESS';
      case SyncLogStatus.PARTIAL:
        return 'WARNING';
      case SyncLogStatus.FAILED:
        return 'FAILED';
      case SyncLogStatus.SKIPPED:
        return 'SKIPPED';
      default:
        return 'SCHEDULED';
    }
  }

  private getBogotaDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private getOperationalWindow(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const dayStart = new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month - 1, day + 1, 4, 59, 59));
    const carryOverStart = new Date(Date.UTC(year, month - 1, day - 1, 5, 0, 0));
    return { dayStart, dayEnd, carryOverStart };
  }
}
