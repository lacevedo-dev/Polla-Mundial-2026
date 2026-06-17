import { Injectable, Logger } from '@nestjs/common';
import { WhatsappGroupJobType } from '@prisma/client';
import { WhatsappWebService } from './whatsapp-web.service';
import { WhatsappGroupService } from './whatsapp-group.service';

/** Jobs que solo envían texto (sin generar PDF/imagen). */
export const TEXT_ONLY_WHATSAPP_GROUP_JOB_TYPES = new Set<WhatsappGroupJobType>([
  WhatsappGroupJobType.MATCH_REMINDER,
  WhatsappGroupJobType.PREDICTION_CLOSED,
  WhatsappGroupJobType.RESULT_NOTIFICATION,
  WhatsappGroupJobType.GOAL_SCORED,
  WhatsappGroupJobType.PRE_MATCH_ESCALATION,
  WhatsappGroupJobType.MATCH_START,
  WhatsappGroupJobType.HALFTIME,
  WhatsappGroupJobType.SECOND_HALF_START,
  WhatsappGroupJobType.MATCH_LIVE_END,
  WhatsappGroupJobType.GOAL_IMPACT,
  WhatsappGroupJobType.PAYMENT_REMINDER,
]);

export function isTextOnlyWhatsappGroupJob(type: WhatsappGroupJobType): boolean {
  return TEXT_ONLY_WHATSAPP_GROUP_JOB_TYPES.has(type);
}

@Injectable()
export class WhatsappDispatcherService {
  private readonly logger = new Logger(WhatsappDispatcherService.name);
  private running = false;
  private readonly immediateQueue = new Set<string>();

  constructor(
    private readonly waWeb: WhatsappWebService,
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
    if (!this.waWeb.isConnected()) {
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
