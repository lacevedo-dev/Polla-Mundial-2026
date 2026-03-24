import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParticipationController } from './participation.controller';
import { ParticipationService } from './participation.service';
import { ParticipationScheduler } from './participation.scheduler';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [ParticipationService, ParticipationScheduler],
  controllers: [ParticipationController],
  exports: [ParticipationService],
})
export class ParticipationModule {}
