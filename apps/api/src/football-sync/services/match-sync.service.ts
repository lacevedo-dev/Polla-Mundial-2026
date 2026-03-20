import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionsService } from '../../predictions/predictions.service';
import { ApiFootballClient } from './api-football-client.service';
import { RateLimiterService } from './rate-limiter.service';
import { SyncPlanService } from './sync-plan.service';
import { MatchStatus, Prisma, Team } from '@prisma/client';
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
    try {
      // Check rate limit
      if (!(await this.rateLimiter.canMakeRequest())) {
        this.logger.warn('Rate limit reached, skipping sync');
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

      return {
        success: true,
        matchesUpdated: updatedCount,
      };
    } catch (error) {
      this.logger.error(`Sync failed: ${error.message}`, error.stack);
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
    try {
      // Check rate limit
      if (!(await this.rateLimiter.canMakeRequest())) {
        this.logger.warn('Rate limit reached, skipping live sync');
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

      return {
        success: true,
        matchesUpdated: updatedCount,
      };
    } catch (error) {
      this.logger.error(`Live sync failed: ${error.message}`, error.stack);
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
      await this.prisma.match.update({
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

      // If score changed and match is finished, calculate points
      if (scoreChanged && status === MatchStatus.FINISHED) {
        this.logger.log(`Match ${match.id} finished, calculating points`);
        await this.predictionsService.calculateMatchPoints(match.id);
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
    try {
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
      });

      if (!match || !match.externalId) {
        this.logger.warn(`Match ${matchId} not found or has no external ID`);
        return false;
      }

      // Check rate limit
      if (!(await this.rateLimiter.canMakeRequest())) {
        this.logger.warn('Rate limit reached, cannot sync match');
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
        return await this.updateMatchFromFixture(response.response[0]);
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to sync match ${matchId}: ${error.message}`);
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
