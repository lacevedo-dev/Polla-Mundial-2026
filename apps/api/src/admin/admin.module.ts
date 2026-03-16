import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminService } from './admin.service';
import { AdminStatsController } from './admin-stats.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminLeaguesController } from './admin-leagues.controller';
import { AdminMatchesController } from './admin-matches.controller';
import { AdminTeamsController } from './admin-teams.controller';
import { AdminPlansController } from './admin-plans.controller';
import { AdminAffiliationsController } from './admin-affiliations.controller';
import { AdminPredictionsController } from './admin-predictions.controller';
import { UsersModule } from '../users/users.module';
import { MatchesModule } from '../matches/matches.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule, UsersModule, MatchesModule],
    controllers: [
        AdminStatsController,
        AdminUsersController,
        AdminLeaguesController,
        AdminMatchesController,
        AdminTeamsController,
        AdminPlansController,
        AdminAffiliationsController,
        AdminPredictionsController,
    ],
    providers: [AdminService, Reflector],
})
export class AdminModule {}
