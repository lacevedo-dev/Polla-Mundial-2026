import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '@corp-api/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [NotificationsController],
})
export class NotificationsModule {}
