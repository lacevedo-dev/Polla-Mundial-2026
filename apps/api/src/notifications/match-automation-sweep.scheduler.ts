import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  SchedulerObservationOutcome,
  SchedulerObservationSummary,
  observeSchedulerJob,
} from '../common/scheduler-observability.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  logExclusiveBackgroundJobSkip,
  tryRunExclusiveBackgroundJob,
} from '../prisma/background-job-lock.util';
import { PredictionReportScheduler } from '../prediction-report/prediction-report.scheduler';
import { SyncPlanService } from '../football-sync/services/sync-plan.service';
import { buildMatchAutomationSweepContext } from './match-automation-sweep-context';
import { NotificationScheduler } from './notification.scheduler';

@Injectable()
export class MatchAutomationSweepScheduler {
  private static readonly SWEEP_LOCK_KEY = 'match-automation-sweep-job';
  private readonly logger = new Logger(MatchAutomationSweepScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationScheduler: NotificationScheduler,
    private readonly predictionReportScheduler: PredictionReportScheduler,
    private readonly syncPlan: SyncPlanService,
  ) {}

  @Cron('* * * * *')
  async runMatchAutomationSweep(): Promise<void> {
    await observeSchedulerJob(this.logger, 'runMatchAutomationSweep', async () => {
      const execution = await tryRunExclusiveBackgroundJob(
        MatchAutomationSweepScheduler.SWEEP_LOCK_KEY,
        'runMatchAutomationSweep',
        () => this.runSweepTasks(),
      );

      if (!execution.ran) {
        logExclusiveBackgroundJobSkip(
          this.logger,
          'runMatchAutomationSweep',
          execution,
        );

        return {
          status: 'skipped' as const,
          summary: {
            reason: 'sweep_lock',
            lockHolder: execution.skip.holder,
            heldMs: execution.skip.heldMs,
            skipCount: execution.skip.skipCount,
          },
        };
      }

      return {
        status: 'completed' as const,
        level: 'log' as const,
        summary: execution.result,
      };
    });
  }

  private async runSweepTasks(): Promise<SchedulerObservationSummary> {
    const context = await buildMatchAutomationSweepContext(this.prisma);
    const taskNames = [
      'closeStaleUnlinkedMatches',
      'sendMatchReminders',
      'sendPredictionClosingAlerts',
      'sendMatchResultNotifications',
      'checkAndSendReports',
      'sendPendingResultReports',
    ];
    const tasks: Array<[string, () => Promise<SchedulerObservationOutcome | void>]> = [
      [
        'closeStaleUnlinkedMatches',
        () => this.syncPlan.closeStaleUnlinkedMatches(),
      ],
      [
        'sendMatchReminders',
        () => this.notificationScheduler.sendMatchReminders(context),
      ],
      [
        'sendPredictionClosingAlerts',
        () => this.notificationScheduler.sendPredictionClosingAlerts(context),
      ],
      [
        'sendMatchResultNotifications',
        () => this.notificationScheduler.sendMatchResultNotifications(),
      ],
      [
        'checkAndSendReports',
        () => this.predictionReportScheduler.checkAndSendReports(context),
      ],
      [
        'sendPendingResultReports',
        () => this.predictionReportScheduler.sendPendingResultReports(),
      ],
    ];

    const taskResults: SweepTaskResult[] = [];

    for (const [name, task] of tasks) {
      taskResults.push(await this.runTask(name, task));
    }

    const completedTasks = taskResults.filter(
      (task) => task.status === 'completed',
    ).length;
    const skippedTasks = taskResults.filter(
      (task) => task.status === 'skipped',
    ).length;
    const failedTasks = taskResults.filter(
      (task) => task.status === 'failed',
    ).length;

    return {
      tasksScheduled: taskNames.length,
      attemptedTasks: taskResults.length,
      completedTasks,
      skippedTasks,
      failedTasks,
      sequence: taskNames.join(','),
      taskResults: taskResults
        .map(
          (task) =>
            `${task.name}:${task.status}@${task.durationMs}ms${
              task.reason ? `(${task.reason})` : ''
            }`,
        )
        .join('|'),
    };
  }

  private async runTask(
    name: string,
    task: () => Promise<SchedulerObservationOutcome | void>,
  ): Promise<SweepTaskResult> {
    const startedAtMs = Date.now();
    try {
      const outcome = await task();
      const reason =
        typeof outcome?.summary?.reason === 'string' ? outcome.summary.reason : undefined;

      return {
        name,
        status: outcome?.status ?? 'completed',
        durationMs: Date.now() - startedAtMs,
        reason,
      };
    } catch (error: any) {
      this.logger.error(
        `Task "${name}" failed inside runMatchAutomationSweep: ${error?.message ?? 'Unknown error'}`,
        error?.stack,
      );
      return {
        name,
        status: 'failed',
        durationMs: Date.now() - startedAtMs,
        reason: error?.message ?? 'Unknown error',
      };
    }
  }
}

type SweepTaskResult = {
  name: string;
  status: 'completed' | 'skipped' | 'failed';
  durationMs: number;
  reason?: string;
};
