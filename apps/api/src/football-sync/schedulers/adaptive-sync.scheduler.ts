import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncPlanService } from '../services/sync-plan.service';
import { MatchSyncService } from '../services/match-sync.service';

@Injectable()
export class AdaptiveSyncScheduler {
  private readonly logger = new Logger(AdaptiveSyncScheduler.name);
  private isSyncing = false;

  constructor(
    private readonly syncPlan: SyncPlanService,
    private readonly matchSync: MatchSyncService,
  ) {}

  /**
   * Main adaptive sync tick - runs every minute
   * Decides whether to sync based on the daily plan
   */
  @Cron('*/1 * * * *') // Every minute
  async adaptiveSyncTick() {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      this.logger.debug('Sync already in progress, skipping tick');
      return;
    }

    try {
      // Check if we should sync now
      const shouldSync = await this.syncPlan.shouldSyncNow();

      if (shouldSync) {
        this.logger.log('Adaptive sync triggered');
        await this.executeSyncWithLock();
      }
    } catch (error) {
      this.logger.error(`Adaptive sync tick error: ${error.message}`);
    }
  }

  /**
   * Generate daily plan at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyPlan() {
    try {
      this.logger.log('Generating daily sync plan');
      const plan = await this.syncPlan.calculateDailyPlan();

      this.logger.log(
        `Daily plan created: ${plan.totalMatches} matches, ${plan.intervalMinutes}min interval, ${plan.strategy} strategy`,
      );
    } catch (error) {
      this.logger.error(`Failed to generate daily plan: ${error.message}`);
    }
  }

  /**
   * Sync yesterday's results at 2 AM (catch any missed updates)
   */
  @Cron('0 2 * * *') // 2 AM daily
  async syncYesterdayResults() {
    try {
      this.logger.log('Running yesterday results sync');

      // This is a safety net to ensure all matches from yesterday are finalized
      // It uses today's sync which will catch any stragglers
      await this.executeSyncWithLock();
    } catch (error) {
      this.logger.error(`Yesterday sync failed: ${error.message}`);
    }
  }

  /**
   * High-frequency sync during peak hours (9 AM - 11 PM)
   * Only runs if there are live matches
   */
  @Cron('*/5 9-23 * * *') // Every 5 minutes from 9 AM to 11 PM
  async peakHoursSync() {
    // Prevent concurrent syncs
    if (this.isSyncing) {
      return;
    }

    try {
      const plan = await this.syncPlan.calculateDailyPlan();

      // Only sync during peak hours if there are live matches
      if (plan.hasLiveMatches && plan.requestBudget > 0) {
        this.logger.log('Peak hours sync triggered (live matches detected)');
        await this.executeSyncWithLock();
      }
    } catch (error) {
      this.logger.error(`Peak hours sync error: ${error.message}`);
    }
  }

  /**
   * Execute sync with locking mechanism
   */
  private async executeSyncWithLock() {
    this.isSyncing = true;

    try {
      const result = await this.matchSync.syncTodayMatches();

      if (result.success) {
        this.logger.log(
          `Sync successful: ${result.matchesUpdated} matches updated`,
        );
      } else {
        this.logger.warn(`Sync completed with issues: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Sync execution failed: ${error.message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Manual sync trigger (can be called from controller)
   */
  async triggerManualSync(): Promise<{
    success: boolean;
    message: string;
    matchesUpdated?: number;
  }> {
    if (this.isSyncing) {
      return {
        success: false,
        message: 'Sync already in progress',
      };
    }

    try {
      const plan = await this.syncPlan.calculateDailyPlan();

      if (plan.requestBudget <= 0) {
        return {
          success: false,
          message: 'No requests available for today',
        };
      }

      this.logger.log('Manual sync triggered');
      this.isSyncing = true;

      const result = await this.matchSync.syncTodayMatches();

      return {
        success: result.success,
        message: result.error || 'Sync completed successfully',
        matchesUpdated: result.matchesUpdated,
      };
    } catch (error) {
      this.logger.error(`Manual sync failed: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isSyncing: boolean;
    lastError: string | null;
  } {
    return {
      isSyncing: this.isSyncing,
      lastError: null, // Can be enhanced to track last error
    };
  }
}
