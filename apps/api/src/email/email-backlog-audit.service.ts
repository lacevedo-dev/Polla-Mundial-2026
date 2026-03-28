import { Injectable } from '@nestjs/common';
import {
  EmailBacklogAuditMode,
  EmailBacklogAuditStatus,
  EmailBacklogAuditTrigger,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmailBacklogAuditRunResult,
  EmailBacklogAuditTriggerValue,
  getEmailBacklogSnapshot,
  recordEmailBacklogAuditSkip,
  runEmailBacklogAudit,
  toEmailBacklogObservationSummary,
} from './email-backlog-audit.shared';

@Injectable()
export class EmailBacklogAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async runAudit(options?: {
    apply?: boolean;
    trigger?: EmailBacklogAuditTriggerValue;
  }): Promise<EmailBacklogAuditRunResult> {
    return runEmailBacklogAudit(this.prisma, {
      apply: options?.apply ?? true,
      trigger: options?.trigger ?? EmailBacklogAuditTrigger.SCHEDULER,
    });
  }

  async recordSkip(reason: string, details?: Record<string, unknown>): Promise<void> {
    await recordEmailBacklogAuditSkip(this.prisma, {
      trigger: EmailBacklogAuditTrigger.SCHEDULER,
      mode: EmailBacklogAuditMode.SANITIZE,
      reason,
      details,
    });
  }

  async getAutomationStatus() {
    const [snapshot, lastRun, recentFailures] = await Promise.all([
      getEmailBacklogSnapshot(this.prisma),
      this.prisma.emailBacklogAuditRun.findFirst({
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.emailBacklogAuditRun.count({
        where: {
          status: EmailBacklogAuditStatus.FAILED,
          startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      queue: snapshot,
      latestRun: lastRun,
      recentFailures,
    };
  }

  async listRuns(page = 1, limit = 20) {
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.min(100, Math.max(1, limit));

    const [total, runs] = await Promise.all([
      this.prisma.emailBacklogAuditRun.count(),
      this.prisma.emailBacklogAuditRun.findMany({
        orderBy: { startedAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      total,
      page: Math.max(1, page),
      limit: take,
      runs,
    };
  }

  summarizeForObservation(result: EmailBacklogAuditRunResult) {
    return toEmailBacklogObservationSummary(result);
  }
}
