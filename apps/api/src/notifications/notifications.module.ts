import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from './notifications.service';
import { NotificationScheduler } from './notification.scheduler';
import { TwilioService } from './twilio.service';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, PushNotificationsModule],
  providers: [NotificationsService, NotificationScheduler, TwilioService],
  exports: [NotificationsService, TwilioService],
})
export class NotificationsModule {}
