import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ParticipationController } from './participation.controller';
import { ParticipationService } from './participation.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [ParticipationService],
  controllers: [ParticipationController],
  exports: [ParticipationService],
})
export class ParticipationModule {}
