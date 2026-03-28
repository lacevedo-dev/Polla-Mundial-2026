import {
  logExclusiveBackgroundJobSkip,
  resetExclusiveBackgroundJobStateForTests,
  tryRunExclusiveBackgroundJob,
} from './background-job-lock.util';

describe('background-job-lock.util', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-28T04:00:00.000Z'));
    resetExclusiveBackgroundJobStateForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetExclusiveBackgroundJobStateForTests();
  });

  it('returns a debug skip with holder context while the lock is active', async () => {
    let releaseJob!: () => void;

    const runningJob = tryRunExclusiveBackgroundJob(
      'background-db-job',
      'syncTodayMatches',
      () =>
        new Promise<void>((resolve) => {
          releaseJob = resolve;
        }),
    );

    const skipped = await tryRunExclusiveBackgroundJob(
      'background-db-job',
      'sendMatchReminders',
      async () => undefined,
    );

    expect(skipped.ran).toBe(false);
    if (skipped.ran) {
      throw new Error('Expected the second execution to skip');
    }

    expect(skipped.skip).toEqual(
      expect.objectContaining({
        key: 'background-db-job',
        holder: 'syncTodayMatches',
        requestedBy: 'sendMatchReminders',
        heldMs: 0,
        skipCount: 1,
        logLevel: 'debug',
      }),
    );

    const logger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };

    logExclusiveBackgroundJobSkip(logger, 'sendMatchReminders', skipped);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('sendMatchReminders skipped because "syncTodayMatches" is holding lock "background-db-job"'),
    );
    expect(logger.warn).not.toHaveBeenCalled();

    releaseJob();
    await runningJob;
  });

  it('escalates to warn only after the lock has been held for five minutes and throttles repeated warns', async () => {
    let releaseJob!: () => void;

    const runningJob = tryRunExclusiveBackgroundJob(
      'background-db-job',
      'syncTodayMatches',
      () =>
        new Promise<void>((resolve) => {
          releaseJob = resolve;
        }),
    );

    jest.advanceTimersByTime(5 * 60 * 1000);

    const firstWarn = await tryRunExclusiveBackgroundJob(
      'background-db-job',
      'sendPredictionClosingAlerts',
      async () => undefined,
    );

    expect(firstWarn.ran).toBe(false);
    if (firstWarn.ran) {
      throw new Error('Expected the lock to still be active');
    }
    expect(firstWarn.skip.logLevel).toBe('warn');
    expect(firstWarn.skip.skipCount).toBe(1);

    const throttledSkip = await tryRunExclusiveBackgroundJob(
      'background-db-job',
      'sendMatchResultNotifications',
      async () => undefined,
    );

    expect(throttledSkip.ran).toBe(false);
    if (throttledSkip.ran) {
      throw new Error('Expected the lock to still be active');
    }
    expect(throttledSkip.skip.logLevel).toBe('debug');
    expect(throttledSkip.skip.skipCount).toBe(2);

    jest.advanceTimersByTime(5 * 60 * 1000);

    const secondWarn = await tryRunExclusiveBackgroundJob(
      'background-db-job',
      'checkAndSendReports',
      async () => undefined,
    );

    expect(secondWarn.ran).toBe(false);
    if (secondWarn.ran) {
      throw new Error('Expected the lock to still be active');
    }
    expect(secondWarn.skip.logLevel).toBe('warn');
    expect(secondWarn.skip.skipCount).toBe(3);
    expect(secondWarn.skip.heldMs).toBe(10 * 60 * 1000);

    releaseJob();
    await runningJob;
  });
});
