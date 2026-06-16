import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@corp-api/auth/guards/jwt-auth.guard';
import { TenantMemberGuard } from '@corp-api/corporate-tenant/guards/tenant-member.guard';
import { PredictionsService } from '@corp-api/predictions/predictions.service';

/**
 * Rutas nativas de api-corp (solo apps/api-corp) para desglose de ranking.
 * Path distinto a /corp/ranking/user/... para evitar conflictos de despliegue parcial.
 */
@Controller('corp')
@UseGuards(JwtAuthGuard, TenantMemberGuard)
export class CorpRankingDetailController {
    constructor(private readonly predictionsService: PredictionsService) {}

    @Get('member-points/:userId')
    getMemberPoints(@Req() req: { tenantId: string }, @Param('userId') userId: string) {
        return this.predictionsService.getCorpTenantUserBreakdown(req.tenantId, userId);
    }
}
