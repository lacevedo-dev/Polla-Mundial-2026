import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailQueueService } from './email-queue.service';

@Injectable()
export class EmailDispatcherScheduler {
  private readonly logger = new Logger(EmailDispatcherScheduler.name);

  constructor(private readonly emailQueue: EmailQueueService) {}

  @Cron('*/2 * * * *')
  async dispatchPendingEmailJobs(): Promise<void> {
    try {
      const result = await this.emailQueue.dispatchPendingJobs();
      if (result.processed > 0) {
        this.logger.log(`Email dispatcher processed ${result.processed} jobs (${result.sent} sent)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`dispatchPendingEmailJobs failed: ${message}`);
    }
  }
}
