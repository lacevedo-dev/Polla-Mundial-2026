import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Req,
  Sse,
  MessageEvent,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SyncPlanService } from './services/sync-plan.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { MatchSyncService } from './services/match-sync.service';
import { AdaptiveSyncScheduler } from './schedulers/adaptive-sync.scheduler';
import { SyncEventsService } from './services/sync-events.service';
import {
  SyncUsageDto,
  MatchLinkCandidateDto,
  TeamCatalogBackfillResultDto,
} from './dto/api-football.dto';
import { IsString, IsNumber, IsBoolean, IsOptional, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { TournamentImportService } from './services/tournament-import.service';

class LinkMatchDto {
  @IsString()
  externalId: string;
}

class ImportTournamentDto {
  @IsNumber() @Type(() => Number) leagueId: number;
  @IsNumber() @Type(() => Number) season: number;
  @IsBoolean() @IsOptional() createTeams?: boolean;
  @IsBoolean() @IsOptional() overwriteExisting?: boolean;
  @IsBoolean() @IsOptional() dryRun?: boolean;
}

class ImportFixturesDto {
  @IsArray() @IsNumber({}, { each: true }) @Type(() => Number) fixtureIds: number[];
  @IsBoolean() @IsOptional() createTeams?: boolean;
  @IsBoolean() @IsOptional() overwriteExisting?: boolean;
  @IsString() @IsOptional() tournamentName?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/football')
export class FootballSyncController {
  constructor(
    private readonly syncPlan: SyncPlanService,
    private readonly rateLimiter: RateLimiterService,
    private readonly matchSync: MatchSyncService,
    private readonly scheduler: AdaptiveSyncScheduler,
    private readonly tournamentImport: TournamentImportService,
    private readonly syncEvents: SyncEventsService,
  ) {}

  /**
   * SSE stream — admin receives live sync events without polling
   */
  @Sse('events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'SSE stream of live sync events' })
  syncEventStream(@Res() res: Response): Observable<MessageEvent> {
    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25000);
    res.on('close', () => clearInterval(heartbeat));

    return this.syncEvents.getObservable().pipe(
      map((event): MessageEvent => ({
        type: event.type,
        data: JSON.stringify(event.data),
        id: String(event.timestamp),
      })),
    );
  }

  /**
   * Get detailed per-match sync timeline for today
   */
  @Get('plan/timeline')
  @ApiOperation({ summary: 'Get per-match sync timeline for today with notification schedule' })
  async getSyncTimeline() {
    return this.syncPlan.getDetailedTimeline();
  }

  /**
   * Get a simple API-Football usage summary (used / remaining / limit)
   */
  @Get('usage/summary')
  @ApiOperation({ summary: 'Simple API-Football request usage summary' })
  async getUsageSummary() {
    const [used, available, limit] = await Promise.all([
      this.rateLimiter.getUsedRequestsToday(),
      this.rateLimiter.getAvailableRequests(),
      this.rateLimiter.getDailyLimit(),
    ]);
    return {
      used,
      remaining: available,
      limit,
      percentage: Math.round((used / limit) * 100),
    };
  }

  /**
   * Get current sync usage and plan
   */
  @Get('usage')
  @ApiOperation({ summary: 'Get API-Football usage and sync plan for today' })
  async getUsage(): Promise<SyncUsageDto> {
    const plan = await this.syncPlan.calculateDailyPlan();
    const matches = await this.syncPlan.getMatchesToday();
    const used = await this.rateLimiter.getUsedRequestsToday();
    const available = await this.rateLimiter.getAvailableRequests();
    const limit = await this.rateLimiter.getDailyLimit();

    // Calculate forecast confidence
    const usageRatio = used / limit;
    let confidence: 'low' | 'medium' | 'high' = 'high';
    if (usageRatio > 0.9) confidence = 'low';
    else if (usageRatio > 0.7) confidence = 'medium';

    // Format next sync time
    const nextSyncIn =
      plan.nextSyncIn > 0
        ? `${Math.floor(plan.nextSyncIn / 60)} min ${plan.nextSyncIn % 60} sec`
        : 'Ready to sync';

    return {
      today: plan.date,
      matches: {
        scheduled: matches.scheduled,
        live: matches.live,
        finished: matches.finished,
        total: matches.total,
      },
      requests: {
        used,
        available,
        budget: plan.requestBudget,
        limit,
      },
      sync: {
        intervalMinutes: plan.intervalMinutes,
        strategy: plan.strategy,
        nextSyncIn,
        lastSync: plan.lastSync,
      },
      forecast: {
        estimatedTotal: plan.estimatedRequestsUsed,
        margin: limit - plan.estimatedRequestsUsed,
        confidence,
      },
    };
  }

  /**
   * Manually trigger a sync
   */
  @Post('sync-today')
  @ApiOperation({ summary: 'Manually trigger sync for today\'s matches' })
  async syncToday() {
    const result = await this.scheduler.triggerManualSync();

    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return {
      message: result.message,
      matchesUpdated: result.matchesUpdated,
    };
  }

  /**
   * Backfill canonical World Cup teams from curated catalog
   */
  @Post('backfill-teams')
  @ApiOperation({ summary: 'Backfill World Cup teams with canonical API-Football metadata' })
  async backfillTeams(): Promise<TeamCatalogBackfillResultDto & { message: string }> {
    const result = await this.matchSync.backfillWorldCupTeams();

    return {
      message: 'World Cup team catalog backfill completed',
      ...result,
    };
  }

  /**
   * Sync a specific match by ID
   */
  @Post('sync-match/:matchId')
  @ApiOperation({ summary: 'Sync a specific match by ID' })
  async syncMatch(@Param('matchId') matchId: string) {
    const success = await this.matchSync.syncMatchById(matchId);

    if (!success) {
      throw new HttpException(
        'Failed to sync match. Check if match has external ID and rate limit is available.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      message: 'Match synced successfully',
      matchId,
    };
  }

  /**
   * Auto-link to best candidate (if unlinked) then sync
   */
  @Post('auto-link-and-sync/:matchId')
  @ApiOperation({ summary: 'Auto-link match to best fixture candidate then sync' })
  async autoLinkAndSync(@Param('matchId') matchId: string, @Req() req: any) {
    return this.matchSync.autoLinkAndSync(matchId, req.user?.id);
  }

  /**
   * Bulk auto-link all unlinked SCHEDULED/LIVE matches
   */
  @Post('bulk-auto-link')
  @ApiOperation({ summary: 'Auto-link all unlinked SCHEDULED/LIVE matches to best API-Football candidates' })
  async bulkAutoLink(@Req() req: any) {
    return this.matchSync.bulkAutoLink(req.user?.id);
  }

  /**
   * Get API-Football request history for a specific match (by externalId)
   */
  @Get('match/:matchId/api-history')
  @ApiOperation({ summary: 'Get API-Football request history for a match' })
  async getMatchApiHistory(@Param('matchId') matchId: string) {
    return this.matchSync.getMatchApiHistory(matchId);
  }

  /**
   * Link a match to an API-Football fixture ID
   */
  @Patch('match/:matchId/link')
  @ApiOperation({ summary: 'Link a match to an API-Football fixture ID' })
  async linkMatch(
    @Param('matchId') matchId: string,
    @Body() dto: LinkMatchDto,
  ) {
    try {
      await this.matchSync.linkMatchToFixture(matchId, dto.externalId);

      return {
        message: 'Match linked successfully',
        matchId,
        externalId: dto.externalId,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to link match: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('match/:matchId/candidates')
  @ApiOperation({
    summary: 'Get candidate fixtures from API-Football to link a local match',
  })
  async getLinkCandidates(
    @Param('matchId') matchId: string,
  ): Promise<MatchLinkCandidateDto[]> {
    try {
      return await this.matchSync.findLinkCandidates(matchId);
    } catch (error) {
      throw new HttpException(
        `Failed to get fixture candidates: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get API-Football request logs for today (UTC, aligned to provider reset)
   */
  @Get('requests/today')
  @ApiOperation({ summary: 'Get today API-Football request logs (UTC)' })
  async getTodayRequests() {
    const requests = await this.rateLimiter.getTodayRequests();

    return {
      total: requests.length,
      requests: requests.map((req) => ({
        id: req.id,
        endpoint: req.endpoint,
        params: req.params,
        status: req.responseStatus,
        matchesFetched: req.matchesFetched,
        externalId: req.externalId,
        responseBody: req.responseBody,
        timestamp: req.createdAt,
      })),
    };
  }

  /**
   * Get scheduler status
   */
  @Get('status')
  @ApiOperation({ summary: 'Get sync scheduler status' })
  async getSchedulerStatus() {
    const status = this.scheduler.getStatus();
    const plan = await this.syncPlan.calculateDailyPlan();

    return {
      ...status,
      plan: {
        date: plan.date,
        strategy: plan.strategy,
        intervalMinutes: plan.intervalMinutes,
        hasLiveMatches: plan.hasLiveMatches,
      },
    };
  }

  /**
   * Get current sync plan details
   */
  @Get('plan')
  @ApiOperation({ summary: 'Get detailed daily sync plan' })
  async getSyncPlan() {
    return this.syncPlan.calculateDailyPlan();
  }

  /* ── Tournament import ─────────────────────────────────────────────── */

  @Get('tournaments')
  @ApiOperation({ summary: 'List all imported tournaments' })
  async listTournaments() {
    return this.tournamentImport.listTournaments();
  }

  @Get('teams/search')
  @ApiOperation({ summary: 'Search teams by name in API-Football' })
  async searchTeams(@Query('name') name: string) {
    if (!name) throw new HttpException('name query param required', HttpStatus.BAD_REQUEST);
    try {
      return await this.tournamentImport.searchTeams(name);
    } catch (error) {
      throw new HttpException(`Failed to search teams: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('fixtures/by-team')
  @ApiOperation({ summary: 'Get all fixtures for a team in a season' })
  async getFixturesByTeam(
    @Query('teamId') teamId: string,
    @Query('season') season: string,
  ) {
    if (!teamId || !season) throw new HttpException('teamId and season required', HttpStatus.BAD_REQUEST);
    try {
      return await this.tournamentImport.searchFixturesByTeam(Number(teamId), Number(season));
    } catch (error) {
      throw new HttpException(`Failed to get fixtures: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('fixtures/by-id')
  @ApiOperation({ summary: 'Get a specific fixture by its API-Football ID' })
  async getFixtureById(@Query('id') id: string) {
    if (!id || isNaN(Number(id))) throw new HttpException('id query param required (numeric)', HttpStatus.BAD_REQUEST);
    try {
      return await this.tournamentImport.searchFixtureById(Number(id));
    } catch (error) {
      throw new HttpException(`Failed to get fixture: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('fixtures/search')
  @ApiOperation({ summary: 'Search fixtures by date from API-Football' })
  async searchFixturesByDate(@Query('date') date: string) {
    if (!date) throw new HttpException('date query param required (YYYY-MM-DD)', HttpStatus.BAD_REQUEST);
    try {
      return await this.tournamentImport.searchFixturesByDateWithStatus(date);
    } catch (error) {
      throw new HttpException(`Failed to search fixtures: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('fixtures/import-selection')
  @ApiOperation({ summary: 'Import specific fixture IDs from API-Football' })
  async importFixtures(@Body() dto: ImportFixturesDto) {
    try {
      return await this.tournamentImport.importFixtures(
        dto.fixtureIds,
        { createTeams: dto.createTeams ?? true, overwriteExisting: dto.overwriteExisting ?? false },
        dto.tournamentName ?? 'Amistosos',
      );
    } catch (error) {
      throw new HttpException(`Import failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('diagnose')
  @ApiOperation({ summary: 'Diagnose raw API-Football response for a league+season' })
  async diagnose(
    @Query('leagueId') leagueId: string,
    @Query('season') season: string,
  ) {
    return this.tournamentImport.diagnose(Number(leagueId), Number(season));
  }

  @Get('leagues/search')
  @ApiOperation({ summary: 'Search leagues/tournaments in API-Football' })
  async searchLeagues(
    @Query('q') q: string,
    @Query('country') country?: string,
  ) {
    try {
      return await this.tournamentImport.searchLeagues(q, country);
    } catch (error) {
      throw new HttpException(
        `Failed to search leagues: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('tournaments/preview')
  @ApiOperation({ summary: 'Preview fixtures before importing a tournament' })
  async previewTournamentImport(
    @Query('leagueId') leagueId: string,
    @Query('season') season: string,
  ) {
    try {
      return await this.tournamentImport.previewImport(Number(leagueId), Number(season));
    } catch (error) {
      throw new HttpException(
        `Preview failed: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('tournaments/import')
  @ApiOperation({ summary: 'Import all fixtures and teams from a league/season' })
  async importTournament(@Body() dto: ImportTournamentDto) {
    try {
      return await this.tournamentImport.importTournament(
        dto.leagueId,
        dto.season,
        {
          createTeams: dto.createTeams ?? true,
          overwriteExisting: dto.overwriteExisting ?? false,
          dryRun: dto.dryRun ?? false,
        },
      );
    } catch (error) {
      throw new HttpException(
        `Import failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
