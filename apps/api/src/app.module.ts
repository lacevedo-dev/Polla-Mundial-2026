import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LeaguesModule } from './leagues/leagues.module';
import { PredictionsModule } from './predictions/predictions.module';
import { MatchesModule } from './matches/matches.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from './config/config.module';
import { InsightsModule } from './insights/insights.module';
import { FootballSyncModule } from './football-sync/football-sync.module';
import { AiCreditsModule } from './ai-credits/ai-credits.module';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    AdminModule,
    ConfigModule,
    InsightsModule,
    AiCreditsModule,
    UsersModule,
    LeaguesModule,
    PredictionsModule,
    MatchesModule,
    PaymentsModule,
    OrdersModule,
    NotificationsModule,
    DashboardModule,
    PrismaModule,
    CommonModule,
    HealthModule,
    FootballSyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
