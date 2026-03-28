import {
  EmailBacklogAuditMode,
  EmailBacklogAuditStatus,
  EmailJobStatus,
} from '@prisma/client';
import { runEmailBacklogAudit } from './email-backlog-audit.shared';

describe('runEmailBacklogAudit', () => {
  it('persiste un resumen y sanea jobs accionables sin tocar los no accionables', async () => {
    const staleSendingJob = {
      id: 'job-stale',
      type: 'MATCH_REMINDER',
      priority: 'HIGH',
      status: EmailJobStatus.SENDING,
      required: false,
      recipientEmail: 'stale@example.com',
      subject: 'Stale',
      html: '<p>stale</p>',
      text: 'stale',
      dedupeKey: 'stale',
      matchId: null,
      leagueId: null,
      providerKey: 'default',
      scheduledAt: new Date('2026-03-28T00:00:00.000Z'),
      availableAt: new Date('2026-03-28T00:00:00.000Z'),
      lastAttemptAt: new Date(Date.now() - 30 * 60_000),
      attemptCount: 1,
      sentAt: null,
      lastError: 'Greeting never received',
      createdAt: new Date('2026-03-28T00:00:00.000Z'),
      updatedAt: new Date('2026-03-28T00:00:00.000Z'),
    };
    const exhaustedRetryJob = {
      ...staleSendingJob,
      id: 'job-exhausted',
      status: EmailJobStatus.PENDING,
      required: true,
      recipientEmail: 'required@example.com',
      attemptCount: 6,
      lastAttemptAt: new Date('2026-03-28T00:10:00.000Z'),
    };
    const withinBudgetJob = {
      ...staleSendingJob,
      id: 'job-within-budget',
      status: EmailJobStatus.DEFERRED,
      required: false,
      recipientEmail: 'optional@example.com',
      attemptCount: 2,
      lastAttemptAt: new Date('2026-03-28T00:20:00.000Z'),
    };

    const count = jest.fn(({ where }) => {
      switch (where?.status) {
        case EmailJobStatus.PENDING:
          return Promise.resolve(1);
        case EmailJobStatus.DEFERRED:
          return Promise.resolve(1);
        case EmailJobStatus.SENDING:
          return Promise.resolve(1);
        case EmailJobStatus.FAILED:
          return Promise.resolve(0);
        case EmailJobStatus.DROPPED:
          return Promise.resolve(0);
        default:
          return Promise.resolve(0);
      }
    });
    const findMany = jest.fn((args) => {
      if (args.where?.status === EmailJobStatus.SENDING) {
        return Promise.resolve([staleSendingJob]);
      }

      return Promise.resolve([exhaustedRetryJob, withinBudgetJob]);
    });
    const updateJob = jest.fn().mockResolvedValue({});
    const createRun = jest.fn().mockResolvedValue({
      id: 'run-1',
      startedAt: new Date('2026-03-28T01:00:00.000Z'),
    });
    const updateRun = jest.fn().mockResolvedValue({});

    const result = await runEmailBacklogAudit(
      {
        emailJob: {
          count,
          findMany,
          update: updateJob,
        },
        emailBacklogAuditRun: {
          create: createRun,
          update: updateRun,
        },
      },
      {
        apply: true,
        trigger: 'MANUAL',
      },
    );

    expect(result.mode).toBe(EmailBacklogAuditMode.SANITIZE);
    expect(result.status).toBe(EmailBacklogAuditStatus.COMPLETED);
    expect(result.inspectedCount).toBe(3);
    expect(result.actionableCount).toBe(2);
    expect(result.sanitizedCount).toBe(2);
    expect(result.deferredCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.droppedCount).toBe(0);
    expect(result.notActionedCount).toBe(1);
    expect(result.transientWithinBudgetCount).toBe(1);
    expect(result.summary.actionedSample).toHaveLength(2);
    expect(result.summary.notActionedSample).toHaveLength(1);
    expect(updateJob).toHaveBeenCalledTimes(2);
    expect(updateJob).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'job-stale' },
        data: expect.objectContaining({ status: EmailJobStatus.DEFERRED }),
      }),
    );
    expect(updateJob).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'job-exhausted' },
        data: expect.objectContaining({ status: EmailJobStatus.FAILED }),
      }),
    );
    expect(updateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: EmailBacklogAuditStatus.COMPLETED,
          actionableCount: 2,
          sanitizedCount: 2,
          notActionedCount: 1,
        }),
      }),
    );
  });
});
