import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AutomationObservabilityModule } from '../automation-observability/automation-observability.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PredictionReportService } from './prediction-report.service';
import { PredictionReportEmailService } from './prediction-report-email.service';
import { PredictionReportScheduler } from './prediction-report.scheduler';
import { PredictionReportController } from './prediction-report.controller';

@Module({
  imports: [ScheduleModule, PrismaModule, AutomationObservabilityModule],
  controllers: [PredictionReportController],
  providers: [
    PredictionReportService,
    PredictionReportEmailService,
    PredictionReportScheduler,
  ],
  exports: [PredictionReportService, PredictionReportScheduler],
})
export class PredictionReportModule {}
