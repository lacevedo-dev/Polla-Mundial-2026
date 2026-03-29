import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService as FootballConfigService } from './config.service';

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly fallbackDailyLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly footballConfigService: FootballConfigService,
  ) {
    this.fallbackDailyLimit = parseInt(
      this.configService.get<string>('API_FOOTBALL_DAILY_LIMIT', '100'),
      10,
    );
  }

  /**
   * Check if a request can be made without exceeding daily limit
   */
  async canMakeRequest(): Promise<boolean> {
    const usedToday = await this.getUsedRequestsToday();
    const dailyLimit = await this.getDailyLimit();
    const canProceed = usedToday < dailyLimit;

    if (!canProceed) {
      this.logger.warn(
        `Daily limit reached: ${usedToday}/${dailyLimit} requests used`,
      );
    }

    return canProceed;
  }

  /**
   * Get number of requests used today
   */
  async getUsedRequestsToday(): Promise<number> {
    const today = this.getTodayStart();

    const count = await this.prisma.apiFootballRequest.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    });

    return count;
  }

  /**
   * Get available requests for today
   */
  async getAvailableRequests(): Promise<number> {
    const used = await this.getUsedRequestsToday();
    const dailyLimit = await this.getDailyLimit();
    return Math.max(0, dailyLimit - used);
  }

  /**
   * Log a request to the database
   */
  async logRequest(
    endpoint: string,
    params: Record<string, unknown>,
    responseStatus: number,
    matchesFetched: number = 0,
  ): Promise<void> {
    try {
      await this.prisma.apiFootballRequest.create({
        data: {
          endpoint,
          params: params as any,
          responseStatus,
          matchesFetched,
        },
      });

      const usedToday = await this.getUsedRequestsToday();
      const dailyLimit = await this.getDailyLimit();
      this.logger.log(
        `Request logged: ${endpoint} (${usedToday}/${dailyLimit} used today)`,
      );

      // Warning thresholds
      if (usedToday >= dailyLimit * 0.95) {
        this.logger.warn(
          `CRITICAL: 95% of daily limit consumed (${usedToday}/${dailyLimit})`,
        );
      } else if (usedToday >= dailyLimit * 0.8) {
        this.logger.warn(
          `WARNING: 80% of daily limit consumed (${usedToday}/${dailyLimit})`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to log request: ${error.message}`);
    }
  }

  /**
   * Get requests made today with details
   */
  async getTodayRequests() {
    const today = this.getTodayStart();

    return this.prisma.apiFootballRequest.findMany({
      where: {
        createdAt: {
          gte: today,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get the most recent N requests regardless of date
   */
  async getRecentRequests(limit = 100) {
    return this.prisma.apiFootballRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get daily limit
   */
  async getDailyLimit(): Promise<number> {
    try {
      const persistedLimit = await this.footballConfigService.getDailyLimit();
      if (persistedLimit > 0) {
        return persistedLimit;
      }
    } catch (error) {
      this.logger.warn(
        `Falling back to env daily limit: ${error.message}`,
      );
    }

    return this.fallbackDailyLimit;
  }

  /**
   * Get usage percentage
   */
  async getUsagePercentage(): Promise<number> {
    const used = await this.getUsedRequestsToday();
    const dailyLimit = await this.getDailyLimit();
    return Math.round((used / dailyLimit) * 100);
  }

  /**
   * Get start of today in UTC.
   * The API-Football quota resets at 00:00 UTC, so the request budget
   * window must align with the provider reset.
   */
  private getTodayStart(): Date {
    const now = new Date(Date.now());
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
      ),
    );
  }

  /**
   * Estimate if we can safely make N more requests today
   */
  async canMakeRequests(count: number): Promise<boolean> {
    const available = await this.getAvailableRequests();
    return available >= count;
  }
}
