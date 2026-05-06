import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantService } from './tenant.service';
import { TenantLimitsService } from './tenant-limits.service';
import { TenantInvitationService } from './tenant-invitation.service';
import { TenantController } from './tenant.controller';
import { AdminTenantController } from './admin-tenant.controller';
import { TenantInvitationController, TenantInvitationAdminController } from './tenant-invitation.controller';
import { TenantMiddleware } from './tenant.middleware';
import { TenantMemberGuard } from './guards/tenant-member.guard';
import { TenantAdminGuard } from './guards/tenant-admin.guard';

@Module({
    imports: [PrismaModule],
    controllers: [
        TenantController,
        AdminTenantController,
        TenantInvitationController,
        TenantInvitationAdminController,
    ],
    providers: [
        TenantService,
        TenantLimitsService,
        TenantInvitationService,
        TenantMemberGuard,
        TenantAdminGuard,
    ],
    exports: [TenantService, TenantLimitsService, TenantInvitationService, TenantMemberGuard, TenantAdminGuard],
})
export class CorporateTenantModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(TenantMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
