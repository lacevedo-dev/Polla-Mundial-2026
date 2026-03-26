import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RateLimiterService } from './rate-limiter.service';
import { MatchStatus, SyncStrategy } from '@prisma/client';
import { DailySyncPlanDto } from '../dto/api-football.dto';
import { ConfigService as FootballConfigService } from './config.service';

export interface MatchSyncSlot {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag?: string | null;
  awayFlag?: string | null;
  matchDate: string;
  status: string;
  externalId: string | null;
  syncSlots: string[];        // ISO timestamps when this match will be synced
  notificationSchedule: {
    type: 'MATCH_REMINDER' | 'PREDICTION_CLOSED' | 'RESULT_PUBLISHED';
    label: string;
    scheduledAt: string;
  }[];
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  requestsAssigned: number;
}

export interface DetailedSyncTimeline {
  date: string;
  strategy: SyncStrategy;
  intervalMinutes: number;
  requestsUsed: number;
  requestsBudget: number;
  requestsLimit: number;
  nextSyncAt: string | null;
  matches: MatchSyncSlot[];
  requestLog: {
    hour: number;        // 0-23
    requests: number;    // calls in that hour
    slots: string[];     // ISO timestamps of calls planned that hour
  }[];
  totalSlotsPlanned: number;
}

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

    // No live matches — check if any SCHEDULED match with externalId already started
    // (chicken-and-egg: they can't become LIVE without a sync)
    if (!plan.hasLiveMatches) {
      const potentiallyLive = await this.countPotentiallyLiveMatches();
      if (potentiallyLive === 0) {
        return false;
      }
      this.logger.debug(`No LIVE matches but ${potentiallyLive} potentially live — triggering sync`);
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
   * Count SCHEDULED matches with externalId that already started (within match duration window).
   * Used to break the chicken-and-egg: no LIVE → no sync → never becomes LIVE.
   */
  async countPotentiallyLiveMatches(): Promise<number> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 130 * 60 * 1000); // match + 10min buffer
    return this.prisma.match.count({
      where: {
        status: MatchStatus.SCHEDULED,
        externalId: { not: null },
        matchDate: { gte: windowStart, lte: now },
      },
    });
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
   * Build a detailed per-match sync timeline for today including
   * exact sync slots and notification schedule.
   */
  async getDetailedTimeline(): Promise<DetailedSyncTimeline> {
    const plan = await this.calculateDailyPlan();
    const [used, limit] = await Promise.all([
      this.rateLimiter.getUsedRequestsToday(),
      this.rateLimiter.getDailyLimit(),
    ]);
    const available = limit - used;

    const todayStart = this.getTodayStart();
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const matches = await this.prisma.match.findMany({
      where: {
        matchDate: { gte: todayStart, lt: todayEnd },
      },
      include: {
        homeTeam: { select: { id: true, name: true, flagUrl: true, code: true } },
        awayTeam: { select: { id: true, name: true, flagUrl: true, code: true } },
        syncLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, status: true },
        },
      },
      orderBy: { matchDate: 'asc' },
    });

    const intervalMs = plan.intervalMinutes * 60 * 1000;
    const now = new Date();

    // Build sync slots starting from now until end of day
    const buildSyncSlots = (matchDate: Date): string[] => {
      const slots: string[] = [];
      const matchStart = matchDate;
      const matchEnd = new Date(matchDate.getTime() + 130 * 60 * 1000); // match + 10min buffer

      let cursor = new Date(Math.max(now.getTime(), matchStart.getTime() - 5 * 60 * 1000));

      while (cursor <= matchEnd && cursor < todayEnd) {
        slots.push(cursor.toISOString());
        cursor = new Date(cursor.getTime() + intervalMs);
      }

      return slots.slice(0, 30); // cap to prevent huge payloads
    };

    const buildNotifications = (matchDate: Date, status: string, closePredictionMinutes = 15) => {
      const notifications: MatchSyncSlot['notificationSchedule'] = [];
      const md = matchDate.getTime();

      if (status === 'SCHEDULED' || status === 'LIVE') {
        // Reminder 1 hour before
        if (md - 60 * 60 * 1000 > now.getTime()) {
          notifications.push({
            type: 'MATCH_REMINDER',
            label: 'Aviso 1h antes del partido',
            scheduledAt: new Date(md - 60 * 60 * 1000).toISOString(),
          });
        }
        // Prediction close warning
        if (md - closePredictionMinutes * 60 * 1000 > now.getTime()) {
          notifications.push({
            type: 'PREDICTION_CLOSED',
            label: `Cierre de predicciones (${closePredictionMinutes} min antes)`,
            scheduledAt: new Date(md - closePredictionMinutes * 60 * 1000).toISOString(),
          });
        }
      }

      if (status === 'FINISHED') {
        notifications.push({
          type: 'RESULT_PUBLISHED',
          label: 'Resultado publicado',
          scheduledAt: new Date(md + 10 * 60 * 1000).toISOString(),
        });
      }

      return notifications;
    };

    // Distribute available requests across matches
    const requestsPerMatch = matches.length > 0
      ? Math.max(1, Math.floor(available / matches.length))
      : 0;

    const matchSlots: MatchSyncSlot[] = matches.map((m) => {
      const slots = buildSyncSlots(m.matchDate);
      return {
        matchId: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        homeFlag: m.homeTeam.flagUrl,
        awayFlag: m.awayTeam.flagUrl,
        matchDate: m.matchDate.toISOString(),
        status: m.status,
        externalId: m.externalId,
        syncSlots: slots,
        notificationSchedule: buildNotifications(m.matchDate, m.status),
        lastSyncAt: m.syncLogs[0]?.createdAt?.toISOString() ?? null,
        lastSyncStatus: m.syncLogs[0]?.status ?? null,
        requestsAssigned: Math.min(slots.length, requestsPerMatch),
      };
    });

    // Build hourly request distribution
    const hourBuckets: Record<number, string[]> = {};
    for (let h = 0; h < 24; h++) hourBuckets[h] = [];

    matchSlots.forEach((m) =>
      m.syncSlots.forEach((slot) => {
        const h = new Date(slot).getHours();
        hourBuckets[h].push(slot);
      }),
    );

    const requestLog = Object.entries(hourBuckets).map(([hour, slots]) => ({
      hour: Number(hour),
      requests: slots.length,
      slots,
    }));

    const totalSlotsPlanned = matchSlots.reduce((s, m) => s + m.syncSlots.length, 0);
    const nextSyncAt = matchSlots
      .flatMap((m) => m.syncSlots)
      .sort()
      .find((s) => s > now.toISOString()) ?? null;

    return {
      date: plan.date,
      strategy: plan.strategy,
      intervalMinutes: plan.intervalMinutes,
      requestsUsed: used,
      requestsBudget: available,
      requestsLimit: limit,
      nextSyncAt,
      matches: matchSlots,
      requestLog,
      totalSlotsPlanned,
    };
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
