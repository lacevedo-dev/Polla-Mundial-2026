import { Module } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { LeaguesController } from './leagues.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ParticipationModule } from '../participation/participation.module';

@Module({
    imports: [PrismaModule, ParticipationModule],
    providers: [LeaguesService],
    controllers: [LeaguesController],
    exports: [LeaguesService],
})
export class LeaguesModule { }
