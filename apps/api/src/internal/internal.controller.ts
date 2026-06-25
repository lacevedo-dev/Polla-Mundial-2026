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
            where.matchDate = {};
            if (from) where.matchDate.gte = new Date(from);
            if (to) where.matchDate.lte = new Date(to);
        }
        if (tournamentId) where.tournamentId = tournamentId;

        return this.prisma.match.findMany({
            where,
            include: {
                homeTeam: { select: { id: true, name: true, code: true, flagUrl: true } },
                awayTeam: { select: { id: true, name: true, code: true, flagUrl: true } },
            },
            orderBy: { matchDate: 'asc' },
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
            select: {
                id: true,
                name: true,
                code: true,
                group: true,
                flagUrl: true,
                shortCode: true,
                apiFootballTeamId: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    // ── Sincronización de usuarios ────────────────────────────────────────────


    @Get('corp-bootstrap')
    async getCorpBootstrap(@Headers('x-internal-api-key') apiKey: string) {
        this.assertApiKey(apiKey);

        const userSelect = {
            id: true,
            name: true,
            email: true,
            username: true,
            documentNumber: true,
            phone: true,
            countryCode: true,
            avatar: true,
            birthDate: true,
            passwordHash: true,
            mustChangePassword: true,
            emailVerified: true,
            status: true,
        };

        return this.prisma.corporateTenant.findMany({
            include: {
                branding: true,
                config: true,
                members: {
                    include: {
                        user: { select: userSelect },
                    },
                },
                leagues: {
                    include: {
                        members: {
                            include: {
                                user: { select: userSelect },
                            },
                        },
                        leagueTournaments: true,
                        leagueMatches: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        } as any);
    }

    @Get('corp-admin-users')
    async getCorpAdminUsers(@Headers('x-internal-api-key') apiKey: string) {
        this.assertApiKey(apiKey);
        const members = await this.prisma.tenantMember.findMany({
            where: {
                role: { in: ['OWNER', 'ADMIN', 'STAFF'] },
                status: 'ACTIVE',
                user: { status: 'ACTIVE' },
            } as any,
            include: {
                tenant: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        legalName: true,
                        contactEmail: true,
                        status: true,
                        planTier: true,
                        allowedDomains: true,
                        customDomain: true,
                        ssoEnabled: true,
                        ssoProvider: true,
                        ssoConfig: true,
                        maxUsers: true,
                        maxLeagues: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        username: true,
                        documentNumber: true,
                        phone: true,
                        countryCode: true,
                        avatar: true,
                        birthDate: true,
                        passwordHash: true,
                        mustChangePassword: true,
                        emailVerified: true,
                        status: true,
                    },
                },
            },
        });

        return members.map((member) => ({
            tenant: member.tenant,
            membership: {
                id: member.id,
                tenantId: member.tenantId,
                userId: member.userId,
                role: member.role,
                status: member.status,
                invitedAt: member.invitedAt,
                joinedAt: member.joinedAt,
            },
            user: member.user,
        }));
    }

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

    // ── LeagueMatch ───────────────────────────────────────────────────────────

    @Get('league-matches')
    async getLeagueMatches(
        @Headers('x-internal-api-key') apiKey: string,
        @Query('matchIds') matchIds?: string,
    ) {
        this.assertApiKey(apiKey);
        const where: any = {};
        if (matchIds) {
            const ids = matchIds.split(',').map((id) => id.trim()).filter(Boolean);
            if (ids.length > 0) where.matchId = { in: ids };
        }
        return this.prisma.leagueMatch.findMany({
            where,
            orderBy: { addedAt: 'asc' },
            take: 2000,
        });
    }

    // ── Status ────────────────────────────────────────────────────────────────

    @Get('status')
    async status(@Headers('x-internal-api-key') apiKey: string) {
        this.assertApiKey(apiKey);
        return { ok: true, service: 'api-main', timestamp: new Date().toISOString() };
    }
}
