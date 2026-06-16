import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@corp-api/auth/guards/jwt-auth.guard';
import { TenantMemberGuard } from '@corp-api/corporate-tenant/guards/tenant-member.guard';
import { PredictionsService } from '@corp-api/predictions/predictions.service';

/**
 * Controlador nativo de api-corp (no depende del override webpack de corporate-tenant).
 * Expone el desglose de ranking corporativo en rutas explícitas.
 */
@Controller('corp')
@UseGuards(JwtAuthGuard, TenantMemberGuard)
export class CorpApiRankingBreakdownController {
    constructor(private readonly predictionsService: PredictionsService) {}

    @Get('ranking-breakdown/:userId')
    async getRankingBreakdown(@Req() req: any, @Param('userId') userId: string) {
        const tenantId: string = req.tenantId;
        return this.predictionsService.getCorpTenantUserBreakdown(tenantId, userId);
    }

    @Get('ranking/user/:userId/breakdown')
    async getRankingUserBreakdown(@Req() req: any, @Param('userId') userId: string) {
        const tenantId: string = req.tenantId;
        return this.predictionsService.getCorpTenantUserBreakdown(tenantId, userId);
    }
}
