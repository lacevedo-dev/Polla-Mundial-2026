import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantService } from './tenant.service';
import { TenantLimitsService } from './tenant-limits.service';
import { TenantInvitationService } from './tenant-invitation.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantController } from './tenant.controller';
import { AdminTenantController } from './admin-tenant.controller';
import { TenantInvitationController, TenantInvitationAdminController } from './tenant-invitation.controller';
import { TenantMiddleware } from './tenant.middleware';
import { TenantMemberGuard } from './guards/tenant-member.guard';
import { TenantAdminGuard } from './guards/tenant-admin.guard';
import { TenantStaffGuard } from './guards/tenant-staff.guard';
import { CorpPortalController } from './corp-portal.controller';
import { BrandingStorageService } from './branding-storage.service';
import { ParticipationService } from './participation.service';
import { MatchOperationsService } from './match-operations.service';
import { CorpRankingService } from './corp-ranking.service';
import { PredictionsModule } from '../predictions/predictions.module';

@Module({
    imports: [PrismaModule, PredictionsModule],
    controllers: [
        TenantController,
        AdminTenantController,
        TenantInvitationController,
        TenantInvitationAdminController,
        CorpPortalController,
    ],
    providers: [
        TenantService,
        TenantLimitsService,
        TenantInvitationService,
        TenantProvisioningService,
        BrandingStorageService,
        ParticipationService,
        MatchOperationsService,
        CorpRankingService,
        TenantMemberGuard,
        TenantAdminGuard,
        TenantStaffGuard,
    ],
    exports: [TenantService, TenantLimitsService, TenantInvitationService, TenantProvisioningService, TenantMemberGuard, TenantAdminGuard, TenantStaffGuard],
})
export class CorporateTenantModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(TenantMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
