import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { tryRunExclusiveBackgroundJob } from '../prisma/background-job-lock.util';
import { PredictionReportService } from './prediction-report.service';

@Injectable()
export class PredictionReportScheduler {
  private static readonly BACKGROUND_DB_JOB_KEY = 'background-db-job';
  private readonly logger = new Logger(PredictionReportScheduler.name);

  constructor(private readonly reportService: PredictionReportService) {}

  /** Cada minuto revisa si alguna ventana de predicciones acaba de cerrarse */
  @Cron('* * * * *')
  async checkAndSendReports(): Promise<void> {
    const execution = await tryRunExclusiveBackgroundJob(
      PredictionReportScheduler.BACKGROUND_DB_JOB_KEY,
      () => this.runCheckAndSendReports(),
    );

    if (!execution.ran) {
      this.logger.warn('checkAndSendReports skipped because another DB-heavy background job is running');
      return;
    }
  }

  private async runCheckAndSendReports(): Promise<void> {
    try {
      await this.reportService.sendPendingReports();
    } catch (err: any) {
      this.logger.error(`Error en scheduler de reportes: ${err.message}`, err.stack);
    }
  }
}
