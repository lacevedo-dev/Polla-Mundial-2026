type SchedulerObservationLogger = Pick<
  Console,
  'debug' | 'log' | 'warn' | 'error'
>;

type SchedulerObservationValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type SchedulerObservationSummary = Record<
  string,
  SchedulerObservationValue
>;

export type SchedulerObservationOutcome = {
  status?: 'completed' | 'skipped';
  level?: 'debug' | 'log' | 'warn';
  summary?: SchedulerObservationSummary;
};

export async function observeSchedulerJob<T extends SchedulerObservationOutcome>(
  logger: SchedulerObservationLogger,
  jobName: string,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = new Date();
  const startedAtMs = Date.now();

  try {
    const outcome = await run();
    const payload = {
      event: 'scheduler_job',
      job: jobName,
      status: outcome.status ?? 'completed',
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAtMs,
      ...(outcome.summary ? { summary: outcome.summary } : {}),
    };

    const level = outcome.level ?? (payload.status === 'skipped' ? 'debug' : 'log');
    logger[level](JSON.stringify(payload));

    return outcome;
  } catch (error: any) {
    const payload = {
      event: 'scheduler_job',
      job: jobName,
      status: 'failed',
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAtMs,
      error: error?.message ?? 'Unknown scheduler error',
    };

    logger.error(JSON.stringify(payload), error?.stack);
    throw error;
  }
}
