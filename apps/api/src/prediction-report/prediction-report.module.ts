import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { PredictionReportService } from './prediction-report.service';
import { PredictionReportEmailService } from './prediction-report-email.service';
import { PredictionReportScheduler } from './prediction-report.scheduler';
import { PredictionReportController } from './prediction-report.controller';

@Module({
  imports: [ScheduleModule, PrismaModule],
  controllers: [PredictionReportController],
  providers: [
    PredictionReportService,
    PredictionReportEmailService,
    PredictionReportScheduler,
  ],
  exports: [PredictionReportService],
})
export class PredictionReportModule {}
