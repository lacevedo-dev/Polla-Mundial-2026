import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionsService } from '../../predictions/predictions.service';
import { PredictionReportService } from '../../prediction-report/prediction-report.service';
import { ApiFootballClient } from './api-football-client.service';
import { RateLimiterService } from './rate-limiter.service';
import { SyncPlanService } from './sync-plan.service';
import { MonitoringService } from './monitoring.service';
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
  private readonly logger = new Logger(MatchSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: ApiFootballClient,
    private readonly rateLimiter: RateLimiterService,
    private readonly syncPlan: SyncPlanService,
    private readonly predictionsService: PredictionsService,
    private readonly monitoring: MonitoringService,
    private readonly predictionReport: PredictionReportService,
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
          `Equipo fuera del catálogo curado no modificado: ${team.name} (${team.code})`,
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
    const startedAt = Date.now();

    try {
      // Check rate limit
      if (!(await this.rateLimiter.canMakeRequest())) {
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

      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Fetch fixtures from API-Football
      this.logger.log(`Fetching fixtures for date: ${today}`);
      const response = await this.apiClient.getFixturesByDate(today);

      // Log the request
      await this.rateLimiter.logRequest(
        '/fixtures',
        { date: today },
        200,
        response.results,
      );

      // Update sync plan
      await this.syncPlan.updateLastSyncTime();
      await this.syncPlan.incrementRequestsUsed();

      // Process each fixture
      let updatedCount = 0;
      for (const fixture of response.response) {
        const updated = await this.updateMatchFromFixture(fixture);
        if (updated) updatedCount++;
      }

      this.logger.log(
        `Sync completed: ${updatedCount} matches updated from ${response.results} fixtures`,
      );

      await this.monitoring.createLog({
        type: options.logType,
        status: SyncLogStatus.SUCCESS,
        message: `${options.summaryLabel} completed successfully`,
        requestsUsed: 1,
        matchesUpdated: updatedCount,
        duration: Date.now() - startedAt,
        details: JSON.stringify({
          fixturesFetched: response.results,
          date: today,
        }),
        triggeredBy: options.triggeredBy,
      });

      if (response.results > 0 && updatedCount === 0) {
        await this.monitoring.createAlert({
          type: SyncAlertType.NO_MATCHES_UPDATED,
          severity: SyncAlertLevel.INFO,
          message: 'Football Sync consultó fixtures, pero no encontró partidos locales para actualizar.',
          details: JSON.stringify({
            fixturesFetched: response.results,
            date: today,
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
        message: `Football Sync falló: ${error.message}`,
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

      // Process each fixture
      let updatedCount = 0;
      for (const fixture of response.response) {
        const updated = await this.updateMatchFromFixture(fixture);
        if (updated) updatedCount++;
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
        this.logger.debug(
          `No match found for external ID: ${fixture.fixture.id}`,
        );
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

      // Update match
      const updatedMatch = await this.prisma.match.update({
        where: { id: match.id },
        data: {
          ...(homeTeamId !== match.homeTeamId ? { homeTeamId } : {}),
          ...(awayTeamId !== match.awayTeamId ? { awayTeamId } : {}),
          homeScore: fixture.goals.home,
          awayScore: fixture.goals.away,
          status,
          lastSyncAt: new Date(),
          syncCount: { increment: 1 },
        },
      });

      this.logger.log(
        `Updated match ${match.id}: ${fixture.teams.home.name} ${fixture.goals.home ?? '-'} - ${fixture.goals.away ?? '-'} ${fixture.teams.away.name} (${status})`,
      );

      // If score changed and match is finished, calculate points and send results email
      if (scoreChanged && status === MatchStatus.FINISHED) {
        this.logger.log(`Match ${match.id} finished, calculating points`);
        await this.predictionsService.calculateMatchPoints(match.id);
        this.predictionReport.sendMatchResultsReport(match.id).catch(err =>
          this.logger.error(`Error sending results email for match ${match.id}: ${err.message}`),
        );

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
        this.predictionsService.calculatePhaseBonuses(match.id).catch(err =>
          this.logger.error(`Error calculating phase bonuses for match ${match.id}: ${err.message}`),
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
          message: 'No se encontraron candidatos con suficiente confianza para vincular automáticamente.',
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
        ? `Auto-vinculado a ${candidate!.homeTeam} vs ${candidate!.awayTeam} (confianza: ${candidate!.confidence}) y ${synced ? 'sincronizado correctamente' : 'sincronización falló'}.`
        : synced ? 'Sincronizado correctamente.' : 'Sincronización falló.',
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
        const updated = await this.updateMatchFromFixture(fixture);
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
        message: `La sincronización del partido ${matchId} falló: ${error.message}`,
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
      reasons.push('Mismo día con ventana horaria compatible');
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
}
