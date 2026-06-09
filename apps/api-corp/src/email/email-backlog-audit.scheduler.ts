import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailBacklogAuditMode } from '@prisma/client';
import { observeSchedulerJob } from '@corp-api/common/scheduler-observability.util';
import {
  logExclusiveBackgroundJobSkip,
  tryRunExclusiveBackgroundJob,
} from '@corp-api/prisma/background-job-lock.util';
import { EmailBacklogAuditService } from './email-backlog-audit.service';

@Injectable()
export class EmailBacklogAuditScheduler {
  private static readonly LOCK_KEY = 'email-backlog-audit-job';
  private readonly logger = new Logger(EmailBacklogAuditScheduler.name);

  constructor(private readonly emailBacklogAudit: EmailBacklogAuditService) {}

  @Cron('*/15 * * * *')
  async auditEmailBacklog(): Promise<void> {
    await observeSchedulerJob(this.logger, 'auditEmailBacklog', async () => {
      const execution = await tryRunExclusiveBackgroundJob(
        EmailBacklogAuditScheduler.LOCK_KEY,
        'auditEmailBacklog',
        () => this.emailBacklogAudit.runAudit({ apply: true }),
      );

      if (!execution.ran) {
        const skipped = execution as any;
        logExclusiveBackgroundJobSkip(this.logger, 'auditEmailBacklog', skipped);
        await this.emailBacklogAudit.recordSkip('lock_held', {
          holder: skipped.skip.holder,
          heldMs: skipped.skip.heldMs,
          skipCount: skipped.skip.skipCount,
          requestedBy: skipped.skip.requestedBy,
        });

        return {
          status: 'skipped' as const,
          summary: {
            reason: 'lock_held',
            mode: EmailBacklogAuditMode.SANITIZE,
            heldMs: skipped.skip.heldMs,
            skipCount: skipped.skip.skipCount,
          },
        };
      }

      return {
        status: 'completed' as const,
        summary: this.emailBacklogAudit.summarizeForObservation(execution.result),
      };
    });
  }
}
