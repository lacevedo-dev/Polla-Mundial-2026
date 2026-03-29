import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncLogType } from '@prisma/client';
import { observeSchedulerJob } from '../../common/scheduler-observability.util';
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
    await observeSchedulerJob(this.logger, 'adaptiveSyncTick', async () => {
      if (this.isSyncing) {
        return {
          status: 'skipped',
          summary: { reason: 'sync_in_progress' },
        };
      }

      this.isSyncing = true; // Claim lock before any await to prevent race condition
      try {
        if (!(await this.footballConfigService.isAutoSyncEnabled())) {
          return {
            status: 'skipped',
            summary: { reason: 'auto_sync_disabled' },
          };
        }

        const decision = await this.resolveFrequentSyncDecision();
        if (!decision.shouldSync) {
          return {
            status: 'skipped',
            summary: decision.summary,
          };
        }

        this.logger.log(decision.logMessage);
        const execution = await this.executeSyncWithLock(decision.trigger);

        return {
          status: 'completed',
          level: execution.success ? 'log' : 'warn',
          summary: {
            ...decision.summary,
            trigger: decision.trigger,
            success: execution.success,
            matchesUpdated: execution.matchesUpdated ?? 0,
            requestsUsed: execution.requestsUsed ?? 0,
            ...(execution.error ? { error: execution.error } : {}),
          },
        };
      } catch (error) {
        this.logger.error(`Adaptive sync tick error: ${error.message}`);
        throw error;
      } finally {
        this.isSyncing = false;
      }
    });
  }

  /**
   * Generate daily plan at midnight UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'UTC' })
  async generateDailyPlan() {
    await observeSchedulerJob(this.logger, 'generateDailyPlan', async () => {
      try {
        this.logger.log('Generating daily sync plan');
        const plan = await this.syncPlan.calculateDailyPlan();

        this.logger.log(
          `Daily plan created: ${plan.totalMatches} matches, ${plan.intervalMinutes}min interval, ${plan.strategy} strategy`,
        );

        return {
          status: 'completed',
          level: 'log',
          summary: {
            totalMatches: plan.totalMatches,
            intervalMinutes: plan.intervalMinutes,
            strategy: plan.strategy,
          },
        };
      } catch (error) {
        this.logger.error(`Failed to generate daily plan: ${error.message}`);
        throw error;
      }
    });
  }

  /**
   * Sync yesterday's results at 2 AM (catch any missed updates)
   */
  @Cron('0 2 * * *') // 2 AM daily
  async syncYesterdayResults() {
    await observeSchedulerJob(this.logger, 'syncYesterdayResults', async () => {
      if (!(await this.footballConfigService.isAutoSyncEnabled())) {
        this.logger.debug('Auto sync disabled, skipping yesterday sync');
        return {
          status: 'skipped',
          summary: { reason: 'auto_sync_disabled' },
        };
      }

      try {
        this.logger.log('Running yesterday results sync');

        // This is a safety net to ensure all matches from yesterday are finalized
        // It uses today's sync which will catch any stragglers
        const execution = await this.executeSyncWithLock('yesterday_results');

        return {
          status: 'completed',
          level: execution.success ? 'log' : 'warn',
          summary: {
            trigger: 'yesterday_results',
            success: execution.success,
            matchesUpdated: execution.matchesUpdated ?? 0,
            requestsUsed: execution.requestsUsed ?? 0,
            ...(execution.error ? { error: execution.error } : {}),
          },
        };
      } catch (error) {
        this.logger.error(`Yesterday sync failed: ${error.message}`);
        throw error;
      }
    });
  }

  /**
   * Execute sync with locking mechanism
   */
  private async executeSyncWithLock(trigger: 'adaptive' | 'yesterday_results' | 'peak_hours') {
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
        return {
          success: true,
          matchesUpdated: result.matchesUpdated,
          requestsUsed: plan?.estimatedRequestsUsed ?? 0,
          durationMs: Date.now() - startedAt,
          trigger,
        };
      } else {
        this.logger.warn(`Sync completed with issues: ${result.error}`);
        this.syncEvents.emit({
          type: 'sync_failed',
          data: { error: result.error ?? 'Unknown error' },
          timestamp: new Date().toISOString(),
        });
        return {
          success: false,
          matchesUpdated: result.matchesUpdated,
          error: result.error ?? 'Unknown error',
          durationMs: Date.now() - startedAt,
          trigger,
        };
      }
    } catch (error) {
      this.logger.error(`Sync execution failed: ${error.message}`);
      this.syncEvents.emit({
        type: 'sync_failed',
        data: { error: error.message },
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        error: error.message,
        durationMs: Date.now() - startedAt,
        trigger,
      };
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

  private async resolveFrequentSyncDecision(): Promise<
    | {
        shouldSync: true;
        trigger: 'adaptive' | 'peak_hours';
        logMessage: string;
        summary: Record<string, string | number | boolean>;
      }
    | {
        shouldSync: false;
        summary: Record<string, string | number | boolean>;
      }
  > {
    const shouldRunAdaptiveSync = await this.syncPlan.shouldSyncNow();
    if (shouldRunAdaptiveSync) {
      return {
        shouldSync: true,
        trigger: 'adaptive',
        logMessage: 'Adaptive sync triggered',
        summary: { reason: 'plan_due' },
      };
    }

    return this.evaluatePeakHoursOverride();
  }

  private async evaluatePeakHoursOverride(): Promise<
    | {
        shouldSync: true;
        trigger: 'peak_hours';
        logMessage: string;
        summary: Record<string, string | number | boolean>;
      }
    | {
        shouldSync: false;
        summary: Record<string, string | number | boolean>;
      }
  > {
    const now = new Date();

    if (!this.isPeakHoursWindow(now) || !this.isPeakHoursBoundary(now)) {
      return {
        shouldSync: false,
        summary: { reason: 'plan_not_due' },
      };
    }

    if (!(await this.footballConfigService.isPeakHoursSyncEnabled())) {
      return {
        shouldSync: false,
        summary: { reason: 'peak_hours_sync_disabled' },
      };
    }

    const plan = await this.syncPlan.calculateDailyPlan();
    const potentiallyLive = plan.hasLiveMatches
      ? 0
      : await this.syncPlan.countPotentiallyLiveMatches();

    if (plan.requestBudget <= 0) {
      return {
        shouldSync: false,
        summary: { reason: 'request_budget_exhausted', trigger: 'peak_hours' },
      };
    }

    if (!plan.hasLiveMatches && potentiallyLive <= 0) {
      return {
        shouldSync: false,
        summary: { reason: 'no_live_matches_detected', trigger: 'peak_hours' },
      };
    }

    return {
      shouldSync: true,
      trigger: 'peak_hours',
      logMessage: plan.hasLiveMatches
        ? 'Peak hours sync triggered (live matches detected)'
        : `Peak hours sync triggered (${potentiallyLive} potentially live matches)`,
      summary: {
        reason: 'peak_hours_override',
        hasLiveMatches: plan.hasLiveMatches,
        potentiallyLive,
      },
    };
  }

  private isPeakHoursWindow(now: Date): boolean {
    const hour = now.getHours();
    return hour >= 9 && hour <= 23;
  }

  private isPeakHoursBoundary(now: Date): boolean {
    return now.getMinutes() % 5 === 0;
  }
}
