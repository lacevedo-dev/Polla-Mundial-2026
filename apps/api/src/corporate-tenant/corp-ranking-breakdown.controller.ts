import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMemberGuard } from './guards/tenant-member.guard';
import { PredictionsService } from '../predictions/predictions.service';

@Controller('corp')
@UseGuards(JwtAuthGuard, TenantMemberGuard)
export class CorpRankingBreakdownController {
    constructor(private readonly predictionsService: PredictionsService) {}

    @Get('ranking/user/:userId/breakdown')
    async getRankingUserBreakdown(@Req() req: any, @Param('userId') userId: string) {
        const tenantId: string = req.tenantId;
        return this.predictionsService.getCorpTenantUserBreakdown(tenantId, userId);
    }
}
