import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AutomationTimingConfigService } from '../automation/config/automation-timing-config.service';
import { AutomationObservabilityModule } from '../automation-observability/automation-observability.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PredictionReportService } from './prediction-report.service';
import { PredictionReportEmailService } from './prediction-report-email.service';
import { PredictionReportScheduler } from './prediction-report.scheduler';
import { PredictionReportController } from './prediction-report.controller';
import { PdfReportService } from './pdf-report.service';

@Module({
  imports: [ScheduleModule, PrismaModule, AutomationObservabilityModule, EmailModule],
  // EventEmitterModule is registered globally in AppModule
  controllers: [PredictionReportController],
  providers: [
    PredictionReportService,
    PredictionReportEmailService,
    PredictionReportScheduler,
    PdfReportService,
    AutomationTimingConfigService,
  ],
  exports: [PredictionReportService, PredictionReportScheduler],
})
export class PredictionReportModule {}
