import 'dotenv/config';

import { EmailJobStatus } from '@prisma/client';

import { PrismaService } from '../src/prisma/prisma.service';

const APPLY = process.argv.includes('--apply');
const REQUIRED_MAX_ATTEMPTS = 6;
const OPTIONAL_MAX_ATTEMPTS = 3;
const STALE_SENDING_MS = 20 * 60_000;
const RETRY_LATER_MS = 15 * 60_000;

async function main() {
  const prisma = new PrismaService();
  const now = new Date();
  const staleSendingBefore = new Date(now.getTime() - STALE_SENDING_MS);

  const staleSending = await prisma.emailJob.findMany({
    where: {
      status: EmailJobStatus.SENDING,
      lastAttemptAt: { lt: staleSendingBefore },
    },
    orderBy: { lastAttemptAt: 'asc' },
  });

  const retryStormCandidates = await prisma.emailJob.findMany({
    where: {
      status: { in: [EmailJobStatus.PENDING, EmailJobStatus.DEFERRED] },
      OR: [
        { lastError: { contains: 'Greeting never received' } },
        { lastError: { contains: 'Connection timeout' } },
        { lastError: { contains: 'ETIMEDOUT' } },
        { lastError: { contains: 'ECONNRESET' } },
      ],
    },
    orderBy: [{ attemptCount: 'desc' }, { updatedAt: 'asc' }],
  });

  const actionable = [
    ...staleSending.map((job) => ({ job, reason: 'stale-sending' as const })),
    ...retryStormCandidates
      .filter((job) => {
        const maxAttempts = job.required ? REQUIRED_MAX_ATTEMPTS : OPTIONAL_MAX_ATTEMPTS;
        return job.attemptCount >= maxAttempts;
      })
      .map((job) => ({ job, reason: 'exhausted-transient-retry' as const })),
  ];

  console.log(
    JSON.stringify(
      {
        apply: APPLY,
        staleSendingCount: staleSending.length,
        exhaustedRetryCount: actionable.filter((item) => item.reason === 'exhausted-transient-retry').length,
        actionableCount: actionable.length,
        sample: actionable.slice(0, 20).map(({ job, reason }) => ({
          id: job.id,
          status: job.status,
          required: job.required,
          attemptCount: job.attemptCount,
          providerKey: job.providerKey,
          recipientEmail: job.recipientEmail,
          lastError: job.lastError,
          lastAttemptAt: job.lastAttemptAt,
          reason,
        })),
      },
      null,
      2,
    ),
  );

  if (!APPLY) {
    await prisma.onModuleDestroy();
    return;
  }

  let updated = 0;
  for (const { job, reason } of actionable) {
    if (reason === 'stale-sending') {
      const maxAttempts = job.required ? REQUIRED_MAX_ATTEMPTS : OPTIONAL_MAX_ATTEMPTS;
      const terminalStatus = job.required ? EmailJobStatus.FAILED : EmailJobStatus.DROPPED;
      const nextStatus = job.attemptCount >= maxAttempts ? terminalStatus : EmailJobStatus.DEFERRED;
      const nextAvailableAt = nextStatus === EmailJobStatus.DEFERRED
        ? new Date(now.getTime() + RETRY_LATER_MS)
        : now;

      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: nextStatus,
          availableAt: nextAvailableAt,
          lastError: appendAuditSuffix(job.lastError, 'Recovered stale SENDING job during backlog sanitization.'),
        },
      });
      updated += 1;
      continue;
    }

    const terminalStatus = job.required ? EmailJobStatus.FAILED : EmailJobStatus.DROPPED;
    await prisma.emailJob.update({
      where: { id: job.id },
      data: {
        status: terminalStatus,
        availableAt: now,
        lastError: appendAuditSuffix(job.lastError, 'Retry storm threshold reached; backlog sanitizer stopped further retries.'),
      },
    });
    updated += 1;
  }

  console.log(`[sanitize-email-backlog] updated ${updated} jobs`);
  await prisma.onModuleDestroy();
}

function appendAuditSuffix(message: string | null, suffix: string): string {
  const base = message?.trim();
  if (!base) {
    return suffix;
  }

  return `${base} | ${suffix}`;
}

main().catch((error) => {
  console.error(`[sanitize-email-backlog] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
