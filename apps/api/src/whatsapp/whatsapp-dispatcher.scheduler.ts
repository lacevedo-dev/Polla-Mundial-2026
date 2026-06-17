import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { WhatsappDispatcherService } from './whatsapp-dispatcher.service';

/** Intervalo del barrido de jobs pendientes (reportes PDF/imagen). */
const WA_GROUP_DISPATCH_INTERVAL_MS = 15_000;

@Injectable()
export class WhatsappDispatcherScheduler {
  private readonly logger = new Logger(WhatsappDispatcherScheduler.name);

  constructor(private readonly dispatcher: WhatsappDispatcherService) {}

  @Interval(WA_GROUP_DISPATCH_INTERVAL_MS)
  async dispatchPendingJobs(): Promise<void> {
    try {
      await this.dispatcher.dispatch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`dispatchPendingJobs failed: ${message}`);
    }
  }
}
