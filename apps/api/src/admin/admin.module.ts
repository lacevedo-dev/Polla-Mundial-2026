import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AutomationObservabilityModule } from '../automation-observability/automation-observability.module';
import { UsersModule } from '../users/users.module';
import { MatchesModule } from '../matches/matches.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { LeaguesModule } from '../leagues/leagues.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { EmailModule } from '../email/email.module';
import { PredictionReportModule } from '../prediction-report/prediction-report.module';
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
import { AdminPredictionsStreamController } from './admin-predictions-stream.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminAutomationController } from './admin-automation.controller';
import { AdminEmailProvidersController } from './admin-email-providers.controller';
import { AdminEmailLogsController } from './admin-email-logs.controller';
import { AdminSystemController } from './admin-system.controller';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    MatchesModule,
    NotificationsModule,
    PredictionsModule,
    LeaguesModule,
    PushNotificationsModule,
    EmailModule,
    AutomationObservabilityModule,
    PredictionReportModule,
  ],
  controllers: [
    AdminStatsController,
    AdminUsersController,
    AdminLeaguesController,
    AdminMatchesController,
    AdminTeamsController,
    AdminPlansController,
    AdminAffiliationsController,
    AdminPredictionsController,
    AdminPredictionsStreamController,
    AdminSettingsController,
    AdminPaymentsController,
    AdminAutomationController,
    AdminEmailProvidersController,
    AdminEmailLogsController,
    AdminSystemController,
  ],
  providers: [AdminService, AdminPaymentsService, Reflector],
})
export class AdminModule {}
