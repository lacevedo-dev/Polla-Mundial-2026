import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { PredictionReportModule } from '../prediction-report/prediction-report.module';
import { AutomationLiveConfigModule } from '../automation/config/automation-live-config.module';
import { StickersModule } from '../stickers/stickers.module';
import { WhatsappWebService } from './whatsapp-web.service';
import { WhatsappImageService } from './whatsapp-image.service';
import { WhatsappGroupService } from './whatsapp-group.service';
import { WhatsappDispatcherScheduler } from './whatsapp-dispatcher.scheduler';
import { WhatsappDispatcherService } from './whatsapp-dispatcher.service';

@Module({
  imports: [ScheduleModule, PrismaModule, PredictionReportModule, AutomationLiveConfigModule, StickersModule],
  providers: [
    WhatsappWebService,
    WhatsappImageService,
    WhatsappGroupService,
    WhatsappDispatcherService,
    WhatsappDispatcherScheduler,
  ],
  exports: [WhatsappWebService, WhatsappGroupService, WhatsappDispatcherService, WhatsappImageService],
})
export class WhatsappModule {}
