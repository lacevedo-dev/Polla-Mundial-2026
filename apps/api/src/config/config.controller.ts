import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { parseSystemConfigValue } from '../system-config/system-config.util';

const PLAN_DEFAULTS: Record<string, { siCredits: number; price: number; features: string[]; maxParticipants: number }> = {
    FREE:    { siCredits: 3,   price: 0,     features: ['Hasta 10 Jugadores', 'Marcadores en Vivo', 'Ads Limitados', 'Soporte Básico'],                                               maxParticipants: 10 },
    GOLD:    { siCredits: 30,  price: 29000, features: ['Hasta 50 Jugadores', 'Sin Publicidad', 'Personalización Básica', 'Soporte Prioritario', 'Exportar Datos'],                 maxParticipants: 50 },
    DIAMOND: { siCredits: 100, price: 89000, features: ['Jugadores Ilimitados', 'Whitelabel (Tu Logo)', 'Analytics Avanzados', 'Gestor de Pagos', 'Soporte VIP 24/7'], maxParticipants: -1 },
};

const PUBLIC_REGISTRATION_CONFIG_KEY = 'public_registration';

function normalizePublicRegistrationConfig(value: any) {
    return {
        requireParticipationCode: value?.requireParticipationCode !== false,
        defaultLeagueCode: typeof value?.defaultLeagueCode === 'string' ? value.defaultLeagueCode.trim().toUpperCase() : '',
    };
}

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

        const result: Record<string, { siCredits: number; price: number; features: string[]; maxParticipants: number }> = {};

        for (const plan of ['FREE', 'GOLD', 'DIAMOND']) {
            const saved = configs.find((c) => c.key === `plan:${plan}`);
            const planData = parseSystemConfigValue<any>(saved?.value);
            const defaults = PLAN_DEFAULTS[plan];
            result[plan] = {
                siCredits:       typeof planData?.siCredits === 'number'       ? planData.siCredits       : defaults.siCredits,
                price:           typeof planData?.price === 'number'           ? planData.price           : defaults.price,
                features:        Array.isArray(planData?.features)             ? planData.features as string[] : defaults.features,
                maxParticipants: typeof planData?.maxParticipants === 'number' ? planData.maxParticipants : defaults.maxParticipants,
            };
        }

        const resetRecord = configs.find((c) => c.key === 'si_credits_reset');
        const creditsResetAt = (parseSystemConfigValue<any>(resetRecord?.value)?.resetAt as string | null | undefined) ?? null;

        return { ...result, _meta: { creditsResetAt } };
    }

    @Get('public-registration')
    @ApiOperation({ summary: 'Get public registration configuration' })
    async getPublicRegistrationConfig() {
        const record = await this.prisma.systemConfig.findUnique({
            where: { key: PUBLIC_REGISTRATION_CONFIG_KEY },
        });
        const config = normalizePublicRegistrationConfig(parseSystemConfigValue<any>(record?.value));
        const defaultLeague = config.defaultLeagueCode
            ? await this.prisma.league.findUnique({
                where: { code: config.defaultLeagueCode },
                select: { id: true, name: true, code: true, status: true },
            })
            : null;

        return {
            requireParticipationCode: config.requireParticipationCode,
            defaultLeagueCode: defaultLeague?.code ?? config.defaultLeagueCode,
            defaultLeagueName: defaultLeague?.name ?? 'Polla Mundialista 2026',
            defaultLeague: defaultLeague
                ? {
                    id: defaultLeague.id,
                    name: defaultLeague.name,
                    code: defaultLeague.code,
                    status: defaultLeague.status,
                }
                : null,
        };
    }
}
