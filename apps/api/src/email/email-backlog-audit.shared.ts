import { EmailJob, EmailJobStatus, Prisma } from '@prisma/client';
import type {
  EmailBacklogAuditMode,
  EmailBacklogAuditStatus,
  EmailBacklogAuditTrigger,
} from '@prisma/client';

const REQUIRED_MAX_ATTEMPTS = 6;
const OPTIONAL_MAX_ATTEMPTS = 3;
const STALE_SENDING_MS = 20 * 60_000;
const RETRY_LATER_MS = 15 * 60_000;
const SAMPLE_LIMIT = 25;
const TRANSIENT_ERROR_MATCHERS = [
  'Greeting never received',
  'Connection timeout',
  'ETIMEDOUT',
  'ECONNRESET',
];
const EMAIL_BACKLOG_AUDIT_MODE = {
  AUDIT: 'AUDIT' as EmailBacklogAuditMode,
  SANITIZE: 'SANITIZE' as EmailBacklogAuditMode,
};
const EMAIL_BACKLOG_AUDIT_STATUS = {
  RUNNING: 'RUNNING' as EmailBacklogAuditStatus,
  COMPLETED: 'COMPLETED' as EmailBacklogAuditStatus,
  FAILED: 'FAILED' as EmailBacklogAuditStatus,
  SKIPPED: 'SKIPPED' as EmailBacklogAuditStatus,
};
const EMAIL_BACKLOG_AUDIT_TRIGGER = {
  SCHEDULER: 'SCHEDULER' as EmailBacklogAuditTrigger,
  MANUAL: 'MANUAL' as EmailBacklogAuditTrigger,
  CLI: 'CLI' as EmailBacklogAuditTrigger,
};

export type EmailBacklogAuditActionReason =
  | 'stale-sending'
  | 'exhausted-transient-retry';

export type EmailBacklogAuditTriggerValue =
  | EmailBacklogAuditTrigger
  | `${EmailBacklogAuditTrigger}`;

export type EmailBacklogAuditRunInput = {
  apply: boolean;
  trigger: EmailBacklogAuditTriggerValue;
};

export type EmailBacklogAuditRecord = {
  jobId: string;
  recipientEmail: string;
  required: boolean;
  attemptCount: number;
  status: EmailJobStatus;
  providerKey: string | null;
  reason: EmailBacklogAuditActionReason | 'within-budget-transient-retry';
  lastError: string | null;
  lastAttemptAt: string | null;
  nextStatus?: EmailJobStatus;
  applied?: boolean;
};

export type EmailBacklogAuditErrorRecord = {
  jobId: string;
  reason: string;
  error: string;
};

export type EmailBacklogAuditSummary = {
  backlogStatusCounts: Record<string, number>;
  staleSendingSample: EmailBacklogAuditRecord[];
  exhaustedRetrySample: EmailBacklogAuditRecord[];
  withinBudgetTransientSample: EmailBacklogAuditRecord[];
  actionedSample: EmailBacklogAuditRecord[];
  notActionedSample: EmailBacklogAuditRecord[];
  errorSample: EmailBacklogAuditErrorRecord[];
};

export type EmailBacklogAuditRunResult = {
  runId: string;
  trigger: EmailBacklogAuditTrigger;
  mode: EmailBacklogAuditMode;
  status: EmailBacklogAuditStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  inspectedCount: number;
  actionableCount: number;
  staleSendingCount: number;
  exhaustedRetryCount: number;
  transientWithinBudgetCount: number;
  sanitizedCount: number;
  deferredCount: number;
  failedCount: number;
  droppedCount: number;
  notActionedCount: number;
  errorCount: number;
  summary: EmailBacklogAuditSummary;
  errorMessage: string | null;
};

type EmailBacklogAuditActionPlan = {
  job: EmailJob;
  reason: EmailBacklogAuditActionReason;
  nextStatus: EmailJobStatus;
  auditSuffix: string;
};

type EmailBacklogSnapshot = {
  pendingCount: number;
  deferredCount: number;
  sendingCount: number;
  failedCount: number;
  droppedCount: number;
};

type AuditPrismaClient = {
  emailJob: {
    count(args: Prisma.EmailJobCountArgs): Promise<number>;
    findMany(args: Prisma.EmailJobFindManyArgs): Promise<EmailJob[]>;
    update(args: Prisma.EmailJobUpdateArgs): Promise<EmailJob>;
  };
  emailBacklogAuditRun: {
    create(args: Prisma.EmailBacklogAuditRunCreateArgs): Promise<{ id: string; startedAt: Date }>;
    update(args: Prisma.EmailBacklogAuditRunUpdateArgs): Promise<unknown>;
  };
};

export async function runEmailBacklogAudit(
  prisma: AuditPrismaClient,
  options: EmailBacklogAuditRunInput,
): Promise<EmailBacklogAuditRunResult> {
  const startedAt = new Date();
  const mode = options.apply ? EMAIL_BACKLOG_AUDIT_MODE.SANITIZE : EMAIL_BACKLOG_AUDIT_MODE.AUDIT;
  const trigger = normalizeTrigger(options.trigger);
  const run = await prisma.emailBacklogAuditRun.create({
    data: {
      trigger,
      mode,
      status: EMAIL_BACKLOG_AUDIT_STATUS.RUNNING,
      startedAt,
    },
    select: {
      id: true,
      startedAt: true,
    },
  });

  try {
    const snapshot = await getEmailBacklogSnapshot(prisma);
    const now = new Date();
    const staleSendingBefore = new Date(now.getTime() - STALE_SENDING_MS);

    const [staleSending, transientRetryCandidates] = await Promise.all([
      prisma.emailJob.findMany({
        where: {
          status: EmailJobStatus.SENDING,
          lastAttemptAt: { lt: staleSendingBefore },
        },
        orderBy: { lastAttemptAt: 'asc' },
      }),
      prisma.emailJob.findMany({
        where: {
          status: { in: [EmailJobStatus.PENDING, EmailJobStatus.DEFERRED] },
          OR: TRANSIENT_ERROR_MATCHERS.map((token) => ({
            lastError: { contains: token },
          })),
        },
        orderBy: [{ attemptCount: 'desc' }, { updatedAt: 'asc' }],
      }),
    ]);

    const exhaustedRetry = transientRetryCandidates.filter((job) => {
      return job.attemptCount >= getMaxAttempts(job.required);
    });
    const withinBudgetTransient = transientRetryCandidates.filter((job) => {
      return job.attemptCount < getMaxAttempts(job.required);
    });

    const actionPlans: EmailBacklogAuditActionPlan[] = [
      ...staleSending.map((job) => buildStaleSendingPlan(job, now)),
      ...exhaustedRetry.map((job) => buildExhaustedRetryPlan(job)),
    ];

    const actionedRecords: EmailBacklogAuditRecord[] = [];
    const errorRecords: EmailBacklogAuditErrorRecord[] = [];

    if (options.apply) {
      for (const plan of actionPlans) {
        try {
          await prisma.emailJob.update({
            where: { id: plan.job.id },
            data: {
              status: plan.nextStatus,
              availableAt:
                plan.nextStatus === EmailJobStatus.DEFERRED
                  ? new Date(now.getTime() + RETRY_LATER_MS)
                  : now,
              lastError: appendAuditSuffix(plan.job.lastError, plan.auditSuffix),
            },
          });

          actionedRecords.push({
            ...toAuditRecord(plan.job, plan.reason),
            nextStatus: plan.nextStatus,
            applied: true,
          });
        } catch (error) {
          errorRecords.push({
            jobId: plan.job.id,
            reason: plan.reason,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const inspectedCount =
      snapshot.pendingCount +
      snapshot.deferredCount +
      snapshot.sendingCount;
    const actionableCount = actionPlans.length;
    const sanitizedCount = actionedRecords.length;
    const deferredCount = actionedRecords.filter((item) => item.nextStatus === EmailJobStatus.DEFERRED).length;
    const failedCount = actionedRecords.filter((item) => item.nextStatus === EmailJobStatus.FAILED).length;
    const droppedCount = actionedRecords.filter((item) => item.nextStatus === EmailJobStatus.DROPPED).length;
    const notActionedCount = Math.max(0, inspectedCount - actionableCount);
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - run.startedAt.getTime();
    const summary: EmailBacklogAuditSummary = {
      backlogStatusCounts: {
        pending: snapshot.pendingCount,
        deferred: snapshot.deferredCount,
        sending: snapshot.sendingCount,
        failed: snapshot.failedCount,
        dropped: snapshot.droppedCount,
      },
      staleSendingSample: staleSending.slice(0, SAMPLE_LIMIT).map((job) => toAuditRecord(job, 'stale-sending')),
      exhaustedRetrySample: exhaustedRetry.slice(0, SAMPLE_LIMIT).map((job) => toAuditRecord(job, 'exhausted-transient-retry')),
      withinBudgetTransientSample: withinBudgetTransient
        .slice(0, SAMPLE_LIMIT)
        .map((job) => toAuditRecord(job, 'within-budget-transient-retry')),
      actionedSample: actionedRecords.slice(0, SAMPLE_LIMIT),
      notActionedSample: withinBudgetTransient
        .slice(0, SAMPLE_LIMIT)
        .map((job) => toAuditRecord(job, 'within-budget-transient-retry')),
      errorSample: errorRecords.slice(0, SAMPLE_LIMIT),
    };

    const result: EmailBacklogAuditRunResult = {
      runId: run.id,
      trigger,
      mode,
      status: EMAIL_BACKLOG_AUDIT_STATUS.COMPLETED,
      startedAt: run.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      inspectedCount,
      actionableCount,
      staleSendingCount: staleSending.length,
      exhaustedRetryCount: exhaustedRetry.length,
      transientWithinBudgetCount: withinBudgetTransient.length,
      sanitizedCount,
      deferredCount,
      failedCount,
      droppedCount,
      notActionedCount,
      errorCount: errorRecords.length,
      summary,
      errorMessage: null,
    };

    await prisma.emailBacklogAuditRun.update({
      where: { id: run.id },
      data: toAuditRunUpdate(result),
    });

    return result;
  } catch (error) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - run.startedAt.getTime();
    const message = error instanceof Error ? error.message : String(error);

    await prisma.emailBacklogAuditRun.update({
      where: { id: run.id },
      data: {
        status: EMAIL_BACKLOG_AUDIT_STATUS.FAILED,
        completedAt,
        durationMs,
        errorMessage: message,
      },
    });

    throw error;
  }
}

export async function recordEmailBacklogAuditSkip(
  prisma: AuditPrismaClient,
  input: {
    trigger: EmailBacklogAuditTriggerValue;
    mode?: EmailBacklogAuditMode;
    reason: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const startedAt = new Date();
  await prisma.emailBacklogAuditRun.create({
    data: {
      trigger: normalizeTrigger(input.trigger),
      mode: input.mode ?? EMAIL_BACKLOG_AUDIT_MODE.SANITIZE,
      status: EMAIL_BACKLOG_AUDIT_STATUS.SKIPPED,
      startedAt,
      completedAt: startedAt,
      durationMs: 0,
      notActionedCount: 0,
      summary: ({
        reason: input.reason,
        ...(input.details ? { details: input.details } : {}),
      }) as Prisma.InputJsonValue,
    },
    select: { id: true, startedAt: true },
  });
}

export async function getEmailBacklogSnapshot(
  prisma: Pick<AuditPrismaClient, 'emailJob'>,
): Promise<EmailBacklogSnapshot> {
  const [pendingCount, deferredCount, sendingCount, failedCount, droppedCount] =
    await Promise.all([
      prisma.emailJob.count({ where: { status: EmailJobStatus.PENDING } }),
      prisma.emailJob.count({ where: { status: EmailJobStatus.DEFERRED } }),
      prisma.emailJob.count({ where: { status: EmailJobStatus.SENDING } }),
      prisma.emailJob.count({ where: { status: EmailJobStatus.FAILED } }),
      prisma.emailJob.count({ where: { status: EmailJobStatus.DROPPED } }),
    ]);

  return {
    pendingCount,
    deferredCount,
    sendingCount,
    failedCount,
    droppedCount,
  };
}

export function toEmailBacklogObservationSummary(
  result: Pick<
    EmailBacklogAuditRunResult,
    | 'runId'
    | 'mode'
    | 'status'
    | 'inspectedCount'
    | 'actionableCount'
    | 'sanitizedCount'
    | 'deferredCount'
    | 'failedCount'
    | 'droppedCount'
    | 'notActionedCount'
    | 'errorCount'
  >,
): Record<string, string | number> {
  return {
    runId: result.runId,
    mode: result.mode,
    status: result.status,
    inspectedCount: result.inspectedCount,
    actionableCount: result.actionableCount,
    sanitizedCount: result.sanitizedCount,
    deferredCount: result.deferredCount,
    failedCount: result.failedCount,
    droppedCount: result.droppedCount,
    notActionedCount: result.notActionedCount,
    errorCount: result.errorCount,
  };
}

function buildStaleSendingPlan(job: EmailJob, now: Date): EmailBacklogAuditActionPlan {
  const maxAttempts = getMaxAttempts(job.required);
  const nextStatus = job.attemptCount >= maxAttempts
    ? getTerminalStatus(job.required)
    : EmailJobStatus.DEFERRED;

  return {
    job,
    reason: 'stale-sending',
    nextStatus,
    auditSuffix:
      nextStatus === EmailJobStatus.DEFERRED
        ? `Recovered stale SENDING job during backlog sanitization at ${now.toISOString()}.`
        : `Stale SENDING job exceeded retry budget and was closed during backlog sanitization at ${now.toISOString()}.`,
  };
}

function buildExhaustedRetryPlan(job: EmailJob): EmailBacklogAuditActionPlan {
  return {
    job,
    reason: 'exhausted-transient-retry',
    nextStatus: getTerminalStatus(job.required),
    auditSuffix: 'Retry storm threshold reached; backlog sanitizer stopped further retries.',
  };
}

function toAuditRunUpdate(result: EmailBacklogAuditRunResult): Prisma.EmailBacklogAuditRunUpdateInput {
  return {
    status: result.status,
    completedAt: new Date(result.completedAt),
    durationMs: result.durationMs,
    inspectedCount: result.inspectedCount,
    actionableCount: result.actionableCount,
    staleSendingCount: result.staleSendingCount,
    exhaustedRetryCount: result.exhaustedRetryCount,
    transientWithinBudgetCount: result.transientWithinBudgetCount,
    sanitizedCount: result.sanitizedCount,
    deferredCount: result.deferredCount,
    failedCount: result.failedCount,
    droppedCount: result.droppedCount,
    notActionedCount: result.notActionedCount,
    errorCount: result.errorCount,
    summary: result.summary as Prisma.InputJsonValue,
    errorMessage: result.errorMessage,
  };
}

function normalizeTrigger(trigger: EmailBacklogAuditTriggerValue): EmailBacklogAuditTrigger {
  switch (trigger) {
    case 'MANUAL':
      return EMAIL_BACKLOG_AUDIT_TRIGGER.MANUAL;
    case EMAIL_BACKLOG_AUDIT_TRIGGER.CLI:
    case 'CLI':
      return EMAIL_BACKLOG_AUDIT_TRIGGER.CLI;
    case EMAIL_BACKLOG_AUDIT_TRIGGER.SCHEDULER:
    case 'SCHEDULER':
    default:
      return EMAIL_BACKLOG_AUDIT_TRIGGER.SCHEDULER;
  }
}

function getMaxAttempts(required: boolean): number {
  return required ? REQUIRED_MAX_ATTEMPTS : OPTIONAL_MAX_ATTEMPTS;
}

function getTerminalStatus(required: boolean): EmailJobStatus {
  return required ? EmailJobStatus.FAILED : EmailJobStatus.DROPPED;
}

function toAuditRecord(
  job: EmailJob,
  reason: EmailBacklogAuditRecord['reason'],
): EmailBacklogAuditRecord {
  return {
    jobId: job.id,
    recipientEmail: job.recipientEmail,
    required: job.required,
    attemptCount: job.attemptCount,
    status: job.status,
    providerKey: job.providerKey,
    reason,
    lastError: job.lastError,
    lastAttemptAt: job.lastAttemptAt?.toISOString() ?? null,
  };
}

function appendAuditSuffix(message: string | null, suffix: string): string {
  const base = message?.trim();
  if (!base) {
    return suffix;
  }

  if (base.includes(suffix)) {
    return base;
  }

  return `${base} | ${suffix}`;
}
