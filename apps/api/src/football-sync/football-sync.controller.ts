import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SyncPlanService } from './services/sync-plan.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { MatchSyncService } from './services/match-sync.service';
import { AdaptiveSyncScheduler } from './schedulers/adaptive-sync.scheduler';
import {
  SyncUsageDto,
  MatchLinkCandidateDto,
  TeamCatalogBackfillResultDto,
} from './dto/api-football.dto';
import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { Query } from '@nestjs/common';
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
  ) {}

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
   * Get detailed request logs for today
   */
  @Get('requests/today')
  @ApiOperation({ summary: 'Get detailed request logs for today' })
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
