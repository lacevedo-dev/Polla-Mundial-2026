import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PredictionReportService } from './prediction-report.service';

@Injectable()
export class PredictionReportScheduler {
  private readonly logger = new Logger(PredictionReportScheduler.name);

  constructor(private readonly reportService: PredictionReportService) {}

  /** Cada minuto revisa si alguna ventana de predicciones acaba de cerrarse */
  @Cron('* * * * *')
  async checkAndSendReports(): Promise<void> {
    try {
      await this.reportService.sendPendingReports();
    } catch (err: any) {
      this.logger.error(`Error en scheduler de reportes: ${err.message}`, err.stack);
    }
  }
}
