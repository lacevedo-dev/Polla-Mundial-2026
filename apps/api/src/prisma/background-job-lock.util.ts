type BackgroundJobLogger = Pick<Console, 'debug' | 'warn'>;

type ActiveBackgroundJob = {
  holder: string;
  startedAt: number;
  skipCount: number;
  lastWarnAt: number | null;
};

type BackgroundJobSkipLogLevel = 'debug' | 'warn';

type BackgroundJobSkipDetails = {
  key: string;
  holder: string;
  requestedBy: string;
  startedAt: Date;
  heldMs: number;
  skipCount: number;
  logLevel: BackgroundJobSkipLogLevel;
};

type BackgroundJobExecutionSuccess<T> = {
  ran: true;
  result: T;
};

type BackgroundJobExecutionSkipped = {
  ran: false;
  skip: BackgroundJobSkipDetails;
};

export type ExclusiveBackgroundJobExecution<T> =
  | BackgroundJobExecutionSuccess<T>
  | BackgroundJobExecutionSkipped;

const activeJobs = new Map<string, ActiveBackgroundJob>();
const LOCK_WARN_THRESHOLD_MS = 5 * 60 * 1000;
const LOCK_WARN_REPEAT_MS = 5 * 60 * 1000;

export async function tryRunExclusiveBackgroundJob<T>(
  key: string,
  holder: string,
  job: () => Promise<T>,
): Promise<ExclusiveBackgroundJobExecution<T>> {
  const activeJob = activeJobs.get(key);
  if (activeJob) {
    activeJob.skipCount += 1;

    const now = Date.now();
    const heldMs = now - activeJob.startedAt;
    const shouldWarn =
      heldMs >= LOCK_WARN_THRESHOLD_MS &&
      (activeJob.lastWarnAt === null ||
        now - activeJob.lastWarnAt >= LOCK_WARN_REPEAT_MS);

    if (shouldWarn) {
      activeJob.lastWarnAt = now;
    }

    return {
      ran: false,
      skip: {
        key,
        holder: activeJob.holder,
        requestedBy: holder,
        startedAt: new Date(activeJob.startedAt),
        heldMs,
        skipCount: activeJob.skipCount,
        logLevel: shouldWarn ? 'warn' : 'debug',
      },
    };
  }

  activeJobs.set(key, {
    holder,
    startedAt: Date.now(),
    skipCount: 0,
    lastWarnAt: null,
  });

  try {
    return {
      ran: true,
      result: await job(),
    };
  } finally {
    activeJobs.delete(key);
  }
}

export function logExclusiveBackgroundJobSkip(
  logger: BackgroundJobLogger,
  jobName: string,
  execution: BackgroundJobExecutionSkipped,
): void {
  const message = [
    `${jobName} skipped because "${execution.skip.holder}" is holding lock "${execution.skip.key}"`,
    `for ${formatDuration(execution.skip.heldMs)}`,
    `(skip #${execution.skip.skipCount}, requested by ${execution.skip.requestedBy}, started ${execution.skip.startedAt.toISOString()})`,
  ].join(' ');

  if (execution.skip.logLevel === 'warn') {
    logger.warn(message);
    return;
  }

  logger.debug(message);
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function resetExclusiveBackgroundJobStateForTests(): void {
  activeJobs.clear();
}
