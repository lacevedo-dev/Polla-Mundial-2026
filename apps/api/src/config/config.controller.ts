import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

const SI_CREDITS_DEFAULTS: Record<string, number> = {
    FREE: 3,
    GOLD: 30,
    DIAMOND: 100,
};

@ApiTags('config')
@Controller('config')
export class ConfigController {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Public endpoint — no authentication required.
     * Returns the Smart Insights credit cap per plan as configured by the admin.
     * Falls back to hardcoded defaults if no override is stored.
     */
    @Get('plans')
    @ApiOperation({ summary: 'Get public plan configuration (credits, etc.)' })
    async getPlanConfig(): Promise<Record<string, unknown>> {
        const configs = await this.prisma.systemConfig.findMany({
            where: { key: { in: ['plan:FREE', 'plan:GOLD', 'plan:DIAMOND', 'si_credits_reset'] } },
        });

        const result: Record<string, { siCredits: number }> = {};

        for (const plan of ['FREE', 'GOLD', 'DIAMOND']) {
            const saved = configs.find((c) => c.key === `plan:${plan}`);
            const planData = saved?.value as Record<string, unknown> | null;
            result[plan] = {
                siCredits:
                    typeof planData?.siCredits === 'number'
                        ? planData.siCredits
                        : SI_CREDITS_DEFAULTS[plan],
            };
        }

        const resetRecord = configs.find((c) => c.key === 'si_credits_reset');
        const creditsResetAt = (resetRecord?.value as Record<string, unknown> | null)?.resetAt as string | null ?? null;

        return { ...result, _meta: { creditsResetAt } };
    }
}
