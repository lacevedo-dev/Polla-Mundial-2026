import { Module } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { LeaguesController } from './leagues.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ParticipationModule } from '../participation/participation.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [PrismaModule, ParticipationModule, NotificationsModule],
    providers: [LeaguesService],
    controllers: [LeaguesController],
    exports: [LeaguesService],
})
export class LeaguesModule { }
