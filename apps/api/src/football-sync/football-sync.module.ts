import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { ApiFootballClient } from './services/api-football-client.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { SyncPlanService } from './services/sync-plan.service';
import { MatchSyncService } from './services/match-sync.service';
import { MonitoringService } from './services/monitoring.service';
import { ConfigService as FootballConfigService } from './services/config.service';
import { AdaptiveSyncScheduler } from './schedulers/adaptive-sync.scheduler';
import { FootballSyncController } from './football-sync.controller';
import { AdminMonitoringController } from './controllers/admin-monitoring.controller';
import { TournamentImportService } from './services/tournament-import.service';
import { PredictionReportModule } from '../prediction-report/prediction-report.module';
import { SyncEventsService } from './services/sync-events.service';
import { SyncOptimizationService } from './services/sync-optimization.service';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ScheduleModule,
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 3,
    }),
    PrismaModule,
    PredictionsModule,
    PredictionReportModule,
    PushNotificationsModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [FootballSyncController, AdminMonitoringController],
  providers: [
    ApiFootballClient,
    RateLimiterService,
    SyncPlanService,
    MatchSyncService,
    MonitoringService,
    FootballConfigService,
    AdaptiveSyncScheduler,
    TournamentImportService,
    SyncEventsService,
    SyncOptimizationService,
  ],
  exports: [MatchSyncService, MonitoringService, FootballConfigService, TournamentImportService, SyncEventsService, SyncPlanService, SyncOptimizationService],
})
export class FootballSyncModule {}
