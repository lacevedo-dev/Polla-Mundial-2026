import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantInvitationService } from './tenant-invitation.service';
import { TenantAdminGuard } from './guards/tenant-admin.guard';
import { InviteTenantMemberDto, BulkInviteTenantDto } from './dto/tenant.dto';

@Controller('tenant-invitations')
export class TenantInvitationController {
    constructor(private readonly invitationService: TenantInvitationService) {}

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('accept/:token')
    async acceptByToken(@Param('token') token: string, @Request() req) {
        return this.invitationService.acceptByToken(token, req.user.userId);
    }
}

@UseGuards(JwtAuthGuard, TenantAdminGuard)
@Controller('tenants/:tenantId/invitations')
export class TenantInvitationAdminController {
    constructor(private readonly invitationService: TenantInvitationService) {}

    @Get()
    listInvitations(@Param('tenantId') tenantId: string) {
        return this.invitationService.listInvitations(tenantId);
    }

    @Post('invite')
    @HttpCode(HttpStatus.OK)
    invite(@Param('tenantId') tenantId: string, @Body() dto: InviteTenantMemberDto) {
        return this.invitationService.inviteSingle(tenantId, dto.email, dto.role);
    }

    @Post('invite/bulk')
    @HttpCode(HttpStatus.OK)
    inviteBulk(@Param('tenantId') tenantId: string, @Body() dto: BulkInviteTenantDto) {
        return this.invitationService.inviteBulk(tenantId, dto.emails, dto.role, dto.bulkBatchId);
    }

    @Post(':invId/resend')
    @HttpCode(HttpStatus.OK)
    resend(@Param('tenantId') tenantId: string, @Param('invId') invId: string) {
        return this.invitationService.resendInvitation(tenantId, invId);
    }
}
