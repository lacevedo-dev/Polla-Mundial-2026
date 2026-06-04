import {
    Controller, Get, Post, Body, Query,
    UnauthorizedException, Headers,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Endpoints exclusivos para comunicación interna entre servicios.
 * Protegidos con INTERNAL_API_KEY (header x-internal-api-key).
 * NUNCA exponer estas rutas en Swagger público.
 */
@Controller('internal')
export class InternalController {
    constructor(private readonly prisma: PrismaService) {}

    private assertApiKey(key: string | undefined): void {
        const expected = process.env.INTERNAL_API_KEY?.trim();
        if (!expected) throw new UnauthorizedException('INTERNAL_API_KEY no configurada en servidor principal');
        if (key !== expected) throw new UnauthorizedException('API key interna inválida');
    }

    // ── Partidos ──────────────────────────────────────────────────────────────

    @Get('matches')
    async getMatches(
        @Headers('x-internal-api-key') apiKey: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('tournamentId') tournamentId?: string,
    ) {
        this.assertApiKey(apiKey);
        const where: any = {};
        if (from || to) {
            where.date = {};
            if (from) where.date.gte = new Date(from);
            if (to) where.date.lte = new Date(to);
        }
        if (tournamentId) where.tournamentId = tournamentId;

        return this.prisma.match.findMany({
            where,
            select: {
                id: true,
                tournamentId: true,
                homeTeamId: true,
                awayTeamId: true,
                date: true,
                venue: true,
                round: true,
                stage: true,
                homeScore: true,
                awayScore: true,
                status: true,
                externalId: true,
            },
            orderBy: { date: 'asc' },
            take: 500,
        });
    }

    // ── Torneos ───────────────────────────────────────────────────────────────

    @Get('tournaments')
    async getTournaments(@Headers('x-internal-api-key') apiKey: string) {
        this.assertApiKey(apiKey);
        return this.prisma.tournament.findMany({
            orderBy: { name: 'asc' },
        });
    }

    // ── Equipos ───────────────────────────────────────────────────────────────

    @Get('teams')
    async getTeams(@Headers('x-internal-api-key') apiKey: string) {
        this.assertApiKey(apiKey);
        return this.prisma.team.findMany({
            select: { id: true, name: true, code: true, logo: true, country: true, externalId: true },
            orderBy: { name: 'asc' },
        });
    }

    // ── Sincronización de usuarios ────────────────────────────────────────────

    @Post('users/sync')
    async syncUser(
        @Headers('x-internal-api-key') apiKey: string,
        @Body() body: { id: string; email: string; name: string; passwordHash: string },
    ) {
        this.assertApiKey(apiKey);
        const existing = await this.prisma.user.findUnique({ where: { id: body.id } });
        if (existing) {
            return { ok: true, action: 'existing', userId: existing.id };
        }
        const user = await this.prisma.user.create({
            data: {
                id: body.id,
                email: body.email,
                name: body.name,
                username: body.email.split('@')[0],
                passwordHash: body.passwordHash,
                emailVerified: true,
            },
        });
        return { ok: true, action: 'created', userId: user.id };
    }

    // ── Status ────────────────────────────────────────────────────────────────

    @Get('status')
    async status(@Headers('x-internal-api-key') apiKey: string) {
        this.assertApiKey(apiKey);
        return { ok: true, service: 'api-main', timestamp: new Date().toISOString() };
    }
}
