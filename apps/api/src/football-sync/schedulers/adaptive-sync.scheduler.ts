import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncLogType } from '@prisma/client';
import { SyncPlanService } from '../services/sync-plan.service';
import { MatchSyncService } from '../services/match-sync.service';
import { ConfigService as FootballConfigService } from '../services/config.service';
import { SyncEventsService } from '../services/sync-events.service';

@Injectable()
export class AdaptiveSyncScheduler {
  private readonly logger = new Logger(AdaptiveSyncScheduler.name);
  private isSyncing = false;

  constructor(
    private readonly syncPlan: SyncPlanService,
    private readonly matchSync: MatchSyncService,
    private readonly footballConfigService: FootballConfigService,
    private readonly syncEvents: SyncEventsService,
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

    if (!(await this.footballConfigService.isAutoSyncEnabled())) {
      this.logger.debug('Auto sync disabled, skipping adaptive tick');
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
    if (!(await this.footballConfigService.isAutoSyncEnabled())) {
      this.logger.debug('Auto sync disabled, skipping yesterday sync');
      return;
    }

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

    if (!(await this.footballConfigService.isPeakHoursSyncEnabled())) {
      this.logger.debug('Peak-hours sync disabled, skipping peak-hours tick');
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
    const startedAt = Date.now();

    try {
      // Emit sync_started before sync
      const todayMatchCount = await this.syncPlan.calculateDailyPlan().then(p => p.totalMatches).catch(() => 0);
      this.syncEvents.emit({
        type: 'sync_started',
        data: { trigger: 'auto', matchCount: todayMatchCount },
        timestamp: new Date().toISOString(),
      });

      const result = await this.matchSync.syncTodayMatchesForTrigger({
        logType: SyncLogType.CRON_SYNC,
        summaryLabel: 'Cron sync',
        triggeredBy: 'scheduler',
      });

      if (result.success) {
        this.logger.log(
          `Sync successful: ${result.matchesUpdated} matches updated`,
        );
        const plan = await this.syncPlan.calculateDailyPlan().catch(() => null);
        this.syncEvents.emit({
          type: 'sync_completed',
          data: {
            matchesUpdated: result.matchesUpdated,
            requestsUsed: plan?.estimatedRequestsUsed ?? 0,
            duration: Date.now() - startedAt,
          },
          timestamp: new Date().toISOString(),
        });

        // Emit plan_updated after recalculation
        if (plan) {
          this.syncEvents.emit({
            type: 'plan_updated',
            data: {
              strategy: plan.strategy,
              intervalMinutes: plan.intervalMinutes,
              requestsUsed: plan.estimatedRequestsUsed,
              requestsAvailable: plan.requestBudget,
            },
            timestamp: new Date().toISOString(),
          });

          // Emit rate_limit_warning if >= 80% used
          const limit = plan.requestBudget + plan.estimatedRequestsUsed;
          if (limit > 0 && plan.estimatedRequestsUsed / limit >= 0.8) {
            this.syncEvents.emit({
              type: 'rate_limit_warning',
              data: {
                remaining: plan.requestBudget,
                limit,
                percentage: Math.round((plan.estimatedRequestsUsed / limit) * 100),
              },
              timestamp: new Date().toISOString(),
            });
          }
        }
      } else {
        this.logger.warn(`Sync completed with issues: ${result.error}`);
        this.syncEvents.emit({
          type: 'sync_failed',
          data: { error: result.error ?? 'Unknown error' },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Sync execution failed: ${error.message}`);
      this.syncEvents.emit({
        type: 'sync_failed',
        data: { error: error.message },
        timestamp: new Date().toISOString(),
      });
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
      if (!(await this.footballConfigService.isEnabled())) {
        return {
          success: false,
          message: 'Football Sync is disabled',
        };
      }

      const plan = await this.syncPlan.calculateDailyPlan();

      if (plan.requestBudget <= 0) {
        return {
          success: false,
          message: 'No requests available for today',
        };
      }

      this.logger.log('Manual sync triggered');
      this.isSyncing = true;

      const result = await this.matchSync.syncTodayMatchesForTrigger({
        logType: SyncLogType.MANUAL_SYNC,
        summaryLabel: 'Manual sync',
        triggeredBy: 'manual',
      });

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
