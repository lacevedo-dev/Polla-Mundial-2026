import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionsService } from '../../predictions/predictions.service';
import { ApiFootballClient } from './api-football-client.service';
import { RateLimiterService } from './rate-limiter.service';
import { SyncPlanService } from './sync-plan.service';
import { MatchStatus } from '@prisma/client';
import { ApiFootballFixture } from '../dto/api-football.dto';

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
      });

      if (!match) {
        this.logger.debug(
          `No match found for external ID: ${fixture.fixture.id}`,
        );
        return false;
      }

      // Map API-Football status to our status
      const status = this.mapFixtureStatus(fixture.fixture.status.short);

      // Check if scores changed
      const scoreChanged =
        match.homeScore !== fixture.goals.home ||
        match.awayScore !== fixture.goals.away;

      // Update match
      await this.prisma.match.update({
        where: { id: match.id },
        data: {
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
}
