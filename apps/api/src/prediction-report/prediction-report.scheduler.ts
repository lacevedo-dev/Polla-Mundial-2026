import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { observeSchedulerJob } from '../common/scheduler-observability.util';
import {
  logExclusiveBackgroundJobSkip,
  tryRunExclusiveBackgroundJob,
} from '../prisma/background-job-lock.util';
import { PredictionReportService } from './prediction-report.service';

@Injectable()
export class PredictionReportScheduler {
  private static readonly BACKGROUND_DB_JOB_KEY = 'background-db-job';
  private readonly logger = new Logger(PredictionReportScheduler.name);

  constructor(private readonly reportService: PredictionReportService) {}

  /** Cada minuto revisa si alguna ventana de predicciones acaba de cerrarse */
  @Cron('* * * * *')
  async checkAndSendReports(): Promise<void> {
    await observeSchedulerJob(this.logger, 'checkAndSendReports', async () => {
      const execution = await tryRunExclusiveBackgroundJob(
        PredictionReportScheduler.BACKGROUND_DB_JOB_KEY,
        'checkAndSendReports',
        () => this.runCheckAndSendReports(),
      );

      if (!execution.ran) {
        logExclusiveBackgroundJobSkip(
          this.logger,
          'checkAndSendReports',
          execution,
        );
        return {
          status: 'skipped',
          summary: {
            reason: 'background_lock',
            lockHolder: execution.skip.holder,
            heldMs: execution.skip.heldMs,
            skipCount: execution.skip.skipCount,
          },
        };
      }

      return {
        status: 'completed',
        level: 'log',
        summary: {
          result: 'send_pending_reports_completed',
        },
      };
    });
  }

  private async runCheckAndSendReports(): Promise<void> {
    try {
      await this.reportService.sendPendingReports();
    } catch (err: any) {
      this.logger.error(`Error en scheduler de reportes: ${err.message}`, err.stack);
    }
  }
}
