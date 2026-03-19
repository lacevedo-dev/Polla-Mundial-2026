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
  TeamCatalogBackfillResultDto,
} from './dto/api-football.dto';
import { IsString } from 'class-validator';

class LinkMatchDto {
  @IsString()
  externalId: string;
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
  ) {}

  /**
   * Get current sync usage and plan
   */
  @Get('usage')
  @ApiOperation({ summary: 'Get API-Football usage and sync plan for today' })
  async getUsage(): Promise<SyncUsageDto> {
    const plan = await this.syncPlan.calculateDailyPlan();
    const used = await this.rateLimiter.getUsedRequestsToday();
    const available = await this.rateLimiter.getAvailableRequests();
    const limit = this.rateLimiter.getDailyLimit();

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
        scheduled: 0, // Would need separate query
        live: 0, // Would need separate query
        finished: 0, // Would need separate query
        total: plan.totalMatches,
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
}
