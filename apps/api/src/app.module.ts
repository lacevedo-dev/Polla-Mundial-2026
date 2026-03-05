import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LeaguesModule } from './leagues/leagues.module';
import { PredictionsModule } from './predictions/predictions.module';
import { MatchesModule } from './matches/matches.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [AuthModule, UsersModule, LeaguesModule, PredictionsModule, MatchesModule, PaymentsModule, NotificationsModule, PrismaModule, CommonModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
