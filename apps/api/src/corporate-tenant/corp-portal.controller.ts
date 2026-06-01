import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, ForbiddenException, NotFoundException, BadRequestException, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMemberGuard } from './guards/tenant-member.guard';
import { TenantAdminGuard } from './guards/tenant-admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantService } from './tenant.service';
import { UpdateTenantBrandingDto } from './dto/tenant.dto';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsEmail, IsBoolean, IsEnum, IsNumber, Min, Max, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Privacy, LeagueStatus, MemberRole, MemberStatus, ScoringType, Plan, TenantRole } from '@prisma/client';
import { randomBytes } from 'crypto';

class CreateCorpLeagueDto {
    @IsNotEmpty() @IsString() name: string;
    @IsOptional() @IsString() description?: string;
    @IsOptional() @IsEnum(Privacy) privacy?: Privacy;
    @IsOptional() @IsInt() @Min(2) @Max(500) maxParticipants?: number;
    @IsOptional() @IsString() primaryTournamentId?: string;
    @IsOptional() @IsArray() @IsString({ each: true }) matchIds?: string[];
}

class ProvisionMemberDto {
    @IsString() @IsNotEmpty() name: string;
    @IsEmail() email: string;
    @IsOptional() @IsString() username?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() tempPassword?: string;
    @IsOptional() @IsEnum(TenantRole) role?: TenantRole;
    @IsOptional() @IsBoolean() sendEmail?: boolean;
}

class BulkUserRow {
    @IsString() @IsNotEmpty() name: string;
    @IsEmail() email: string;
    @IsOptional() @IsEnum(TenantRole) role?: TenantRole;
}

class BulkProvisionMembersDto {
    @IsArray() @ValidateNested({ each: true }) @Type(() => BulkUserRow) users: BulkUserRow[];
    @IsOptional() @IsString() sharedTempPassword?: string;
    @IsOptional() @IsBoolean() sendEmail?: boolean;
}

class UpdateMemberRoleDto {
    @IsEnum(TenantRole) role: TenantRole;
}

class CorpPredictionDto {
    @IsString() @IsNotEmpty() matchId: string;
    @IsString() @IsNotEmpty() leagueId: string;
    @IsInt() @Min(0) @Max(99) homeScore: number;
    @IsInt() @Min(0) @Max(99) awayScore: number;
}

@Controller('corp')
@UseGuards(JwtAuthGuard, TenantMemberGuard)
export class CorpPortalController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly provisioning: TenantProvisioningService,
        private readonly tenantService: TenantService,
    ) {}

    @UseGuards(TenantAdminGuard)
    @Patch('branding')
    async updateBranding(@Req() req: any, @Body() dto: UpdateTenantBrandingDto) {
        const tenantId: string = req.tenantId;
        return this.tenantService.updateBranding(tenantId, dto);
    }

    @Get('dashboard')
    async getDashboard(@Req() req: any) {
        const tenantId: string = req.tenantId;
        const userId: string = req.user.userId;
        const tenantRole: string = req.tenantRole;

        const [leagueMemberships, tenantLeagues, totalMembers, upcomingMatches] = await Promise.all([
            this.prisma.leagueMember.findMany({
                where: { userId, league: { tenantId }, status: 'ACTIVE' },
                select: { leagueId: true },
            }),
            this.prisma.league.findMany({
                where: { tenantId, status: 'ACTIVE' },
                select: {
                    id: true,
                    name: true,
                    _count: { select: { members: { where: { status: 'ACTIVE' } } } },
                },
                take: 10,
            }),
            this.prisma.tenantMember.count({
                where: { tenantId, status: 'ACTIVE' },
            }),
            this.prisma.match.findMany({
                where: {
                    matchDate: { gt: new Date() },
                    leagueMatches: { some: { league: { tenantId } } },
                },
                select: { id: true },
                take: 50,
            }),
        ]);

        /* Usar ligas propias si existen, si no usar todas las activas del tenant */
        const memberLeagueIds = new Set(leagueMemberships.map((m) => m.leagueId));
        const myLeagues = tenantLeagues.filter((l) => memberLeagueIds.has(l.id));
        const displayLeagues = myLeagues.length > 0 ? myLeagues : tenantLeagues;
        const displayLeagueIds = displayLeagues.map((l) => l.id);

        const upcomingMatchIds = upcomingMatches.map((m) => m.id);
        const predictionsPending = upcomingMatchIds.length
            ? await this.prisma.match.count({
                  where: {
                      id: { in: upcomingMatchIds },
                      predictions: { none: { userId } },
                  },
              })
            : 0;

        const pointsPerLeague = displayLeagueIds.length
            ? await this.prisma.prediction.groupBy({
                  by: ['leagueId'],
                  where: { userId, leagueId: { in: displayLeagueIds } },
                  _sum: { points: true },
              })
            : [];

        const pointsMap = new Map(pointsPerLeague.map((p) => [p.leagueId, p._sum.points ?? 0]));
        const totalPoints = [...pointsMap.values()].reduce((a, b) => a + b, 0);

        const allMemberPoints = await this.prisma.prediction.groupBy({
            by: ['userId'],
            where: { league: { tenantId }, userId: { not: userId } },
            _sum: { points: true },
        });
        const rank = allMemberPoints.filter((m) => (m._sum.points ?? 0) > totalPoints).length + 1;

        return {
            myLeagues: displayLeagues.map((l) => ({
                id: l.id,
                name: l.name,
                participantsCount: l._count.members,
                myPoints: pointsMap.get(l.id) ?? 0,
            })),
            globalRank: rank,
            totalMembers,
            predictionsPending,
            tenantRole,
        };
    }

    @Get('leagues/:id')
    async getLeagueDetail(@Req() req: any, @Param('id') leagueId: string) {
        const tenantId: string = req.tenantId;
        const userId: string = req.user.userId;

        const league = await this.prisma.league.findFirst({
            where: { id: leagueId, tenantId },
            include: {
                _count: { select: { members: { where: { status: 'ACTIVE' } } } },
                scoringRules: { orderBy: { points: 'desc' } },
            },
        });

        if (!league) return null;

        const teamSelect = { id: true, name: true, flagUrl: true, shortCode: true, code: true };

        const [leagueMatchRows, predictionRows, memberPoints] = await Promise.all([
            this.prisma.leagueMatch.findMany({
                where: { leagueId },
                include: {
                    match: {
                        include: {
                            homeTeam: { select: teamSelect },
                            awayTeam: { select: teamSelect },
                            predictions: {
                                where: { userId, leagueId },
                                select: { homeScore: true, awayScore: true, points: true },
                                take: 1,
                            },
                        },
                    },
                },
                orderBy: { match: { matchDate: 'asc' } },
            }),
            this.prisma.prediction.findMany({
                where: { userId, leagueId },
                orderBy: { submittedAt: 'desc' },
                take: 5,
                include: {
                    match: {
                        include: {
                            homeTeam: { select: teamSelect },
                            awayTeam: { select: teamSelect },
                        },
                    },
                },
            }),
            this.prisma.prediction.groupBy({
                by: ['userId'],
                where: { leagueId },
                _sum: { points: true },
                orderBy: { _sum: { points: 'desc' } },
            }),
        ]);

        const userIdsList = memberPoints.map((p) => p.userId);
        const users = await this.prisma.user.findMany({
            where: { id: { in: userIdsList } },
            select: { id: true, name: true, username: true, avatar: true },
        });
        const userMap = new Map(users.map((u) => [u.id, u]));

        const myPoints = memberPoints.find((p) => p.userId === userId)?._sum.points ?? 0;
        const myRank = memberPoints.filter((p) => (p._sum.points ?? 0) > myPoints).length + 1;

        return {
            id: league.id,
            name: league.name,
            description: league.description,
            status: league.status,
            participantsCount: league._count.members,
            maxParticipants: league.maxParticipants,
            closePredictionMinutes: league.closePredictionMinutes,
            myPoints,
            myRank,
            scoringRules: league.scoringRules.map((r) => ({
                ruleType: r.ruleType,
                points: r.points,
                description: r.description,
                multiplier: r.multiplier,
            })),
            upcomingMatches: leagueMatchRows.map((lm) => ({
                id: lm.match.id,
                matchDate: lm.match.matchDate,
                status: lm.match.status,
                homeScore: lm.match.homeScore,
                awayScore: lm.match.awayScore,
                venue: lm.match.venue,
                phase: lm.match.phase,
                homeTeam: lm.match.homeTeam,
                awayTeam: lm.match.awayTeam,
                myPrediction: lm.match.predictions[0] ?? null,
            })),
            recentPredictions: predictionRows.map((p) => ({
                matchDate: p.match.matchDate,
                status: p.match.status,
                homeScore: p.match.homeScore,
                awayScore: p.match.awayScore,
                homeTeam: p.match.homeTeam,
                awayTeam: p.match.awayTeam,
                myHome: p.homeScore,
                myAway: p.awayScore,
                points: p.points,
            })),
            topRanking: memberPoints.map((p, i) => ({
                rank: i + 1,
                userId: p.userId,
                name: userMap.get(p.userId)?.name ?? '—',
                username: userMap.get(p.userId)?.username ?? '',
                avatar: userMap.get(p.userId)?.avatar ?? null,
                totalPoints: p._sum.points ?? 0,
                isMe: p.userId === userId,
            })),
        };
    }

    @Get('leagues')
    async getLeagues(@Req() req: any) {
        const tenantId: string = req.tenantId;
        const userId: string = req.user.userId;

        const leagues = await this.prisma.league.findMany({
            where: { tenantId },
            include: {
                _count: { select: { members: { where: { status: 'ACTIVE' } } } },
                members: {
                    where: { userId, status: 'ACTIVE' },
                    select: { id: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const myLeagueIds = leagues.filter((l) => l.members.length > 0).map((l) => l.id);
        const pointsPerLeague = myLeagueIds.length
            ? await this.prisma.prediction.groupBy({
                  by: ['leagueId'],
                  where: { userId, leagueId: { in: myLeagueIds } },
                  _sum: { points: true },
              })
            : [];
        const pointsMap = new Map(pointsPerLeague.map((p) => [p.leagueId, p._sum.points ?? 0]));

        return leagues.map((l) => ({
            id: l.id,
            name: l.name,
            description: l.description,
            isPublic: l.privacy === 'PUBLIC',
            participantsCount: l._count.members,
            isMember: l.members.length > 0,
            myPoints: pointsMap.get(l.id) ?? 0,
            status: l.status,
            primaryTournamentId: l.primaryTournamentId ?? null,
        }));
    }

    @Get('ranking')
    async getRanking(@Req() req: any) {
        const tenantId: string = req.tenantId;
        const userId: string = req.user.userId;

        const members = await this.prisma.tenantMember.findMany({
            where: { tenantId, status: 'ACTIVE' },
            include: {
                user: { select: { id: true, name: true, username: true, avatar: true } },
            },
        });

        const userIds = members.map((m) => m.userId);

        const scores = await this.prisma.prediction.groupBy({
            by: ['userId'],
            where: {
                userId: { in: userIds },
                league: { tenantId },
            },
            _sum: { points: true },
        });

        const scoreMap = new Map(scores.map((s) => [s.userId, s._sum.points ?? 0]));

        const ranking = members
            .map((m) => ({
                userId: m.userId,
                name: m.user.name,
                username: m.user.username,
                avatar: m.user.avatar,
                totalPoints: scoreMap.get(m.userId) ?? 0,
                isMe: m.userId === userId,
            }))
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .map((u, i) => ({ ...u, rank: i + 1 }));

        return ranking;
    }

    @Get('tournaments')
    async getTournaments() {
        return this.prisma.tournament.findMany({
            where: { matches: { some: {} } },
            orderBy: [{ active: 'desc' }, { season: 'desc' }, { name: 'asc' }],
            select: { id: true, name: true, country: true, season: true, logoUrl: true, active: true },
        });
    }

    @Get('tournaments/:tournamentId/matches')
    async getTournamentMatches(@Param('tournamentId') tournamentId: string) {
        const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
        if (!tournament) throw new NotFoundException('Torneo no encontrado');

        const matches = await this.prisma.match.findMany({
            where: { tournamentId },
            orderBy: [{ matchDate: 'asc' }],
            select: {
                id: true,
                matchNumber: true,
                matchDate: true,
                phase: true,
                group: true,
                venue: true,
                status: true,
                round: true,
                homeTeam: { select: { id: true, name: true, code: true, flagUrl: true } },
                awayTeam: { select: { id: true, name: true, code: true, flagUrl: true } },
            },
        });

        return { tournament, matches, total: matches.length };
    }

    @UseGuards(TenantAdminGuard)
    @Post('leagues')
    async createLeague(@Req() req: any, @Body() dto: CreateCorpLeagueDto) {
        const tenantId: string = req.tenantId;
        const userId: string = req.user.userId;

        const normalizedName = dto.name.trim().replace(/\s+/g, ' ');
        const existing = await this.prisma.league.findFirst({ where: { name: normalizedName }, select: { id: true } });
        if (existing) throw new BadRequestException('Ya existe una polla con ese nombre. Usa un nombre diferente.');

        let code = randomBytes(3).toString('hex').toUpperCase();
        while (await this.prisma.league.findUnique({ where: { code } })) {
            code = randomBytes(3).toString('hex').toUpperCase();
        }

        const DEFAULT_SCORING_RULES = [
            { ruleType: ScoringType.EXACT_SCORE,       points: 5, description: 'Marcador exacto' },
            { ruleType: ScoringType.CORRECT_WINNER,    points: 2, description: 'Ganador / empate correcto' },
            { ruleType: ScoringType.TEAM_GOALS,        points: 1, description: 'Gol acertado (al menos un equipo)' },
            { ruleType: ScoringType.UNIQUE_PREDICTION, points: 5, description: 'Predicción única en la liga' },
            { ruleType: ScoringType.PHASE_BONUS_R32,   points: 0, description: 'Bono clasificados Fase 32' },
            { ruleType: ScoringType.PHASE_BONUS_R16,   points: 8, description: 'Bono clasificados Octavos' },
            { ruleType: ScoringType.PHASE_BONUS_QF,    points: 4, description: 'Bono clasificados Cuartos' },
            { ruleType: ScoringType.PHASE_BONUS_SF,    points: 2, description: 'Bono clasificados Semifinal' },
            { ruleType: ScoringType.PHASE_BONUS_FINAL, points: 5, description: 'Bono Campeón (Final)' },
        ];

        const { primaryTournamentId, ...scalars } = dto;

        const league = await this.prisma.league.create({
            data: {
                ...scalars,
                name: normalizedName,
                code,
                tenantId,
                status: LeagueStatus.SETUP,
                plan: Plan.FREE,
                members: {
                    create: { userId, role: MemberRole.ADMIN, status: MemberStatus.ACTIVE },
                },
                scoringRules: {
                    createMany: { data: [...DEFAULT_SCORING_RULES] },
                },
            },
            include: { members: true, scoringRules: true },
        });

        if (primaryTournamentId) {
            const tournament = await this.prisma.tournament.findUnique({ where: { id: primaryTournamentId } });
            if (tournament) {
                await this.prisma.leagueTournament.create({ data: { leagueId: league.id, tournamentId: primaryTournamentId } }).catch(() => {});
                await this.prisma.league.update({ where: { id: league.id }, data: { primaryTournamentId } }).catch(() => {});
            }
        }

        if (dto.matchIds && dto.matchIds.length > 0) {
            const validMatches = await this.prisma.match.findMany({
                where: { id: { in: dto.matchIds } },
                select: { id: true },
            });
            if (validMatches.length > 0) {
                await this.prisma.leagueMatch.createMany({
                    data: validMatches.map(m => ({ leagueId: league.id, matchId: m.id })),
                    skipDuplicates: true,
                });
            }
        } else if (primaryTournamentId) {
            const tournamentMatches = await this.prisma.match.findMany({
                where: { tournamentId: primaryTournamentId },
                select: { id: true },
            });
            if (tournamentMatches.length > 0) {
                await this.prisma.leagueMatch.createMany({
                    data: tournamentMatches.map(m => ({ leagueId: league.id, matchId: m.id })),
                    skipDuplicates: true,
                });
            }
        }

        return league;
    }

    @UseGuards(TenantAdminGuard)
    @Patch('leagues/:leagueId')
    async updateLeague(
        @Req() req: any,
        @Param('leagueId') leagueId: string,
        @Body() body: { name?: string; description?: string; privacy?: Privacy; maxParticipants?: number; status?: LeagueStatus },
    ) {
        const tenantId: string = req.tenantId;
        const league = await this.prisma.league.findFirst({ where: { id: leagueId, tenantId } });
        if (!league) throw new NotFoundException('Polla no encontrada');

        const data: any = {};
        if (body.name !== undefined) data.name = body.name.trim().replace(/\s+/g, ' ');
        if (body.description !== undefined) data.description = body.description;
        if (body.privacy !== undefined) data.privacy = body.privacy;
        if (body.maxParticipants !== undefined) data.maxParticipants = body.maxParticipants;
        if (body.status !== undefined) data.status = body.status;

        return this.prisma.league.update({ where: { id: leagueId }, data });
    }

    @UseGuards(TenantAdminGuard)
    @HttpCode(HttpStatus.OK)
    @Post('leagues/:leagueId/tournament')
    async setLeagueTournament(
        @Req() req: any,
        @Param('leagueId') leagueId: string,
        @Body('tournamentId') tournamentId: string | null,
    ) {
        const tenantId: string = req.tenantId;
        const league = await this.prisma.league.findFirst({ where: { id: leagueId, tenantId } });
        if (!league) throw new NotFoundException('Polla no encontrada');

        if (tournamentId) {
            const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
            if (!tournament) throw new NotFoundException('Torneo no encontrado');
            await this.prisma.leagueTournament.upsert({
                where: { leagueId_tournamentId: { leagueId, tournamentId } },
                create: { leagueId, tournamentId },
                update: {},
            });
            await this.prisma.league.update({ where: { id: leagueId }, data: { primaryTournamentId: tournamentId } }).catch(() => {});
            const tournamentMatches = await this.prisma.match.findMany({
                where: { tournamentId },
                select: { id: true },
            });
            if (tournamentMatches.length > 0) {
                await this.prisma.leagueMatch.createMany({
                    data: tournamentMatches.map(m => ({ leagueId, matchId: m.id })),
                    skipDuplicates: true,
                });
            }
        } else {
            await this.prisma.league.update({ where: { id: leagueId }, data: { primaryTournamentId: null } }).catch(() => {});
        }

        return { ok: true };
    }

    @UseGuards(TenantAdminGuard)
    @HttpCode(HttpStatus.OK)
    @Post('leagues/:leagueId/sync-tournament-matches')
    async syncTournamentMatches(@Req() req: any, @Param('leagueId') leagueId: string) {
        const tenantId: string = req.tenantId;
        const league = await this.prisma.league.findFirst({
            where: { id: leagueId, tenantId },
            select: { id: true, primaryTournamentId: true },
        });
        if (!league) throw new NotFoundException('Polla no encontrada');
        if (!league.primaryTournamentId) throw new BadRequestException('La polla no tiene un torneo asignado');

        const matches = await this.prisma.match.findMany({
            where: { tournamentId: league.primaryTournamentId },
            select: { id: true },
        });
        if (matches.length === 0) throw new BadRequestException('El torneo no tiene partidos registrados');

        await this.prisma.leagueMatch.deleteMany({ where: { leagueId } });
        await this.prisma.leagueMatch.createMany({
            data: matches.map(m => ({ leagueId, matchId: m.id })),
            skipDuplicates: true,
        });
        return { ok: true, count: matches.length };
    }

    @UseGuards(TenantAdminGuard)
    @Get('leagues/:leagueId/match-ids')
    async getLeagueMatchIds(@Req() req: any, @Param('leagueId') leagueId: string) {
        const tenantId: string = req.tenantId;
        const league = await this.prisma.league.findFirst({ where: { id: leagueId, tenantId } });
        if (!league) throw new NotFoundException('Polla no encontrada');
        const rows = await this.prisma.leagueMatch.findMany({
            where: { leagueId },
            select: { matchId: true },
        });
        return { matchIds: rows.map(r => r.matchId) };
    }

    @UseGuards(TenantAdminGuard)
    @HttpCode(HttpStatus.OK)
    @Post('leagues/:leagueId/matches')
    async setLeagueMatches(
        @Req() req: any,
        @Param('leagueId') leagueId: string,
        @Body('matchIds') matchIds: string[],
    ) {
        const tenantId: string = req.tenantId;
        const league = await this.prisma.league.findFirst({ where: { id: leagueId, tenantId } });
        if (!league) throw new NotFoundException('Polla no encontrada');
        if (!Array.isArray(matchIds)) throw new BadRequestException('matchIds debe ser un array');

        await this.prisma.leagueMatch.deleteMany({ where: { leagueId } });
        if (matchIds.length > 0) {
            const validMatches = await this.prisma.match.findMany({
                where: { id: { in: matchIds } },
                select: { id: true },
            });
            if (validMatches.length > 0) {
                await this.prisma.leagueMatch.createMany({
                    data: validMatches.map(m => ({ leagueId, matchId: m.id })),
                    skipDuplicates: true,
                });
            }
        }
        return { ok: true, count: matchIds.length };
    }

    @UseGuards(TenantAdminGuard)
    @HttpCode(HttpStatus.OK)
    @Delete('leagues/:leagueId')
    async deleteLeague(@Req() req: any, @Param('leagueId') leagueId: string) {
        const tenantId: string = req.tenantId;
        const league = await this.prisma.league.findFirst({ where: { id: leagueId, tenantId } });
        if (!league) throw new NotFoundException('Polla no encontrada');

        const hasPredictions = await this.prisma.prediction.count({ where: { leagueId } });
        if (hasPredictions > 0) {
            throw new BadRequestException('No se puede eliminar una polla que ya tiene pronósticos registrados.');
        }

        await this.prisma.league.delete({ where: { id: leagueId } });
        return { ok: true };
    }

    @Get('members')
    async getMembers(@Req() req: any) {
        const tenantId: string = req.tenantId;
        const tenantRole: string = req.tenantRole;

        if (!['OWNER', 'ADMIN'].includes(tenantRole)) {
            return [];
        }

        const members = await this.prisma.tenantMember.findMany({
            where: { tenantId },
            include: {
                user: { select: { id: true, name: true, email: true, username: true, avatar: true, mustChangePassword: true, emailVerified: true, createdAt: true } },
            },
            orderBy: { invitedAt: 'asc' },
        });

        return members.map((m) => ({
            id: m.id,
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            username: m.user.username,
            avatar: m.user.avatar,
            mustChangePassword: m.user.mustChangePassword,
            emailVerified: m.user.emailVerified,
            role: m.role,
            status: m.status,
            joinedAt: m.joinedAt ?? m.invitedAt,
            createdAt: m.user.createdAt,
        }));
    }

    @UseGuards(TenantAdminGuard)
    @Post('members')
    async createMember(@Req() req: any, @Body() dto: ProvisionMemberDto) {
        const tenantId: string = req.tenantId;
        return this.provisioning.provisionOwner(tenantId, {
            name: dto.name,
            email: dto.email,
            username: dto.username,
            phone: dto.phone,
            tempPassword: dto.tempPassword,
            role: dto.role ?? TenantRole.PLAYER,
            sendEmail: dto.sendEmail !== false,
        });
    }

    @UseGuards(TenantAdminGuard)
    @Post('members/bulk')
    async bulkCreateMembers(@Req() req: any, @Body() dto: BulkProvisionMembersDto) {
        const tenantId: string = req.tenantId;
        const results: any[] = [];
        for (const user of dto.users) {
            try {
                const result = await this.provisioning.provisionOwner(tenantId, {
                    name: user.name,
                    email: user.email,
                    role: user.role ?? TenantRole.PLAYER,
                    tempPassword: dto.sharedTempPassword,
                    sendEmail: dto.sendEmail !== false,
                });
                results.push({ email: user.email, ok: true, isNewUser: result.isNewUser });
            } catch (e: any) {
                results.push({ email: user.email, ok: false, error: e?.message ?? 'Error desconocido' });
            }
        }
        const successful = results.filter(r => r.ok).length;
        return { total: dto.users.length, successful, failed: dto.users.length - successful, results };
    }

    @UseGuards(TenantAdminGuard)
    @Patch('members/:memberId')
    async updateMember(@Req() req: any, @Param('memberId') memberId: string, @Body() dto: UpdateMemberRoleDto) {
        const tenantId: string = req.tenantId;
        const member = await this.prisma.tenantMember.findFirst({ where: { id: memberId, tenantId } });
        if (!member) throw new NotFoundException('Miembro no encontrado');
        await this.prisma.tenantMember.update({ where: { id: memberId }, data: { role: dto.role } });
        return { ok: true };
    }

    @UseGuards(TenantAdminGuard)
    @HttpCode(HttpStatus.OK)
    @Delete('members/:memberId')
    async removeMember(@Req() req: any, @Param('memberId') memberId: string) {
        const tenantId: string = req.tenantId;
        const member = await this.prisma.tenantMember.findFirst({
            where: { id: memberId, tenantId },
            include: { user: { select: { id: true } } },
        });
        if (!member) throw new NotFoundException('Miembro no encontrado');
        await this.prisma.tenantMember.update({
            where: { id: memberId },
            data: { status: 'INACTIVE' },
        });
        return { ok: true };
    }

    @UseGuards(TenantAdminGuard)
    @HttpCode(HttpStatus.OK)
    @Post('members/sync-leagues')
    async syncMembersToLeagues(@Req() req: any) {
        const tenantId: string = req.tenantId;

        const [activeMembers, activeLeagues] = await Promise.all([
            this.prisma.tenantMember.findMany({
                where: { tenantId, status: 'ACTIVE' },
                select: { userId: true },
            }),
            this.prisma.league.findMany({
                where: { tenantId, status: 'ACTIVE' },
                select: { id: true },
            }),
        ]);

        if (!activeLeagues.length) return { synced: 0, message: 'No hay pollas activas' };

        let synced = 0;
        for (const member of activeMembers) {
            for (const league of activeLeagues) {
                await this.prisma.leagueMember.upsert({
                    where: { userId_leagueId: { userId: member.userId, leagueId: league.id } },
                    create: { leagueId: league.id, userId: member.userId, role: 'PLAYER', status: 'ACTIVE', joinedAt: new Date() },
                    update: { status: 'ACTIVE' },
                });
                synced++;
            }
        }

        return { synced, members: activeMembers.length, leagues: activeLeagues.length };
    }

    @Post('predictions')
    async upsertPrediction(@Req() req: any, @Body() dto: CorpPredictionDto) {
        const tenantId: string = req.tenantId;
        const userId: string = req.user.userId;
        const { matchId, leagueId, homeScore, awayScore } = dto;

        // Verificar que la polla pertenece al tenant
        const league = await this.prisma.league.findFirst({
            where: { id: leagueId, tenantId },
        });
        if (!league) throw new NotFoundException('Polla no encontrada en este tenant');

        // Verificar que el partido está activo en la polla
        const leagueMatch = await this.prisma.leagueMatch.findUnique({
            where: { leagueId_matchId: { leagueId, matchId } },
        });
        if (!leagueMatch || !leagueMatch.active) {
            throw new BadRequestException('Este partido no está disponible para pronósticos');
        }

        // Validar tiempo de cierre
        const match = await this.prisma.match.findUnique({ where: { id: matchId } });
        if (!match) throw new NotFoundException('Partido no encontrado');
        const now = new Date();
        const closingTime = new Date(new Date(match.matchDate).getTime() - league.closePredictionMinutes * 60000);
        if (now > closingTime) {
            throw new BadRequestException('El tiempo para realizar predicciones ha expirado');
        }

        // Auto-enrolar al usuario como LeagueMember ACTIVE si no existe
        await this.prisma.leagueMember.upsert({
            where: { userId_leagueId: { userId, leagueId } },
            create: { leagueId, userId, role: 'PLAYER', status: 'ACTIVE', joinedAt: now },
            update: { status: 'ACTIVE' },
        });

        // Guardar pronóstico
        const prediction = await this.prisma.prediction.upsert({
            where: { userId_matchId_leagueId: { userId, matchId, leagueId } },
            update: { homeScore, awayScore, submittedAt: now },
            create: { userId, matchId, leagueId, homeScore, awayScore, submittedAt: now },
        });

        return { ok: true, id: prediction.id };
    }

    @UseGuards(TenantAdminGuard)
    @HttpCode(HttpStatus.OK)
    @Post('members/:memberId/resend-credentials')
    async resendMemberCredentials(@Req() req: any, @Param('memberId') memberId: string) {
        const tenantId: string = req.tenantId;
        const member = await this.prisma.tenantMember.findFirst({
            where: { id: memberId, tenantId },
            include: { user: { select: { email: true } } },
        });
        if (!member) throw new NotFoundException('Miembro no encontrado');
        return this.provisioning.resendCredentials(tenantId, { email: member.user.email });
    }
}
