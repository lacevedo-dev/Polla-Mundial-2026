import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RateLimiterService } from './rate-limiter.service';
import { MatchStatus, SyncStrategy } from '@prisma/client';
import { DailySyncPlanDto } from '../dto/api-football.dto';
import { ConfigService as FootballConfigService } from './config.service';

@Injectable()
export class SyncPlanService {
  private readonly logger = new Logger(SyncPlanService.name);
  private readonly avgMatchDuration = 120; // minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimiter: RateLimiterService,
    private readonly configService: ConfigService,
    private readonly footballConfigService: FootballConfigService,
  ) {}

  /**
   * Calculate optimal daily sync plan based on today's matches
   */
  async calculateDailyPlan(): Promise<DailySyncPlanDto> {
    const today = this.getToday();

    // Get existing plan or create new
    let plan = await this.prisma.dailySyncPlan.findUnique({
      where: { date: today },
    });

    // Get current match counts
    const matches = await this.getMatchesToday();
    const usedRequests = await this.rateLimiter.getUsedRequestsToday();
    const available = await this.rateLimiter.getAvailableRequests();
    const { minInterval, maxInterval } = await this.getIntervalBounds();

    // Calculate optimal interval
    const { intervalMinutes, strategy, estimatedTotal } =
      this.calculateOptimalInterval(
        matches.total,
        matches.live,
        available,
        usedRequests,
        minInterval,
        maxInterval,
      );

    // Update or create plan
    if (plan) {
      plan = await this.prisma.dailySyncPlan.update({
        where: { id: plan.id },
        data: {
          totalMatches: matches.total,
          requestsUsed: usedRequests,
          requestsBudget: available,
          intervalMinutes,
          strategy,
        },
      });
    } else {
      plan = await this.prisma.dailySyncPlan.create({
        data: {
          date: today,
          totalMatches: matches.total,
          requestsUsed: usedRequests,
          requestsBudget: available,
          intervalMinutes,
          strategy,
        },
      });
    }

    // Calculate next sync time
    const nextSyncIn = this.getSecondsUntilNextSync(
      plan.lastSyncAt,
      intervalMinutes,
    );

    return {
      date: today,
      totalMatches: matches.total,
      requestBudget: available,
      intervalMinutes,
      estimatedRequestsUsed: estimatedTotal,
      strategy,
      hasLiveMatches: matches.live > 0,
      nextSyncIn,
      lastSync: plan.lastSyncAt?.toISOString() || null,
    };
  }

  /**
   * Calculate optimal sync interval based on available resources
   */
  private calculateOptimalInterval(
    totalMatches: number,
    liveMatches: number,
    availableRequests: number,
    usedRequests: number,
    minInterval: number,
    maxInterval: number,
  ): {
    intervalMinutes: number;
    strategy: SyncStrategy;
    estimatedTotal: number;
  } {
    // No matches = no sync needed
    if (totalMatches === 0) {
      return {
        intervalMinutes: maxInterval,
        strategy: SyncStrategy.BALANCED,
        estimatedTotal: usedRequests,
      };
    }

    // Emergency mode: very few requests left
    if (availableRequests <= 5) {
      this.logger.warn(`EMERGENCY MODE: Only ${availableRequests} requests left`);
      return {
        intervalMinutes: maxInterval,
        strategy: SyncStrategy.EMERGENCY,
        estimatedTotal: usedRequests + Math.min(availableRequests, 5),
      };
    }

    // Calculate requests per match
    const requestsPerMatch = Math.floor(availableRequests / totalMatches);

    // If we have live matches, prioritize them
    if (liveMatches > 0) {
      const requestsPerLiveMatch = Math.floor(
        availableRequests / liveMatches,
      );

      // Aggressive: lots of requests per match
      if (requestsPerLiveMatch >= 20) {
        const interval = Math.max(
          minInterval,
          Math.ceil(this.avgMatchDuration / requestsPerLiveMatch),
        );
        return {
          intervalMinutes: interval,
          strategy: SyncStrategy.AGGRESSIVE,
          estimatedTotal: usedRequests + liveMatches * 20,
        };
      }

      // Balanced: moderate requests per match
      if (requestsPerLiveMatch >= 10) {
        const interval = Math.max(
          minInterval,
          Math.ceil(this.avgMatchDuration / requestsPerLiveMatch),
        );
        return {
          intervalMinutes: interval,
          strategy: SyncStrategy.BALANCED,
          estimatedTotal: usedRequests + liveMatches * 12,
        };
      }

      // Conservative: few requests per match
      const interval = Math.min(
        maxInterval,
        Math.ceil(this.avgMatchDuration / Math.max(5, requestsPerLiveMatch)),
      );
      return {
        intervalMinutes: interval,
        strategy: SyncStrategy.CONSERVATIVE,
        estimatedTotal: usedRequests + liveMatches * 6,
      };
    }

    // No live matches, use balanced approach
    const interval = Math.max(
      minInterval,
      Math.min(maxInterval, requestsPerMatch * 2),
    );

    return {
      intervalMinutes: interval,
      strategy: SyncStrategy.BALANCED,
      estimatedTotal: usedRequests + Math.ceil(totalMatches * 0.5),
    };
  }

  /**
   * Get today's matches statistics
   */
  async getMatchesToday(): Promise<{
    total: number;
    scheduled: number;
    live: number;
    finished: number;
  }> {
    const todayStart = this.getTodayStart();
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const matches = await this.prisma.match.groupBy({
      by: ['status'],
      where: {
        matchDate: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
      _count: true,
    });

    const stats = {
      total: 0,
      scheduled: 0,
      live: 0,
      finished: 0,
    };

    matches.forEach((group) => {
      const count = group._count;
      stats.total += count;

      if (group.status === MatchStatus.SCHEDULED) {
        stats.scheduled = count;
      } else if (group.status === MatchStatus.LIVE) {
        stats.live = count;
      } else if (group.status === MatchStatus.FINISHED) {
        stats.finished = count;
      }
    });

    return stats;
  }

  /**
   * Update last sync time in plan
   */
  async updateLastSyncTime(): Promise<void> {
    const today = this.getToday();

    await this.prisma.dailySyncPlan.updateMany({
      where: { date: today },
      data: { lastSyncAt: new Date() },
    });
  }

  /**
   * Increment requests used counter
   */
  async incrementRequestsUsed(): Promise<void> {
    const today = this.getToday();

    await this.prisma.dailySyncPlan.updateMany({
      where: { date: today },
      data: {
        requestsUsed: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Check if sync should happen now based on plan
   */
  async shouldSyncNow(): Promise<boolean> {
    if (!(await this.footballConfigService.isAutoSyncEnabled())) {
      this.logger.debug('Auto sync is disabled by configuration');
      return false;
    }

    const plan = await this.calculateDailyPlan();

    // No live matches = no sync needed
    if (!plan.hasLiveMatches) {
      return false;
    }

    // No requests available = can't sync
    if (plan.requestBudget <= 0) {
      this.logger.warn('Cannot sync: no requests available');
      return false;
    }

    // Emergency mode = only sync if critical
    if (plan.strategy === SyncStrategy.EMERGENCY && plan.requestBudget <= 2) {
      this.logger.warn('EMERGENCY: Skipping non-critical sync');
      return false;
    }

    // Check if enough time has passed since last sync
    if (plan.nextSyncIn > 0) {
      return false;
    }

    return true;
  }

  /**
   * Calculate seconds until next sync
   */
  private getSecondsUntilNextSync(
    lastSyncAt: Date | null,
    intervalMinutes: number,
  ): number {
    if (!lastSyncAt) {
      return 0; // Sync immediately if never synced
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    const elapsed = Date.now() - lastSyncAt.getTime();
    const remaining = intervalMs - elapsed;

    return Math.max(0, Math.ceil(remaining / 1000));
  }

  private async getIntervalBounds(): Promise<{
    minInterval: number;
    maxInterval: number;
  }> {
    try {
      const intervals = await this.footballConfigService.getSyncIntervals();
      return {
        minInterval: intervals.min,
        maxInterval: intervals.max,
      };
    } catch (error) {
      return {
        minInterval: parseInt(
          this.configService.get<string>('MIN_SYNC_INTERVAL_MINUTES', '5'),
          10,
        ),
        maxInterval: parseInt(
          this.configService.get<string>('MAX_SYNC_INTERVAL_MINUTES', '30'),
          10,
        ),
      };
    }
  }

  /**
   * Get today's date string (YYYY-MM-DD)
   */
  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get start of today
   */
  private getTodayStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }
}
