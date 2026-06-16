import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';

// Módulos del API principal (vía alias @corp-api → apps/api/src)
import { PrismaModule } from '@corp-api/prisma/prisma.module';
import { AuthModule } from '@corp-api/auth/auth.module';
import { EmailModule } from '@corp-api/email/email.module';
import { UsersModule } from '@corp-api/users/users.module';
import { PushNotificationsModule } from '@corp-api/push-notifications/push-notifications.module';
import { PredictionsModule } from '@corp-api/predictions/predictions.module';
import { CorporateTenantModule } from '@corp-api/corporate-tenant/corporate-tenant.module';

// Módulos propios del backend corporativo
import { FootballProxyModule } from './football-proxy/football-proxy.module';
import { CorpHealthModule } from './health/corp-health.module';
import { DataSyncModule } from './sync/data-sync.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CorpDeployModule } from './deploy/corp-deploy.module';
import { CorpRankingDetailModule } from './corp-ranking-detail/corp-ranking-detail.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
        ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'uploads'),
            serveRoot: '/uploads',
        }),
        ScheduleModule.forRoot(),

        // Infraestructura compartida (mismos módulos del api principal)
        PrismaModule,
        EmailModule,
        UsersModule,
        AuthModule,
        PushNotificationsModule,

        // Expone /predictions/* (leaderboard breakdown fallback en web-uni)
        PredictionsModule,

        // Módulo corporativo principal (/corp/ranking, /corp/ranking/user/:id/breakdown, …)
        CorporateTenantModule,

        // Desglose de ranking (GET /corp/member-points/:userId)
        CorpRankingDetailModule,

        // Probe público de versión desplegada (/api-corp-version)
        CorpDeployModule,

        // Módulo nuevo: proxy de datos de fútbol desde el VPS principal
        FootballProxyModule,

        // Sincronización de datos desde API principal
        DataSyncModule,

        // Notificaciones desde BD corporativa
        NotificationsModule,

        // Health check propio
        CorpHealthModule,
    ],
})
export class CorpAppModule {}
