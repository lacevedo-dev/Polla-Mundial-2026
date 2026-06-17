import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WhatsappWebService } from './whatsapp-web.service';
import { WhatsappGroupService } from './whatsapp-group.service';

@Injectable()
export class WhatsappDispatcherScheduler {
  private readonly logger = new Logger(WhatsappDispatcherScheduler.name);
  private running = false;

  constructor(
    private readonly waWeb: WhatsappWebService,
    private readonly waGroup: WhatsappGroupService,
  ) {}

  @Cron('* * * * *')
  async dispatchPendingJobs(): Promise<void> {
    if (this.running) return;
    if (!this.waWeb.isConnected()) return;

    this.running = true;
    try {
      const jobs = await this.waGroup.getPendingJobs(10);
      if (jobs.length === 0) return;

      let sent = 0;
      let failed = 0;

      for (const job of jobs) {
        try {
          await this.waGroup.processJob(job.id);
          sent++;
        } catch {
          failed++;
        }
      }

      this.logger.log(
        JSON.stringify({
          event: 'wa_dispatcher_batch',
          sent,
          failed,
          total: jobs.length,
          jobs: jobs.map((j) => ({
            id: j.id,
            type: j.type,
            matchId: j.matchId,
            leagueId: j.leagueId,
            dedupeKey: j.dedupeKey,
          })),
        }),
      );
    } finally {
      this.running = false;
    }
  }
}
