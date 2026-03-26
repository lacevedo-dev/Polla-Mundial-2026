import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminService } from './admin.service';
import { AdminPaymentsService } from './admin-payments.service';
import { AdminStatsController } from './admin-stats.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminLeaguesController } from './admin-leagues.controller';
import { AdminMatchesController } from './admin-matches.controller';
import { AdminTeamsController } from './admin-teams.controller';
import { AdminPlansController } from './admin-plans.controller';
import { AdminAffiliationsController } from './admin-affiliations.controller';
import { AdminPredictionsController } from './admin-predictions.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminAutomationController } from './admin-automation.controller';
import { UsersModule } from '../users/users.module';
import { MatchesModule } from '../matches/matches.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { LeaguesModule } from '../leagues/leagues.module';

@Module({
    imports: [PrismaModule, UsersModule, MatchesModule, NotificationsModule, PredictionsModule, LeaguesModule],
    controllers: [
        AdminStatsController,
        AdminUsersController,
        AdminLeaguesController,
        AdminMatchesController,
        AdminTeamsController,
        AdminPlansController,
        AdminAffiliationsController,
        AdminPredictionsController,
        AdminSettingsController,
        AdminPaymentsController,
        AdminAutomationController,
    ],
    providers: [AdminService, AdminPaymentsService, Reflector],
})
export class AdminModule {}
