import { Injectable, Logger } from '@nestjs/common';
import {
  logExclusiveBackgroundJobSkip,
  tryRunExclusiveBackgroundJob,
} from '../../prisma/background-job-lock.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionsService } from '../../predictions/predictions.service';
import { PredictionReportService } from '../../prediction-report/prediction-report.service';
import { ApiFootballClient } from './api-football-client.service';
import { RateLimiterService } from './rate-limiter.service';
import { SyncPlanService } from './sync-plan.service';
import { MonitoringService } from './monitoring.service';
import { SyncEventsService } from './sync-events.service';
import { ConfigService as FootballConfigService } from './config.service';
import { PushNotificationsService } from '../../push-notifications/push-notifications.service';
import {
  MatchStatus,
  Phase,
  Prisma,
  SyncAlertLevel,
  SyncAlertType,
  SyncLogStatus,
  SyncLogType,
  Team,
} from '@prisma/client';
import {
  ApiFootballFixture,
  ApiFootballFixtureTeam,
  MatchLinkCandidateDto,
  TeamCatalogBackfillResultDto,
} from '../dto/api-football.dto';
import {
  WORLD_CUP_TEAM_CATALOG,
  WORLD_CUP_TEAM_CATALOG_BY_API_ID,
} from '../catalog/world-cup-team-catalog';

@Injectable()
export class MatchSyncService {
  private static readonly BACKGROUND_DB_JOB_KEY = 'background-db-job';
  private readonly logger = new Logger(MatchSyncService.name);
  private readonly syncConcurrency = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: ApiFootballClient,
    private readonly rateLimiter: RateLimiterService,
    private readonly syncPlan: SyncPlanService,
    private readonly predictionsService: PredictionsService,
    private readonly monitoring: MonitoringService,
    private readonly predictionReport: PredictionReportService,
    private readonly syncEvents: SyncEventsService,
    private readonly footballConfigService: FootballConfigService,
    private readonly push: PushNotificationsService,
  ) {}

  async backfillWorldCupTeams(): Promise<TeamCatalogBackfillResultDto> {
    const warnings: string[] = [];
    let updated = 0;
    let created = 0;
    let skipped = 0;

    const existingTeams = await this.prisma.team.findMany();

    for (const entry of WORLD_CUP_TEAM_CATALOG) {
      const normalizedEntryName = this.normalizeKey(entry.name);
      const current = existingTeams.find(
        (team) =>
          team.code === entry.code ||
          team.apiFootballTeamId === entry.apiFootballTeamId ||
          this.normalizeKey(team.name) === normalizedEntryName,
      );

      if (current) {
        await this.prisma.team.update({
          where: { id: current.id },
          data: {
            name: entry.name,
            code: entry.code,
            shortCode: entry.shortCode,
            apiFootballTeamId: entry.apiFootballTeamId,
            flagUrl: entry.flagUrl,
            group: entry.group,
          },
        });
        updated++;
        continue;
      }

      await this.prisma.team.create({
        data: {
          name: entry.name,
          code: entry.code,
          shortCode: entry.shortCode,
          apiFootballTeamId: entry.apiFootballTeamId,
          flagUrl: entry.flagUrl,
          group: entry.group,
        },
      });
      created++;
    }

    for (const team of existingTeams) {
      const matched = WORLD_CUP_TEAM_CATALOG.some(
        (entry) =>
          entry.code === team.code ||
          entry.apiFootballTeamId === team.apiFootballTeamId ||
          this.normalizeKey(entry.name) === this.normalizeKey(team.name),
      );

      if (!matched) {
        skipped++;
        warnings.push(
          `Equipo fuera del catÃ¡logo curado no modificado: ${team.name} (${team.code})`,
        );
      }
    }

    return { updated, created, skipped, warnings };
  }

  /**
   * Sync all matches for today
   */
  async syncTodayMatches(): Promise<{
    success: boolean;
    matchesUpdated: number;
    error?: string;
  }> {
    return this.runTodaySync({
      logType: SyncLogType.AUTO_SYNC,
      summaryLabel: 'Automatic sync',
    });
  }

  async syncTodayMatchesForTrigger(options: {
    logType: SyncLogType;
    triggeredBy?: string;
    summaryLabel: string;
  }): Promise<{
    success: boolean;
    matchesUpdated: number;
    error?: string;
  }> {
    return this.runTodaySync(options);
  }

  private async runTodaySync(options: {
    logType: SyncLogType;
    triggeredBy?: string;
    summaryLabel: string;
  }): Promise<{
    success: boolean;
    matchesUpdated: number;
    error?: string;
  }> {
    const execution = await tryRunExclusiveBackgroundJob(
      MatchSyncService.BACKGROUND_DB_JOB_KEY,
      'syncTodayMatches',
      () => this.runTodaySyncInternal(options),
    );

    if (!execution.ran) {
      logExclusiveBackgroundJobSkip(this.logger, options.summaryLabel, execution);
      return {
        success: false,
        matchesUpdated: 0,
        error: 'Another DB-heavy background job is running',
      };
    }

    return execution.result;
  }

  private async runTodaySyncInternal(options: {
    logType: SyncLogType;
    triggeredBy?: string;
    summaryLabel: string;
  }): Promise<{
    success: boolean;
    matchesUpdated: number;
    error?: string;
  }> {
    const startedAt = Date.now();

    try {
      // Use Bogotá date (UTC-5) as the date parameter for API-Football.
      // The API client already sends timezone=America/Bogota, so the API
      // interprets the date in Bogotá time — matching our 7pm-7pm operational window.
      // This means 1 single request covers all matches of the operational day,
      // regardless of their UTC date.
      const bogotaDate = new Date(Date.now() - 5 * 60 * 60 * 1000);
      const today = bogotaDate.toISOString().split('T')[0];  // e.g. "2026-03-30" in Bogotá
      const yesterdayDate = new Date(bogotaDate);
      yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
      const yesterday = yesterdayDate.toISOString().split('T')[0];

      const carryOverMatches = await this.syncPlan.getCarryOverMatches();
      const shouldQueryYesterday = carryOverMatches.some((match) => !!match.externalId);
      const datesToQuery = shouldQueryYesterday ? [today, yesterday] : [today];
      const requestCount = datesToQuery.length;

      // Check rate limit
      if (!(await this.rateLimiter.canMakeRequests(requestCount))) {
        this.logger.warn('Rate limit reached, skipping sync');
        await this.monitoring.createLog({
          type: options.logType,
          status: SyncLogStatus.SKIPPED,
          message: `${options.summaryLabel} skipped because no requests are available`,
          requestsUsed: 0,
          matchesUpdated: 0,
          duration: Date.now() - startedAt,
          triggeredBy: options.triggeredBy,
        });
        await this.monitoring.createAlert({
          type: SyncAlertType.RATE_LIMIT_EXCEEDED,
          severity: SyncAlertLevel.WARNING,
          message: 'Football Sync no pudo ejecutarse porque no quedan requests disponibles.',
        });
        return {
          success: false,
          matchesUpdated: 0,
          error: 'Rate limit reached',
        };
      }

      // Fetch fixtures from API-Football (client already logs to ApiFootballRequest internally)
      this.logger.log(`Fetching fixtures for dates: ${datesToQuery.join(", ")}`);
      const responses = await Promise.all(
        datesToQuery.map((date) => this.apiClient.getFixturesByDate(date)),
      );
      const fixtureMap = new Map<number, ApiFootballFixture>();
      for (const response of responses) {
        for (const fixture of response.response) {
          fixtureMap.set(fixture.fixture.id, fixture);
        }
      }
      const fixtures = [...fixtureMap.values()];
      const totalResults = responses.reduce(
        (sum, response) => sum + response.results,
        0,
      );
      const autoLinkedMatches = await this.autoLinkTrackedMatchesFromFixtures(
        fixtures,
        today,
        shouldQueryYesterday ? yesterday : null,
      );
      const eventSyncEnabled =
        await this.footballConfigService.isEventSyncEnabled();

      // Update sync plan
      await this.syncPlan.updateLastSyncTime();
      await this.syncPlan.incrementRequestsUsed(requestCount);

      // Process fixtures sequentially to avoid saturating MariaDB pool when
      // the environment is intentionally limited to a single connection.
      let updatedCount = 0;
      let skippedCount = 0;
      for (let i = 0; i < fixtures.length; i += this.syncConcurrency) {
        const batch = fixtures.slice(i, i + this.syncConcurrency);
        const results = await Promise.allSettled(
          batch.map((f) =>
            this.updateMatchFromFixture(f, { eventSyncEnabled }),
          ),
        );
        for (const r of results) {
          if (r.status === 'fulfilled') {
            if (r.value) updatedCount++;
            else skippedCount++;
          }
        }
      }

      this.logger.log(
        `Sync completed: ${updatedCount} updated, ${skippedCount} skipped (no match in DB) from ${fixtures.length} fixtures`,
      );

      await this.monitoring.createLog({
        type: options.logType,
        status: SyncLogStatus.SUCCESS,
        message: `${options.summaryLabel} completed successfully`,
        requestsUsed: requestCount,
        matchesUpdated: updatedCount,
        duration: Date.now() - startedAt,
        details: JSON.stringify({
          fixturesFetched: totalResults,
          datesQueried: datesToQuery,
          carryOverMatches: carryOverMatches.length,
          autoLinkedMatches,
        }),
        triggeredBy: options.triggeredBy,
      });

      if (totalResults > 0 && updatedCount === 0) {
        await this.monitoring.createAlert({
          type: SyncAlertType.NO_MATCHES_UPDATED,
          severity: SyncAlertLevel.INFO,
          message: 'Football Sync consulto fixtures, pero no encontro partidos locales para actualizar.',
          details: JSON.stringify({
            fixturesFetched: totalResults,
            datesQueried: datesToQuery,
          }),
        });
      }

      return {
        success: true,
        matchesUpdated: updatedCount,
      };
    } catch (error) {
      this.logger.error(`Sync failed: ${error.message}`, error.stack);
      await this.monitoring.createLog({
        type: options.logType,
        status: SyncLogStatus.FAILED,
        message: `${options.summaryLabel} failed`,
        requestsUsed: 0,
        matchesUpdated: 0,
        duration: Date.now() - startedAt,
        error: error.message,
        triggeredBy: options.triggeredBy,
      });
      await this.monitoring.createAlert({
        type: SyncAlertType.SYNC_FAILURE,
        severity: SyncAlertLevel.ERROR,
        message: `Football Sync fallÃ³: ${error.message}`,
      });
      return {
        success: false,
        matchesUpdated: 0,
        error: error.message,
      };
    }
  }

  /**
   * Sync only live matches (more efficient)
   */
  async syncLiveMatches(): Promise<{
    success: boolean;
    matchesUpdated: number;
    error?: string;
  }> {
    const execution = await tryRunExclusiveBackgroundJob(
      MatchSyncService.BACKGROUND_DB_JOB_KEY,
      'syncLiveMatches',
      () => this.syncLiveMatchesInternal(),
    );

    if (!execution.ran) {
      logExclusiveBackgroundJobSkip(this.logger, 'Live sync', execution);
      return {
        success: false,
        matchesUpdated: 0,
        error: 'Another DB-heavy background job is running',
      };
    }

    return execution.result;
  }

  private async syncLiveMatchesInternal(): Promise<{
    success: boolean;
    matchesUpdated: number;
    error?: string;
  }> {
    const startedAt = Date.now();
    try {
      // Check rate limit
      if (!(await this.rateLimiter.canMakeRequest())) {
        this.logger.warn('Rate limit reached, skipping live sync');
        await this.monitoring.createLog({
          type: SyncLogType.AUTO_SYNC,
          status: SyncLogStatus.SKIPPED,
          message: 'Live sync skipped because no requests are available',
          requestsUsed: 0,
          matchesUpdated: 0,
          duration: Date.now() - startedAt,
        });
        return {
          success: false,
          matchesUpdated: 0,
          error: 'Rate limit reached',
        };
      }

      // Fetch live fixtures
      this.logger.log('Fetching live fixtures');
      const response = await this.apiClient.getLiveFixtures();

      // Log the request
      await this.rateLimiter.logRequest(
        '/fixtures',
        { live: 'all' },
        200,
        response.results,
      );

      // Update sync plan
      await this.syncPlan.updateLastSyncTime();
      await this.syncPlan.incrementRequestsUsed();
      const eventSyncEnabled =
        await this.footballConfigService.isEventSyncEnabled();

      // Process fixtures in parallel batches (4 concurrent)
      let updatedCount = 0;
      for (let i = 0; i < response.response.length; i += this.syncConcurrency) {
        const batch = response.response.slice(i, i + this.syncConcurrency);
        const results = await Promise.allSettled(
          batch.map((f) =>
            this.updateMatchFromFixture(f, { eventSyncEnabled }),
          ),
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) updatedCount++;
        }
      }

      this.logger.log(
        `Live sync completed: ${updatedCount} matches updated from ${response.results} live fixtures`,
      );

      await this.monitoring.createLog({
        type: SyncLogType.AUTO_SYNC,
        status: SyncLogStatus.SUCCESS,
        message: 'Live sync completed successfully',
        requestsUsed: 1,
        matchesUpdated: updatedCount,
        duration: Date.now() - startedAt,
        details: JSON.stringify({
          fixturesFetched: response.results,
          live: true,
        }),
      });

      return {
        success: true,
        matchesUpdated: updatedCount,
      };
    } catch (error) {
      this.logger.error(`Live sync failed: ${error.message}`, error.stack);
      await this.monitoring.createLog({
        type: SyncLogType.AUTO_SYNC,
        status: SyncLogStatus.FAILED,
        message: 'Live sync failed',
        requestsUsed: 0,
        matchesUpdated: 0,
        duration: Date.now() - startedAt,
        error: error.message,
      });
      return {
        success: false,
        matchesUpdated: 0,
        error: error.message,
      };
    }
  }

  /**
   * Update a match from API-Football fixture data
   */
  private async updateMatchFromFixture(
    fixture: ApiFootballFixture,
    options: {
      eventSyncEnabled: boolean;
    } = { eventSyncEnabled: false },
  ): Promise<boolean> {
    try {
      // Find match by external ID
      const match = await this.prisma.match.findUnique({
        where: { externalId: fixture.fixture.id.toString() },
        include: {
          homeTeam: true,
          awayTeam: true,
        },
      });

      if (!match) {
        return false;
      }

      // Map API-Football status to our status
      const status = this.mapFixtureStatus(fixture.fixture.status.short);
      const homeTeamId = await this.reconcileFixtureTeam(
        match.homeTeam,
        fixture.teams.home,
        'home',
        fixture.fixture.id,
      );
      const awayTeamId = await this.reconcileFixtureTeam(
        match.awayTeam,
        fixture.teams.away,
        'away',
        fixture.fixture.id,
      );

      // Check if scores changed
      const scoreChanged =
        match.homeScore !== fixture.goals.home ||
        match.awayScore !== fixture.goals.away;

      // Detect goals (score increased from previous value)
      const homeGoalsScored = fixture.goals.home !== null &&
        match.homeScore !== null &&
        fixture.goals.home > match.homeScore;
      const awayGoalsScored = fixture.goals.away !== null &&
        match.awayScore !== null &&
        fixture.goals.away > match.awayScore;

      // Send push notification for goals during live match
      if (scoreChanged && status === MatchStatus.LIVE) {
        const elapsed = fixture.fixture.status.elapsed ?? null;
        if (homeGoalsScored || awayGoalsScored) {
          await this.sendGoalPushNotification(
            match.id,
            fixture.teams.home.name,
            fixture.teams.away.name,
            fixture.goals.home,
            fixture.goals.away,
            homeGoalsScored ? fixture.teams.home.name : null,
            awayGoalsScored ? fixture.teams.away.name : null,
            elapsed,
          );
        }
      }

      // Sync matchDate from API timestamp if it differs.
      const apiMatchDate = fixture.fixture.timestamp
        ? new Date(fixture.fixture.timestamp * 1000)
        : null;
      const matchDateDriftMs = apiMatchDate
        ? Math.abs(apiMatchDate.getTime() - match.matchDate.getTime())
        : 0;

      // When a force-closed match (FINISHED + resultNotificationSentAt set) is
      // reported as LIVE by the API, or as SCHEDULED with a kickoff rescheduled to
      // the FUTURE, restore it and clear resultNotificationSentAt so notifications
      // fire correctly when it actually finishes.
      // Do NOT restore if the API still says "NS" with a past kickoff time — that
      // means the match is cancelled/postponed with no new date, and restoring would
      // create an infinite close→restore loop with closeStaleUnlinkedMatches.
      const isActuallyLive = status === MatchStatus.LIVE;
      const isRescheduledToFuture =
        status === MatchStatus.SCHEDULED &&
        apiMatchDate !== null &&
        apiMatchDate.getTime() > Date.now();
      const wasForceClosedAndNowActive =
        match.status === MatchStatus.FINISHED &&
        match.resultNotificationSentAt !== null &&
        (isActuallyLive || isRescheduledToFuture);

      // >1 min drift → update. Always update when restoring a force-closed match
      // so closeStaleUnlinkedMatches doesn't re-close it with the wrong date.
      const matchDateChanged = matchDateDriftMs > 60_000 || wasForceClosedAndNowActive;

      // Update match (including elapsed + statusShort for live timer persistence)
      const updatedMatch = await this.prisma.match.update({
        where: { id: match.id },
        data: {
          ...(homeTeamId !== match.homeTeamId ? { homeTeamId } : {}),
          ...(awayTeamId !== match.awayTeamId ? { awayTeamId } : {}),
          ...(matchDateChanged && apiMatchDate ? { matchDate: apiMatchDate } : {}),
          ...(wasForceClosedAndNowActive ? { resultNotificationSentAt: null } : {}),
          homeScore: fixture.goals.home,
          awayScore: fixture.goals.away,
          status,
          elapsed:     fixture.fixture.status.elapsed ?? null,
          statusShort: fixture.fixture.status.short ?? null,
          lastSyncAt: new Date(),
          syncCount: { increment: 1 },
        },
      });

      // Sync goal/card events inline to avoid overlapping DB work when the
      // runtime is constrained to a single MariaDB connection.
      const currentStatusShort = fixture.fixture.status.short ?? null;
      const previousStatusShort = match.statusShort ?? null;
      const shouldSyncHalftimeEvents =
        currentStatusShort === 'HT' && previousStatusShort !== 'HT';
      const isFinalStatus = ['FT', 'AET', 'PEN'].includes(currentStatusShort ?? '');
      const wasFinalStatus = ['FT', 'AET', 'PEN'].includes(previousStatusShort ?? '');
      const shouldSyncEvents =
        options.eventSyncEnabled &&
        !match.eventsNoDataAt &&
        (shouldSyncHalftimeEvents || (isFinalStatus && !wasFinalStatus));

      if (shouldSyncEvents && fixture.fixture.id) {
        const canSpendEventRequest = await this.rateLimiter.canMakeRequest();
        if (!canSpendEventRequest) {
          this.logger.warn(
            `Skipping fixture events for match ${match.id}: no request budget available`,
          );
        } else {
          try {
            const eventSyncResult = await this.syncMatchEvents(fixture.fixture.id, match.id);
            if (eventSyncResult.relevantEvents === 0) {
              await this.prisma.match.update({
                where: { id: match.id },
                data: {
                  eventsNoDataAt: new Date(),
                },
              });
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Event sync failed for match ${match.id}: ${message}`);
          }
        }
      }

      if (matchDateChanged && apiMatchDate) {
        this.logger.warn(
          `match ${match.id}: matchDate corrected from ${match.matchDate.toISOString()} to ${apiMatchDate.toISOString()} (API drift ${Math.round(matchDateDriftMs / 60000)} min)`,
        );
      }
      if (wasForceClosedAndNowActive) {
        this.logger.warn(
          `match ${match.id}: was force-closed but API reports ${status} — clearing resultNotificationSentAt`,
        );
      }

      this.logger.log(
        `Updated match ${match.id}: ${fixture.teams.home.name} ${fixture.goals.home ?? '-'} - ${fixture.goals.away ?? '-'} ${fixture.teams.away.name} (${status})`,
      );

      // Emit match_updated event
      this.syncEvents.emit({
        type: 'match_updated',
        data: {
          matchId: match.id,
          homeScore: fixture.goals.home,
          awayScore: fixture.goals.away,
          status,
          externalId: fixture.fixture.id.toString(),
          elapsed: fixture.fixture.status.elapsed ?? null,
          statusShort: fixture.fixture.status.short,
        },
        timestamp: new Date().toISOString(),
      });

      // Auto-activate match in LeagueMatch if it has predictions but is not yet active
      const transitionedToLive = match.status !== MatchStatus.LIVE && status === MatchStatus.LIVE;
      if (transitionedToLive) {
        await this.autoActivateMatchInLeagues(match.id);
      }

      const transitionedToFinished = match.status !== MatchStatus.FINISHED && status === MatchStatus.FINISHED;

      // When the match reaches FINISHED we must calculate points and enqueue the
      // result email even if the score was already present before the final status.
      if (status === MatchStatus.FINISHED && (scoreChanged || transitionedToFinished)) {
        this.logger.log(`Match ${match.id} finished, calculating points`);
        await this.predictionsService.calculateMatchPoints(match.id);

        // Set advancingTeamId for knockout matches
        if (match.phase !== Phase.GROUP) {
          const h = fixture.goals.home ?? 0;
          const a = fixture.goals.away ?? 0;
          if (h !== a) {
            const advancingTeamId = h > a
              ? (updatedMatch.homeTeamId ?? match.homeTeamId)
              : (updatedMatch.awayTeamId ?? match.awayTeamId);
            await this.prisma.match.update({
              where: { id: match.id },
              data: { advancingTeamId },
            });
          }
        }
        // Calculate phase bonuses after advancement is set
        await this.runFinishedMatchSideEffect(
          `calculate phase bonuses for match ${match.id}`,
          () => this.predictionsService.calculatePhaseBonuses(match.id),
        );
        await this.runFinishedMatchSideEffect(
          `send results email for match ${match.id}`,
          () => this.predictionReport.sendMatchResultsReport(match.id),
        );

        // Send push notifications for match result + points (CAMBIO 3)
        await this.runFinishedMatchSideEffect(
          `send result push for match ${match.id}`,
          () => this.sendResultPushNotifications(match.id, fixture.goals.home, fixture.goals.away),
        );
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to update match from fixture ${fixture.fixture.id}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Sync goals, cards and substitutions for a live match.
   * Uses upsert keyed on (matchId, type, playerName, minute) to avoid duplicates.
   */
  private async syncMatchEvents(
    fixtureId: number,
    matchId: string,
  ): Promise<{
    relevantEvents: number;
    rawEvents: number;
  }> {
    const response = await this.apiClient.getFixtureEvents(fixtureId);
    const events: any[] = response?.response ?? [];
    if (!events.length) {
      return { relevantEvents: 0, rawEvents: 0 };
    }

    let relevantEvents = 0;
    for (const ev of events) {
      const type: string   = ev.type   ?? 'UNKNOWN';
      const detail: string = ev.detail ?? '';
      const minute: number = ev.time?.elapsed ?? 0;
      const extraMin: number | null = ev.time?.extra ?? null;
      const playerName: string | null = ev.player?.name ?? null;
      const assistName: string | null = ev.assist?.name ?? null;

      // Only store goals and cards (skip substitutions to keep list clean)
      if (!['Goal', 'Card'].includes(type)) continue;
      relevantEvents++;

      try {
        await (this.prisma as any).matchEvent.upsert({
          where: {
            matchId_type_playerName_minute: {
              matchId,
              type:       type.toUpperCase(),
              playerName: playerName ?? '',
              minute,
            },
          },
          update: { detail, assistName, extraMin, updatedAt: new Date() },
          create: { matchId, type: type.toUpperCase(), detail, minute, extraMin, playerName, assistName },
        });
      } catch {
        // Ignore constraint errors (duplicate event at same minute)
      }
    }

    return {
      relevantEvents,
      rawEvents: events.length,
    };
  }

  /**
   * Send push notifications to all league members with predictions for this match (CAMBIO 3)
   */
  private async sendResultPushNotifications(
    matchId: string,
    homeScore: number | null,
    awayScore: number | null,
  ): Promise<void> {
    try {
      const predictions = await this.prisma.prediction.findMany({
        where: { matchId },
        include: {
          match: { include: { homeTeam: true, awayTeam: true } },
        },
      });

      for (const prediction of predictions) {
        const pts = Math.round(prediction.points ?? 0);
        const home = prediction.match.homeTeam.name;
        const away = prediction.match.awayTeam.name;
        const score = `${homeScore ?? '-'}-${awayScore ?? '-'}`;

        if (pts >= 5) {
          await this.push.sendToUser(prediction.userId, {
            title: 'ðŸŽ¯ Â¡Marcador exacto!',
            body: `${home} ${score} ${away} â€” +${pts} pts`,
            data: { matchId, points: pts },
          });
        } else {
          await this.push.sendToUser(prediction.userId, {
            title: 'âœ… Resultado publicado',
            body: `${home} ${score} ${away} â€” ganaste ${pts} pts`,
            data: { matchId, points: pts },
          });
        }
      }
    } catch (error) {
      this.logger.error(`sendResultPushNotifications failed: ${error.message}`);
    }
  }

  /**
   * Send push notifications to league members when a goal is scored during a live match
   */
  private async sendGoalPushNotification(
    matchId: string,
    homeTeamName: string,
    awayTeamName: string,
    homeScore: number | null,
    awayScore: number | null,
    goalScorerTeam: string | null, // null if no goal for this team
    awayGoalScorerTeam: string | null,
    elapsed: number | null,
  ): Promise<void> {
    try {
      // Only fetch userId to avoid loading unnecessary relation data
      const predictions = await this.prisma.prediction.findMany({
        where: { matchId },
        select: { userId: true },
        distinct: ['userId'], // Avoid duplicate notifications if user has multiple predictions
      });

      if (predictions.length === 0) return;

      const score = `${homeScore ?? '-'}-${awayScore ?? '-'}`;
      const minute = elapsed ? `${elapsed}'` : '';
      const goalTeams: string[] = [];
      if (goalScorerTeam) goalTeams.push(goalScorerTeam);
      if (awayGoalScorerTeam) goalTeams.push(awayGoalScorerTeam);
      const goalTeamText = goalTeams.join(' y ');

      const title = '⚽ ¡GOL!';
      const body = goalTeams.length === 2
        ? `${goalTeamText} anotar${goalTeams.length > 1 ? 'ron' : ''} — ${homeTeamName} ${score} ${awayTeamName}${minute ? ` ${minute}` : ''}`
        : `${goalTeamText} marca${goalScorerTeam ? '' : 'n'} — ${homeTeamName} ${score} ${awayTeamName}${minute ? ` ${minute}` : ''}`;

      // Send to all users with predictions for this match (limit to one notification per user per goal event)
      const notifiedUsers = new Set<string>();
      for (const prediction of predictions) {
        if (notifiedUsers.has(prediction.userId)) continue;
        notifiedUsers.add(prediction.userId);

        await this.push.sendToUser(prediction.userId, {
          title,
          body,
          tag: `goal-${matchId}-${Date.now()}`,
          requireInteraction: false,
          data: { matchId, type: 'goal', homeScore, awayScore },
        });
      }
    } catch (error) {
      this.logger.error(`sendGoalPushNotification failed: ${error.message}`);
    }
  }

  private async runFinishedMatchSideEffect(
    label: string,
    effect: () => Promise<void>,
  ): Promise<void> {
    try {
      await effect();
    } catch (error) {
      this.logger.error(`Error ${label}: ${error.message}`);
    }
  }

  private async reconcileFixtureTeam(
    currentTeam: Team,
    fixtureTeam: ApiFootballFixtureTeam,
    side: 'home' | 'away',
    fixtureId: number,
  ): Promise<string> {
    const canonical = WORLD_CUP_TEAM_CATALOG_BY_API_ID.get(fixtureTeam.id);
    const directMatch = await this.prisma.team.findUnique({
      where: { apiFootballTeamId: fixtureTeam.id },
    });

    if (directMatch) {
      await this.refreshTeamDisplayFields(directMatch.id, fixtureTeam, canonical);

      if (directMatch.id !== currentTeam.id) {
        this.logger.warn(
          `Fixture ${fixtureId} ${side} team remapped from ${currentTeam.name} to ${directMatch.name} using apiFootballTeamId=${fixtureTeam.id}`,
        );
      }

      return directMatch.id;
    }

    if (canonical && this.matchesCanonicalTeam(currentTeam, canonical)) {
      await this.prisma.team.update({
        where: { id: currentTeam.id },
        data: {
          apiFootballTeamId: canonical.apiFootballTeamId,
          shortCode: canonical.shortCode,
          flagUrl: fixtureTeam.logo || canonical.flagUrl,
          code: canonical.code,
          name: canonical.name,
          group: canonical.group,
        },
      });
      return currentTeam.id;
    }

    if (currentTeam.apiFootballTeamId === fixtureTeam.id) {
      await this.refreshTeamDisplayFields(currentTeam.id, fixtureTeam, canonical);
      return currentTeam.id;
    }

    this.logger.warn(
      `Fixture ${fixtureId} ${side} team could not be reconciled safely. Local=${currentTeam.name} (${currentTeam.code}) upstream=${fixtureTeam.name} (${fixtureTeam.id})`,
    );
    return currentTeam.id;
  }

  private async refreshTeamDisplayFields(
    teamId: string,
    fixtureTeam: ApiFootballFixtureTeam,
    canonical?: (typeof WORLD_CUP_TEAM_CATALOG)[number],
  ): Promise<void> {
    const data: Prisma.TeamUpdateInput = {
      apiFootballTeamId: fixtureTeam.id,
      flagUrl: fixtureTeam.logo,
    };

    if (canonical) {
      data.shortCode = canonical.shortCode;
      data.code = canonical.code;
      data.group = canonical.group;
      data.name = canonical.name;
    }

    await this.prisma.team.update({
      where: { id: teamId },
      data,
    });
  }

  private matchesCanonicalTeam(
    team: Team,
    canonical: (typeof WORLD_CUP_TEAM_CATALOG)[number],
  ): boolean {
    return (
      team.code === canonical.code ||
      this.normalizeKey(team.name) === this.normalizeKey(canonical.name)
    );
  }

  private normalizeKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /**
   * Map API-Football status codes to our MatchStatus
   */
  private mapFixtureStatus(apiStatus: string): MatchStatus {
    switch (apiStatus) {
      case 'TBD':
      case 'NS':
        return MatchStatus.SCHEDULED;

      case '1H':
      case 'HT':
      case '2H':
      case 'ET':
      case 'BT':
      case 'P':
      case 'LIVE':
        return MatchStatus.LIVE;

      case 'FT':
      case 'AET':
      case 'PEN':
        return MatchStatus.FINISHED;

      case 'PST':
      case 'SUSP':
        return MatchStatus.POSTPONED;

      case 'CANC':
      case 'ABD':
        return MatchStatus.CANCELLED;

      default:
        this.logger.warn(`Unknown API-Football status: ${apiStatus}`);
        return MatchStatus.SCHEDULED;
    }
  }

  /**
   * Link a match to an external API-Football fixture ID
   */
  async autoLinkAndSync(
    matchId: string,
    userId?: string,
  ): Promise<{ wasLinked: boolean; candidate?: MatchLinkCandidateDto; synced: boolean; message: string }> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });

    if (!match) throw new Error('Partido no encontrado');

    let wasLinked = false;
    let candidate: MatchLinkCandidateDto | undefined;

    if (!match.externalId) {
      const candidates = await this.findLinkCandidates(matchId);
      const best = candidates.find((c) => c.confidence !== 'low');

      if (!best) {
        return {
          wasLinked: false,
          synced: false,
          message: 'No se encontraron candidatos con suficiente confianza para vincular automÃ¡ticamente.',
        };
      }

      const previousExternalId = match.externalId ?? null;
      await this.prisma.match.update({
        where: { id: matchId },
        data: { externalId: best.fixtureId },
      });

      if (userId) {
        await this.prisma.auditLog.create({
          data: {
            userId,
            action: 'MATCH_EXTERNAL_LINK_UPDATED',
            detail: JSON.stringify({
              matchId,
              previousExternalId,
              externalId: best.fixtureId,
              linkSource: 'suggested',
              autoLinked: true,
            }),
          },
        });
      }

      wasLinked = true;
      candidate = best;
      this.logger.log(`Auto-linked match ${matchId} to fixture ${best.fixtureId} (${best.confidence} confidence)`);
    }

    const synced = await this.syncMatchById(matchId);

    return {
      wasLinked,
      candidate,
      synced,
      message: wasLinked
        ? `Auto-vinculado a ${candidate!.homeTeam} vs ${candidate!.awayTeam} (confianza: ${candidate!.confidence}) y ${synced ? 'sincronizado correctamente' : 'sincronizaciÃ³n fallÃ³'}.`
        : synced ? 'Sincronizado correctamente.' : 'SincronizaciÃ³n fallÃ³.',
    };
  }

  async getMatchApiHistory(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { externalId: true },
    });
    if (!match?.externalId) return [];

    return this.prisma.apiFootballRequest.findMany({
      where: { externalId: match.externalId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        date: true,
        endpoint: true,
        params: true,
        responseStatus: true,
        matchesFetched: true,
        externalId: true,
        responseBody: true,
        createdAt: true,
      },
    });
  }

  /**
   * Bulk auto-link all unlinked matches (no externalId) that are SCHEDULED or LIVE
   */
  async bulkAutoLink(userId?: string): Promise<{
    attempted: number;
    linked: number;
    skipped: number;
    failed: number;
    results: Array<{ matchId: string; label: string; status: 'linked' | 'skipped' | 'failed'; message: string }>;
  }> {
    const unlinked = await this.prisma.match.findMany({
      where: {
        externalId: null,
        status: { in: ['SCHEDULED', 'LIVE'] },
      },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { matchDate: 'asc' },
    });

    const results: Array<{ matchId: string; label: string; status: 'linked' | 'skipped' | 'failed'; message: string }> = [];
    let linked = 0;
    let skipped = 0;
    let failed = 0;

    for (const match of unlinked) {
      const label = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
      try {
        if (!(await this.rateLimiter.canMakeRequest())) {
          results.push({ matchId: match.id, label, status: 'skipped', message: 'LÃ­mite de requests alcanzado' });
          skipped++;
          continue;
        }

        const candidates = await this.findLinkCandidates(match.id);
        const best = candidates.find((c) => c.confidence !== 'low');

        if (!best) {
          results.push({ matchId: match.id, label, status: 'skipped', message: 'Sin candidatos de alta confianza' });
          skipped++;
          continue;
        }

        await this.prisma.match.update({
          where: { id: match.id },
          data: { externalId: best.fixtureId },
        });

        if (userId) {
          await this.prisma.auditLog.create({
            data: {
              userId,
              action: 'MATCH_EXTERNAL_LINK_UPDATED',
              detail: JSON.stringify({
                matchId: match.id,
                previousExternalId: null,
                externalId: best.fixtureId,
                linkSource: 'bulk-suggested',
                autoLinked: true,
              }),
            },
          });
        }

        this.logger.log(`Bulk auto-linked ${match.id} (${label}) to fixture ${best.fixtureId} (${best.confidence})`);
        results.push({ matchId: match.id, label, status: 'linked', message: `Vinculado a fixture ${best.fixtureId} (${best.confidence})` });
        linked++;
      } catch (error) {
        results.push({ matchId: match.id, label, status: 'failed', message: error.message ?? 'Error desconocido' });
        failed++;
      }
    }

    return { attempted: unlinked.length, linked, skipped, failed, results };
  }

  async linkMatchToFixture(
    matchId: string,
    externalId: string,
  ): Promise<void> {
    await this.prisma.match.update({
      where: { id: matchId },
      data: { externalId },
    });

    this.logger.log(`Linked match ${matchId} to fixture ${externalId}`);
  }

  async findLinkCandidates(matchId: string): Promise<MatchLinkCandidateDto[]> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });

    if (!match) {
      throw new Error('Partido no encontrado');
    }

    if (!(await this.rateLimiter.canMakeRequest())) {
      throw new Error('No hay requests disponibles para consultar candidatos');
    }

    const matchDate = match.matchDate.toISOString().split('T')[0];
    const response = await this.apiClient.getFixturesByDate(matchDate);

    await this.rateLimiter.logRequest(
      '/fixtures',
      { date: matchDate, source: 'match-link-candidates', matchId },
      200,
      response.results,
    );

    return response.response
      .map((fixture) => this.scoreFixtureCandidate(match, fixture))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);
  }

  /**
   * Sync a specific match by ID
   */
  async syncMatchById(matchId: string): Promise<boolean> {
    const startedAt = Date.now();
    try {
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
      });

      if (!match || !match.externalId) {
        this.logger.warn(`Match ${matchId} not found or has no external ID`);
        await this.monitoring.createLog({
          type: SyncLogType.MATCH_SYNC,
          status: SyncLogStatus.SKIPPED,
          matchId,
          message: 'Match sync skipped because the match has no external fixture link',
          requestsUsed: 0,
          matchesUpdated: 0,
          duration: Date.now() - startedAt,
        });
        return false;
      }

      // Check rate limit
      if (!(await this.rateLimiter.canMakeRequest())) {
        this.logger.warn('Rate limit reached, cannot sync match');
        await this.monitoring.createLog({
          type: SyncLogType.MATCH_SYNC,
          status: SyncLogStatus.SKIPPED,
          matchId,
          externalId: match.externalId,
          message: 'Match sync skipped because no requests are available',
          requestsUsed: 0,
          matchesUpdated: 0,
          duration: Date.now() - startedAt,
        });
        return false;
      }

      // Fetch fixture by ID
      const response = await this.apiClient.getFixtureById(
        parseInt(match.externalId),
      );

      // Log request
      await this.rateLimiter.logRequest(
        '/fixtures',
        { id: match.externalId },
        200,
        response.results,
      );

      // Update match
      if (response.results > 0) {
        const fixture = response.response[0];
        const eventSyncEnabled =
          await this.footballConfigService.isEventSyncEnabled();
        const updated = await this.updateMatchFromFixture(fixture, {
          eventSyncEnabled,
        });
        await this.monitoring.createLog({
          type: SyncLogType.MATCH_SYNC,
          status: updated ? SyncLogStatus.SUCCESS : SyncLogStatus.FAILED,
          matchId,
          externalId: match.externalId,
          message: updated
            ? 'Match sync completed successfully'
            : 'Match sync could not update the linked fixture',
          details: JSON.stringify({ fixture }),
          requestsUsed: 1,
          matchesUpdated: updated ? 1 : 0,
          duration: Date.now() - startedAt,
        });
        return updated;
      }

      await this.monitoring.createLog({
        type: SyncLogType.MATCH_SYNC,
        status: SyncLogStatus.FAILED,
        matchId,
        externalId: match.externalId,
        message: 'Match sync did not find a fixture for the linked external ID',
        requestsUsed: 1,
        matchesUpdated: 0,
        duration: Date.now() - startedAt,
      });
      return false;
    } catch (error) {
      this.logger.error(`Failed to sync match ${matchId}: ${error.message}`);
      await this.monitoring.createLog({
        type: SyncLogType.MATCH_SYNC,
        status: SyncLogStatus.FAILED,
        matchId,
        message: 'Match sync failed with an exception',
        requestsUsed: 0,
        matchesUpdated: 0,
        duration: Date.now() - startedAt,
        error: error.message,
      });
      await this.monitoring.createAlert({
        type: SyncAlertType.SYNC_FAILURE,
        severity: SyncAlertLevel.ERROR,
        message: `La sincronizaciÃ³n del partido ${matchId} fallÃ³: ${error.message}`,
      });
      return false;
    }
  }

  private scoreFixtureCandidate(
    match: {
      id: string;
      matchDate: Date;
      homeTeam: Team;
      awayTeam: Team;
    },
    fixture: ApiFootballFixture,
  ): MatchLinkCandidateDto {
    let score = 0;
    const reasons: string[] = [];

    if (match.homeTeam.apiFootballTeamId === fixture.teams.home.id) {
      score += 60;
      reasons.push('Equipo local coincide por apiFootballTeamId');
    } else if (
      this.normalizeKey(match.homeTeam.name) ===
      this.normalizeKey(fixture.teams.home.name)
    ) {
      score += 35;
      reasons.push('Equipo local coincide por nombre');
    }

    if (match.awayTeam.apiFootballTeamId === fixture.teams.away.id) {
      score += 60;
      reasons.push('Equipo visitante coincide por apiFootballTeamId');
    } else if (
      this.normalizeKey(match.awayTeam.name) ===
      this.normalizeKey(fixture.teams.away.name)
    ) {
      score += 35;
      reasons.push('Equipo visitante coincide por nombre');
    }

    const localKickoff = match.matchDate.getTime();
    const fixtureKickoff = new Date(fixture.fixture.date).getTime();
    const diffMinutes = Math.abs(localKickoff - fixtureKickoff) / (1000 * 60);

    if (diffMinutes <= 30) {
      score += 20;
      reasons.push('Hora de inicio muy cercana');
    } else if (diffMinutes <= 120) {
      score += 10;
      reasons.push('Hora de inicio razonablemente cercana');
    } else if (diffMinutes <= 360) {
      score += 5;
      reasons.push('Mismo dÃ­a con ventana horaria compatible');
    }

    const confidence: 'high' | 'medium' | 'low' =
      score >= 120 ? 'high' : score >= 70 ? 'medium' : 'low';

    return {
      fixtureId: fixture.fixture.id.toString(),
      kickoff: fixture.fixture.date,
      status: fixture.fixture.status.long,
      leagueName: fixture.league.name,
      round: fixture.league.round,
      venue: fixture.fixture.venue.name ?? undefined,
      homeTeam: fixture.teams.home.name,
      awayTeam: fixture.teams.away.name,
      confidence,
      score,
      reasons,
    };
  }

  private async autoLinkTrackedMatchesFromFixtures(
    fixtures: ApiFootballFixture[],
    today: string,
    yesterday: string | null,
  ): Promise<number> {
    const dateFilters = yesterday
      ? [today, yesterday]
      : [today];

    const trackedUnlinkedMatches = await this.prisma.match.findMany({
      where: {
        externalId: null,
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.LIVE, MatchStatus.FINISHED] },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
      orderBy: { matchDate: 'asc' },
    });

    const candidateMatches = trackedUnlinkedMatches.filter((match) => {
      const localDate = this.getBogotaDateKey(match.matchDate);
      return dateFilters.includes(localDate);
    });

    if (candidateMatches.length === 0 || fixtures.length === 0) {
      return 0;
    }

    const linkedExternalIds = new Set(
      (
        await this.prisma.match.findMany({
          where: {
            externalId: { not: null },
          },
          select: { externalId: true },
        })
      )
        .map((match) => match.externalId)
        .filter((externalId): externalId is string => !!externalId),
    );

    let linked = 0;

    for (const match of candidateMatches) {
      const best = fixtures
        .filter((fixture) => !linkedExternalIds.has(fixture.fixture.id.toString()))
        .map((fixture) => this.scoreFixtureCandidate(match, fixture))
        .filter((candidate) => candidate.confidence !== 'low')
        .sort((left, right) => right.score - left.score)[0];

      if (!best) {
        continue;
      }

      await this.prisma.match.update({
        where: { id: match.id },
        data: { externalId: best.fixtureId },
      });

      linkedExternalIds.add(best.fixtureId);
      linked++;
      this.logger.log(
        `Auto-linked tracked match ${match.id} to fixture ${best.fixtureId} during grouped daily sync`,
      );
    }

    return linked;
  }

  private getBogotaDateKey(date: Date): string {
    const bogotaDate = new Date(date.getTime() - 5 * 60 * 60 * 1000);
    return bogotaDate.toISOString().split('T')[0];
  }

  /**
   * Auto-activate a match in LeagueMatch for all leagues that have predictions for it.
   * This ensures that matches with predictions are visible in the dashboard.
   */
  private async autoActivateMatchInLeagues(matchId: string): Promise<void> {
    try {
      // Find all leagues that have predictions for this match
      const leaguesWithPredictions = await this.prisma.prediction.findMany({
        where: { matchId },
        select: { leagueId: true },
        distinct: ['leagueId'],
      });

      if (leaguesWithPredictions.length === 0) {
        return;
      }

      // Check which leagues already have this match activated
      const existingLeagueMatches = await this.prisma.leagueMatch.findMany({
        where: {
          matchId,
          leagueId: { in: leaguesWithPredictions.map((p) => p.leagueId) },
        },
        select: { leagueId: true },
      });

      const existingLeagueIds = new Set(existingLeagueMatches.map((lm) => lm.leagueId));
      const leaguesToActivate = leaguesWithPredictions.filter(
        (p) => !existingLeagueIds.has(p.leagueId),
      );

      if (leaguesToActivate.length === 0) {
        return;
      }

      // Insert LeagueMatch records for leagues that don't have it yet
      await this.prisma.leagueMatch.createMany({
        data: leaguesToActivate.map((p) => ({
          leagueId: p.leagueId,
          matchId,
          active: true,
        })),
        skipDuplicates: true,
      });

      this.logger.log(
        `Auto-activated match ${matchId} in ${leaguesToActivate.length} league(s) with predictions`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to auto-activate match ${matchId} in leagues: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
