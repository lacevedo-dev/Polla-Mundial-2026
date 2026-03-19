import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    PrismaModule,
    PredictionsModule,
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
  ],
  exports: [MatchSyncService, MonitoringService, FootballConfigService],
})
export class FootballSyncModule {}
