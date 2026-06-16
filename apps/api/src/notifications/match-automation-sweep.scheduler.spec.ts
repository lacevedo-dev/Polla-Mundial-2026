import { Test, TestingModule } from '@nestjs/testing';
import { resetExclusiveBackgroundJobStateForTests } from '../prisma/background-job-lock.util';
import { SyncPlanService } from '../football-sync/services/sync-plan.service';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionReportScheduler } from '../prediction-report/prediction-report.scheduler';
import { AutomationFeatureFlagsService } from '../automation/config/automation-feature-flags.service';
import { PreMatchOrchestratorService } from '../automation/pre-match/pre-match-orchestrator.service';
import { PostMatchOrchestratorService } from '../automation/post-match/post-match-orchestrator.service';
import { MatchAutomationSweepScheduler } from './match-automation-sweep.scheduler';
import { NotificationScheduler } from './notification.scheduler';

describe('MatchAutomationSweepScheduler', () => {
  let scheduler: MatchAutomationSweepScheduler;
  let logSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const notificationScheduler = {
    sendMatchReminders: jest.fn(),
    sendPredictionClosingAlerts: jest.fn(),
    sendMatchResultNotifications: jest.fn(),
  };

  const predictionReportScheduler = {
    checkAndSendReports: jest.fn(),
    sendPendingResultReports: jest.fn(),
  };
  const syncPlan = {
    closeStaleUnlinkedMatches: jest.fn(),
  };
  const featureFlags = {
    isPreMatchV2Enabled: jest.fn().mockResolvedValue(false),
  };
  const preMatchOrchestrator = {
    run: jest.fn().mockResolvedValue({ status: 'completed', summary: {} }),
  };
  const postMatchOrchestrator = {
    runResultNotifications: jest.fn().mockResolvedValue({ status: 'completed', summary: {} }),
  };
  const prisma = {
    league: { findMany: jest.fn() },
    match: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchAutomationSweepScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationScheduler, useValue: notificationScheduler },
        { provide: PredictionReportScheduler, useValue: predictionReportScheduler },
        { provide: SyncPlanService, useValue: syncPlan },
        { provide: AutomationFeatureFlagsService, useValue: featureFlags },
        { provide: PreMatchOrchestratorService, useValue: preMatchOrchestrator },
        { provide: PostMatchOrchestratorService, useValue: postMatchOrchestrator },
      ],
    }).compile();

    scheduler = module.get<MatchAutomationSweepScheduler>(MatchAutomationSweepScheduler);
    logSpy = jest
      .spyOn((scheduler as any).logger, 'log')
      .mockImplementation(() => undefined);
    debugSpy = jest
      .spyOn((scheduler as any).logger, 'debug')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn((scheduler as any).logger, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    resetExclusiveBackgroundJobStateForTests();
  });

  beforeEach(() => {
    prisma.league.findMany.mockResolvedValue([]);
    prisma.match.findMany.mockResolvedValue([]);
    featureFlags.isPreMatchV2Enabled.mockResolvedValue(false);
  });

  it('runs notification and report tasks sequentially from a single cron entrypoint', async () => {
    const order: string[] = [];
    notificationScheduler.sendMatchReminders.mockImplementation(async () => {
      order.push('sendMatchReminders');
    });
    notificationScheduler.sendPredictionClosingAlerts.mockImplementation(async () => {
      order.push('sendPredictionClosingAlerts');
    });
    postMatchOrchestrator.runResultNotifications.mockImplementation(async () => {
      order.push('sendMatchResultNotifications');
      return { status: 'completed', summary: {} };
    });
    predictionReportScheduler.checkAndSendReports.mockImplementation(async () => {
      order.push('checkAndSendReports');
    });
    predictionReportScheduler.sendPendingResultReports.mockImplementation(async () => {
      order.push('sendPendingResultReports');
    });
    syncPlan.closeStaleUnlinkedMatches.mockImplementation(async () => {
      order.push('closeStaleUnlinkedMatches');
    });

    await scheduler.runMatchAutomationSweep();

    expect(order).toEqual([
      'sendMatchReminders',
      'sendPredictionClosingAlerts',
      'sendMatchResultNotifications',
      'checkAndSendReports',
      'sendPendingResultReports',
      'closeStaleUnlinkedMatches',
    ]);
  });

  it('uses pre-match v2 orchestrator when feature flag is enabled', async () => {
    featureFlags.isPreMatchV2Enabled.mockResolvedValue(true);
    const order: string[] = [];
    preMatchOrchestrator.run.mockImplementation(async () => {
      order.push('runPreMatchV2');
      return { status: 'completed', summary: {} };
    });
    postMatchOrchestrator.runResultNotifications.mockImplementation(async () => {
      order.push('sendMatchResultNotifications');
      return { status: 'completed', summary: {} };
    });
    predictionReportScheduler.checkAndSendReports.mockImplementation(async () => {
      order.push('checkAndSendReports');
    });
    predictionReportScheduler.sendPendingResultReports.mockImplementation(async () => {
      order.push('sendPendingResultReports');
    });
    syncPlan.closeStaleUnlinkedMatches.mockImplementation(async () => {
      order.push('closeStaleUnlinkedMatches');
    });

    await scheduler.runMatchAutomationSweep();

    expect(order).toEqual([
      'runPreMatchV2',
      'sendMatchResultNotifications',
      'checkAndSendReports',
      'sendPendingResultReports',
      'closeStaleUnlinkedMatches',
    ]);
    expect(notificationScheduler.sendMatchReminders).not.toHaveBeenCalled();
    expect(notificationScheduler.sendPredictionClosingAlerts).not.toHaveBeenCalled();
  });

  it('continues with later tasks if one task throws', async () => {
    notificationScheduler.sendPredictionClosingAlerts.mockRejectedValue(new Error('boom'));

    await scheduler.runMatchAutomationSweep();

    expect(notificationScheduler.sendMatchReminders).toHaveBeenCalledTimes(1);
    expect(notificationScheduler.sendPredictionClosingAlerts).toHaveBeenCalledTimes(1);
    expect(postMatchOrchestrator.runResultNotifications).toHaveBeenCalledTimes(1);
    expect(predictionReportScheduler.checkAndSendReports).toHaveBeenCalledTimes(1);
    expect(predictionReportScheduler.sendPendingResultReports).toHaveBeenCalledTimes(1);
    expect(syncPlan.closeStaleUnlinkedMatches).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(payload.summary).toEqual(
      expect.objectContaining({
        attemptedTasks: 6,
        completedTasks: 5,
        skippedTasks: 0,
        failedTasks: 1,
      }),
    );
    expect(payload.summary.taskResults).toContain(
      'sendPredictionClosingAlerts:failed@',
    );
    expect(payload.summary.taskResults).toContain('(boom)');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('skips overlapping sweep ticks while a previous sweep is still running', async () => {
    let resolveFirstTask: (() => void) | null = null;
    notificationScheduler.sendMatchReminders.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstTask = resolve;
        }),
    );

    const firstRun = scheduler.runMatchAutomationSweep();
    await Promise.resolve();

    await scheduler.runMatchAutomationSweep();

    expect(notificationScheduler.sendMatchReminders).toHaveBeenCalledTimes(1);
    expect(notificationScheduler.sendPredictionClosingAlerts).not.toHaveBeenCalled();
    expect(postMatchOrchestrator.runResultNotifications).not.toHaveBeenCalled();
    expect(predictionReportScheduler.checkAndSendReports).not.toHaveBeenCalled();
    expect(predictionReportScheduler.sendPendingResultReports).not.toHaveBeenCalled();

    resolveFirstTask?.();
    await firstRun;

    expect(notificationScheduler.sendPredictionClosingAlerts).toHaveBeenCalledTimes(1);
    expect(postMatchOrchestrator.runResultNotifications).toHaveBeenCalledTimes(1);
    expect(predictionReportScheduler.checkAndSendReports).toHaveBeenCalledTimes(1);
    expect(predictionReportScheduler.sendPendingResultReports).toHaveBeenCalledTimes(1);
    expect(syncPlan.closeStaleUnlinkedMatches).toHaveBeenCalledTimes(1);
    const schedulerJobDebugCall = debugSpy.mock.calls.find((call) =>
      typeof call[0] === 'string' && (call[0] as string).includes('"event":"scheduler_job"'),
    );
    expect(schedulerJobDebugCall).toBeDefined();
    const skipPayload = JSON.parse(schedulerJobDebugCall?.[0] as string);
    expect(skipPayload.summary).toEqual(
      expect.objectContaining({
        reason: 'sweep_lock',
      }),
    );
  });
});
