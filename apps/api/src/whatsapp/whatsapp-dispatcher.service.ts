import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { WhatsappWebService } from './whatsapp-web.service';
import { WhatsappGroupService } from './whatsapp-group.service';

@Injectable()
export class WhatsappDispatcherService {
  private readonly logger = new Logger(WhatsappDispatcherService.name);
  private running = false;
  private readonly immediateQueue = new Set<string>();

  constructor(
    private readonly waWeb: WhatsappWebService,
    @Inject(forwardRef(() => WhatsappGroupService))
    private readonly waGroup: WhatsappGroupService,
  ) {}

  /** Encola envío inmediato (mensajes de texto). El batch periódico procesa reportes pesados. */
  schedule(jobId: string): void {
    this.immediateQueue.add(jobId);
    void this.dispatch();
  }

  async dispatch(): Promise<{ sent: number; failed: number; total: number }> {
    if (this.running) {
      return { sent: 0, failed: 0, total: 0 };
    }

    await this.waWeb.tryRestoreSessionIfNeeded();

    if (!this.waWeb.isConnected()) {
      const pending = await this.waGroup.getPendingJobs(1);
      if (pending.length > 0) {
        const session = this.waWeb.getSessionInfo();
        this.logger.warn(
          `WA dispatcher omitido: status=${this.waWeb.getStatus()} ` +
            `pendingJobs>=1 sessionOnDisk=${session.sessionExists} ` +
            `(reconnect ${session.reconnectAttempts}/12)`,
        );
      }
      return { sent: 0, failed: 0, total: 0 };
    }

    this.running = true;
    let sent = 0;
    let failed = 0;
    let total = 0;

    try {
      const immediateIds = [...this.immediateQueue];
      this.immediateQueue.clear();

      for (const jobId of immediateIds) {
        total++;
        try {
          await this.waGroup.processJob(jobId);
          sent++;
        } catch {
          failed++;
        }
      }

      const jobs = await this.waGroup.getPendingJobs(10);
      for (const job of jobs) {
        if (immediateIds.includes(job.id)) continue;
        total++;
        try {
          await this.waGroup.processJob(job.id);
          sent++;
        } catch {
          failed++;
        }
      }

      if (total > 0) {
        this.logger.log(
          JSON.stringify({
            event: 'wa_dispatcher_batch',
            sent,
            failed,
            total,
            immediate: immediateIds.length,
          }),
        );
      }
    } finally {
      this.running = false;
      if (this.immediateQueue.size > 0) {
        void this.dispatch();
      }
    }

    return { sent, failed, total };
  }
}
