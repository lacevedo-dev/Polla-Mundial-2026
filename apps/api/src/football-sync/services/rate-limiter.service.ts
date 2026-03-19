import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly dailyLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.dailyLimit = parseInt(
      this.configService.get<string>('API_FOOTBALL_DAILY_LIMIT', '100'),
      10,
    );
  }

  /**
   * Check if a request can be made without exceeding daily limit
   */
  async canMakeRequest(): Promise<boolean> {
    const usedToday = await this.getUsedRequestsToday();
    const canProceed = usedToday < this.dailyLimit;

    if (!canProceed) {
      this.logger.warn(
        `Daily limit reached: ${usedToday}/${this.dailyLimit} requests used`,
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
    return Math.max(0, this.dailyLimit - used);
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
      this.logger.log(
        `Request logged: ${endpoint} (${usedToday}/${this.dailyLimit} used today)`,
      );

      // Warning thresholds
      if (usedToday >= this.dailyLimit * 0.95) {
        this.logger.warn(
          `CRITICAL: 95% of daily limit consumed (${usedToday}/${this.dailyLimit})`,
        );
      } else if (usedToday >= this.dailyLimit * 0.8) {
        this.logger.warn(
          `WARNING: 80% of daily limit consumed (${usedToday}/${this.dailyLimit})`,
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
   * Get daily limit
   */
  getDailyLimit(): number {
    return this.dailyLimit;
  }

  /**
   * Get usage percentage
   */
  async getUsagePercentage(): Promise<number> {
    const used = await this.getUsedRequestsToday();
    return Math.round((used / this.dailyLimit) * 100);
  }

  /**
   * Get start of today in local timezone
   */
  private getTodayStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }

  /**
   * Estimate if we can safely make N more requests today
   */
  async canMakeRequests(count: number): Promise<boolean> {
    const available = await this.getAvailableRequests();
    return available >= count;
  }
}
