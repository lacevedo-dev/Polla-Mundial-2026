import { Controller, Get, Post, Body, Query, Request, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AiCreditsService, CreditSummary } from './ai-credits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemRole } from '@prisma/client';

@Controller('ai-credits')
@UseGuards(JwtAuthGuard)
export class AiCreditsController {
    constructor(private readonly aiCreditsService: AiCreditsService) {}

    /**
     * GET /ai-credits/summary
     * Obtiene el resumen de créditos del usuario autenticado
     */
    @Get('summary')
    async getMySummary(@Request() req: any): Promise<CreditSummary> {
        const userId = req.user.userId;
        return this.aiCreditsService.getUserCreditSummary(userId);
    }

    /**
     * POST /ai-credits/consume
     * Consume créditos IA y registra la transacción
     */
    @Post('consume')
    async consumeCredits(
        @Request() req: any,
        @Body() body: {
            leagueId?: string;
            matchId?: string;
            feature: string;
            creditsUsed?: number;
            requestData?: any;
            responseData?: any;
            insightGenerated?: boolean;
            clientInfo?: string;
        },
    ) {
        const userId = req.user.userId;
        return this.aiCreditsService.consumeCredits({
            userId,
            ...body,
        });
    }

    /**
     * GET /ai-credits/history
     * Obtiene el historial de uso del usuario autenticado
     */
    @Get('history')
    async getMyHistory(
        @Request() req: any,
        @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
        @Query('offset', new ParseIntPipe({ optional: true })) offset = 0,
    ) {
        const userId = req.user.userId;
        return this.aiCreditsService.getUserUsageHistory(userId, limit, offset);
    }

    /**
     * POST /ai-credits/reset
     * Resetea los créditos del usuario autenticado
     */
    @Post('reset')
    async resetMyCredits(@Request() req: any): Promise<CreditSummary> {
        const userId = req.user.userId;
        return this.aiCreditsService.resetUserCredits(userId);
    }

    // ============ ENDPOINTS DE ADMINISTRACIÓN ============

    /**
     * GET /ai-credits/admin/stats
     * Obtiene estadísticas globales de uso de IA (solo admin)
     */
    @Get('admin/stats')
    @UseGuards(RolesGuard)
    @Roles(SystemRole.ADMIN, SystemRole.SUPERADMIN)
    async getGlobalStats(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.aiCreditsService.getGlobalUsageStats(
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
        );
    }

    /**
     * GET /ai-credits/admin/records
     * Obtiene todos los registros de uso con filtros (solo admin)
     */
    @Get('admin/records')
    @UseGuards(RolesGuard)
    @Roles(SystemRole.ADMIN, SystemRole.SUPERADMIN)
    async getAllRecords(
        @Query('userId') userId?: string,
        @Query('leagueId') leagueId?: string,
        @Query('feature') feature?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('limit', new ParseIntPipe({ optional: true })) limit = 100,
        @Query('offset', new ParseIntPipe({ optional: true })) offset = 0,
    ) {
        return this.aiCreditsService.getAllUsageRecords(
            {
                userId,
                leagueId,
                feature,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
            },
            limit,
            offset,
        );
    }

    /**
     * GET /ai-credits/admin/user/:userId/summary
     * Obtiene el resumen de créditos de un usuario específico (solo admin)
     */
    @Get('admin/user/:userId/summary')
    @UseGuards(RolesGuard)
    @Roles(SystemRole.ADMIN, SystemRole.SUPERADMIN)
    async getUserSummary(@Query('userId') userId: string): Promise<CreditSummary> {
        return this.aiCreditsService.getUserCreditSummary(userId);
    }

    /**
     * POST /ai-credits/admin/user/:userId/reset
     * Resetea los créditos de un usuario específico (solo admin)
     */
    @Post('admin/user/:userId/reset')
    @UseGuards(RolesGuard)
    @Roles(SystemRole.ADMIN, SystemRole.SUPERADMIN)
    async resetUserCredits(@Query('userId') userId: string): Promise<CreditSummary> {
        return this.aiCreditsService.resetUserCredits(userId);
    }
}
