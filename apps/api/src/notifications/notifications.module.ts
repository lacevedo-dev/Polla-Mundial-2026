import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AutomationModule } from '../automation/automation.module';
import { AutomationObservabilityModule } from '../automation-observability/automation-observability.module';
import { PredictionReportModule } from '../prediction-report/prediction-report.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FootballSyncModule } from '../football-sync/football-sync.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { NotificationsService } from './notifications.service';
import { MatchAutomationSweepScheduler } from './match-automation-sweep.scheduler';
import { NotificationScheduler } from './notification.scheduler';
import { NotificationsController } from './notifications.controller';
import { TwilioService } from './twilio.service';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
  imports: [
    ScheduleModule,
    PrismaModule,
    PushNotificationsModule,
    PredictionReportModule,
    AutomationObservabilityModule,
    forwardRef(() => AutomationModule),
    forwardRef(() => FootballSyncModule),
    WhatsappModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationScheduler,
    MatchAutomationSweepScheduler,
    TwilioService,
  ],
  exports: [NotificationsService, TwilioService, NotificationScheduler],
})
export class NotificationsModule {}
