import { observeSchedulerJob } from './scheduler-observability.util';

describe('observeSchedulerJob', () => {
  const createLogger = () => ({
    debug: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('logs completed jobs with duration and summary', async () => {
    const logger = createLogger();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T12:00:00.000Z'));

    const result = await observeSchedulerJob(logger, 'adaptiveSyncTick', async () => {
      jest.setSystemTime(new Date('2026-03-28T12:00:03.500Z'));
      return {
        status: 'completed' as const,
        summary: {
          trigger: 'adaptive',
          matchesUpdated: 4,
        },
      };
    });

    expect(result).toEqual({
      status: 'completed',
      summary: {
        trigger: 'adaptive',
        matchesUpdated: 4,
      },
    });
    expect(logger.log).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'scheduler_job',
        job: 'adaptiveSyncTick',
        status: 'completed',
        startedAt: '2026-03-28T12:00:00.000Z',
        durationMs: 3500,
        summary: {
          trigger: 'adaptive',
          matchesUpdated: 4,
        },
      }),
    );
  });

  it('logs skipped jobs at debug level', async () => {
    const logger = createLogger();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T12:05:00.000Z'));

    await observeSchedulerJob(logger, 'checkAndSendReports', async () => {
      jest.setSystemTime(new Date('2026-03-28T12:05:01.000Z'));
      return {
        status: 'skipped' as const,
        summary: {
          reason: 'background_lock',
        },
      };
    });

    expect(logger.debug).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'scheduler_job',
        job: 'checkAndSendReports',
        status: 'skipped',
        startedAt: '2026-03-28T12:05:00.000Z',
        durationMs: 1000,
        summary: {
          reason: 'background_lock',
        },
      }),
    );
  });

  it('logs failed jobs and rethrows the original error', async () => {
    const logger = createLogger();
    const failure = new Error('boom');

    await expect(
      observeSchedulerJob(logger, 'generateDailyPlan', async () => {
        throw failure;
      }),
    ).rejects.toThrow('boom');

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[0]).toContain('"job":"generateDailyPlan"');
    expect(logger.error.mock.calls[0]?.[0]).toContain('"status":"failed"');
  });
});
