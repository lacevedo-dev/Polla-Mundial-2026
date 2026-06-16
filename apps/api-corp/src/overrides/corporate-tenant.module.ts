import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { PrismaModule } from '@corp-api/prisma/prisma.module';
import { PrismaService } from '@corp-api/prisma/prisma.service';
import { EmailModule } from '@corp-api/email/email.module';
import { EmailQueueService } from '@corp-api/email/email-queue.service';

import { TenantService } from '@corp-api/corporate-tenant/tenant.service';
import { TenantLimitsService } from '@corp-api/corporate-tenant/tenant-limits.service';
import { TenantInvitationService } from '@corp-api/corporate-tenant/tenant-invitation.service';
import { TenantProvisioningService } from '@corp-api/corporate-tenant/tenant-provisioning.service';
import { TenantProvisioningService as TenantProvisioningServiceImpl } from './tenant-provisioning.service';
import { TenantController } from '@corp-api/corporate-tenant/tenant.controller';
import { AdminTenantController } from '@corp-api/corporate-tenant/admin-tenant.controller';
import { TenantInvitationController, TenantInvitationAdminController } from '@corp-api/corporate-tenant/tenant-invitation.controller';
import { TenantMiddleware } from '@corp-api/corporate-tenant/tenant.middleware';
import { TenantMemberGuard } from '@corp-api/corporate-tenant/guards/tenant-member.guard';
import { TenantAdminGuard } from '@corp-api/corporate-tenant/guards/tenant-admin.guard';
import { TenantStaffGuard } from '@corp-api/corporate-tenant/guards/tenant-staff.guard';
import { CorpPortalController } from '@corp-api/corporate-tenant/corp-portal.controller';
import { BrandingStorageService } from '@corp-api/corporate-tenant/branding-storage.service';
import { ParticipationService } from '@corp-api/corporate-tenant/participation.service';
import { MatchOperationsService } from '@corp-api/corporate-tenant/match-operations.service';
import { PredictionsModule } from '@corp-api/predictions/predictions.module';
import { CorpMembersResendController } from '@corp-api/corporate-tenant/corp-members-resend.controller';

@Module({
    imports: [PrismaModule, EmailModule, PredictionsModule],
    controllers: [
        TenantController,
        AdminTenantController,
        TenantInvitationController,
        TenantInvitationAdminController,
        CorpMembersResendController,
        CorpPortalController,
    ],
    providers: [
        TenantService,
        TenantLimitsService,
        BrandingStorageService,
        ParticipationService,
        MatchOperationsService,
        TenantMemberGuard,
        TenantAdminGuard,
        TenantStaffGuard,
        {
            provide: TenantInvitationService,
            useFactory: (
                prisma: PrismaService,
                emailQueue: EmailQueueService,
                limits: TenantLimitsService,
            ) => new TenantInvitationService(prisma, emailQueue as any, limits),
            inject: [PrismaService, EmailQueueService, TenantLimitsService],
        },
        {
            provide: TenantProvisioningService,
            useFactory: (
                prisma: PrismaService,
                emailQueue: EmailQueueService,
                limits: TenantLimitsService,
            ) => new TenantProvisioningServiceImpl(prisma as any, emailQueue as any, limits),
            inject: [PrismaService, EmailQueueService, TenantLimitsService],
        },
    ],
    exports: [
        TenantService,
        TenantLimitsService,
        TenantInvitationService,
        TenantProvisioningService,
        TenantMemberGuard,
        TenantAdminGuard,
        TenantStaffGuard,
    ],
})
export class CorporateTenantModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(TenantMiddleware)
            .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
}
