import { Module } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { LeaguesController } from './leagues.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ParticipationModule } from '../participation/participation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
    imports: [PrismaModule, ParticipationModule, NotificationsModule, WhatsappModule, PushNotificationsModule],
    providers: [LeaguesService],
    controllers: [LeaguesController],
    exports: [LeaguesService],
})
export class LeaguesModule { }
