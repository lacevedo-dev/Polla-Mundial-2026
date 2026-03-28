import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PredictionReportModule } from '../prediction-report/prediction-report.module';
import { PrismaModule } from '../prisma/prisma.module';
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
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationScheduler,
    MatchAutomationSweepScheduler,
    TwilioService,
  ],
  exports: [NotificationsService, TwilioService],
})
export class NotificationsModule {}
