/**
 * Controlador /corp/* del backend principal (apps/api).
 * api-corp usa una copia en src/overrides/ vía webpack; mantener ambos alineados.
 */
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, ForbiddenException, NotFoundException, BadRequestException, HttpCode, HttpStatus, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMemberGuard } from './guards/tenant-member.guard';
import { TenantAdminGuard } from './guards/tenant-admin.guard';
import { TenantStaffGuard } from './guards/tenant-staff.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantService } from './tenant.service';
import { UpdateTenantBrandingDto } from './dto/tenant.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { BrandingStorageService, BrandingUploadFile } from './branding-storage.service';
import { ParticipationService, ParticipationMemberFilter } from './participation.service';
import { MatchOperationsService } from './match-operations.service';
import { CorpRankingService } from './corp-ranking.service';
import { PredictionsService } from '../predictions/predictions.service';
import { CORP_DEFAULT_SCORING_RULES, CORP_PHASE_BONUS_HELP } from './corp-scoring-defaults';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsEmail, IsBoolean, IsEnum, IsNumber, Min, Max, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Privacy, LeagueStatus, MemberRole, MemberStatus, ScoringType, Plan, TenantRole, TenantMemberStatus, MatchStatus } from '@prisma/client';
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
    @IsOptional() @IsString() documentNumber?: string;
    @IsOptional() @IsString() username?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() tempPassword?: string;
    @IsOptional() @IsEnum(TenantRole) role?: TenantRole;
    @IsOptional() @IsBoolean() sendEmail?: boolean;
}

class BulkUserRow {
    @IsString() @IsNotEmpty() documentNumber: string;
    @IsString() @IsNotEmpty() name: string;
    @IsEmail() email: string;
    @IsOptional() @IsEnum(TenantRole) role?: TenantRole;
    @IsOptional() @IsString() tempPassword?: string;
}

class BulkProvisionMembersDto {
    @IsArray() @ValidateNested({ each: true }) @Type(() => BulkUserRow) users: BulkUserRow[];
    @IsOptional() @IsString() sharedTempPassword?: string;
    @IsOptional() @IsBoolean() sendEmail?: boolean;
}

class UpdateCorpConfigDto {
    @IsOptional() @IsBoolean() enablePayments?: boolean;
    @IsOptional() @IsBoolean() enableAiInsights?: boolean;
    @IsOptional() @IsBoolean() enablePublicLeagues?: boolean;
    @IsOptional() @IsBoolean() enableUserSelfRegister?: boolean;
    @IsOptional() @IsBoolean() requireInvitation?: boolean;
    @IsOptional() @IsBoolean() enableEmailNotif?: boolean;
    @IsOptional() @IsBoolean() enablePushNotif?: boolean;
    @IsOptional() @IsBoolean() enableStageFees?: boolean;
}

class CorpPredictionDto {
    @IsString() @IsNotEmpty() matchId: string;
    @IsString() @IsNotEmpty() leagueId: string;
    @IsInt() @Min(0) @Max(99) homeScore: number;
    @IsInt() @Min(0) @Max(99) awayScore: number;
    @IsOptional() @IsString() advanceTeamId?: string;
}

@Controller('corp')
@UseGuards(JwtAuthGuard, TenantMemberGuard)
export class CorpPortalController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly provisioning: TenantProvisioningService,
        private readonly tenantService: TenantService,
        private readonly brandingStorage: BrandingStorageService,
        private readonly participationService: ParticipationService,
        private readonly matchOperations: MatchOperationsService,
        private readonly corpRanking: CorpRankingService,
        private readonly predictionsService: PredictionsService,
    ) {}

    @UseGuards(TenantAdminGuard)
    @Patch('branding')
    async updateBranding(@Req() req: any, @Body() dto: UpdateTenantBrandingDto) {
        const tenantId: string = req.tenantId;
        return this.tenantService.updateBranding(tenantId, dto);
    }

    @UseGuards(TenantAdminGuard)
    @Post('branding/upload-image')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            fileFilter: (_req, file, cb) => {
                const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
                if (!allowed.includes(file.mimetype)) {
                    return cb(new BadRequestException('Solo se permiten imágenes (JPG, PNG, WebP, GIF, SVG, ICO).'), false);
                }
                return cb(null, true);
            },
            limits: { fileSize: 5 * 1024 * 1024 },
        }),
    )
    async uploadBrandingImage(
        @Req() _req: any,
        @UploadedFile() file?: BrandingUploadFile,
    ) {
        if (!file) {
            throw new BadRequestException('No se recibió ningún archivo.');
        }
        const url = await this.brandingStorage.save(file);
        return { url };
    }

    @Get('help/scoring-guide')
    getScoringGuide() {
        return {
            scoringRules: [...CORP_DEFAULT_SCORING_RULES],
            phaseBonuses: [...CORP_PHASE_BONUS_HELP],
            knockoutAdvance: {
                title: 'Clasifica en eliminatorias',
                summary:
                    'En octavos, cuartos, semifinal y final indicas qué equipo pasa (en empate, manualmente). '
                    + 'Eso solo influye en el bono clasificados por fase. '
                    + 'Los puntos del marcador se calculan aparte: en eliminatorias sumas tus aciertos (marcador, ganador, gol) '
                    + 'y multiplicas esa base × 1.5 — primero sumas, luego multiplicas. Ej: (2+1)=3 × 1.5 = 4.5 pts.',
            },
        };
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
                    leagueMatches: { some: { active: true, league: { tenantId } } },
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

        const [leagueMatchRows, predictionRows, rankingSnapshot] = await Promise.all([
            this.prisma.leagueMatch.findMany({
                where: { leagueId, active: true },
                include: {
                    match: {
                        include: {
                            homeTeam: { select: teamSelect },
                            awayTeam: { select: teamSelect },
                            predictions: {
                                where: { userId, leagueId },
                                select: { homeScore: true, awayScore: true, points: true, advanceTeamId: true },
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
            this.corpRanking.getLeagueRankingSnapshot(leagueId, userId),
        ]);

        const { entries: topRanking, myPoints, myRank } = rankingSnapshot;

        return {
            id: league.id,
            name: league.name,
            description: league.description,
            status: league.status,
            participantsCount: league._count.members,
            maxParticipants: league.maxParticipants,
            closePredictionMinutes: league.closePredictionMinutes,
            myPoints,
            myRank: myRank ?? 0,
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
                advancingTeamId: lm.match.advancingTeamId,
                venue: lm.match.venue,
                phase: lm.match.phase,
                group: lm.match.group,
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
            topRanking,
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
            maxParticipants: l.maxParticipants,
        }));
    }

    @Get('ranking/users/:userId')
    async getRankingUserBreakdown(
        @Req() req: any,
        @Param('userId') targetUserId: string,
        @Query('category') category?: string,
    ) {
        return this.corpRanking.getUserBreakdown(req.tenantId, targetUserId, category);
    }

    @Get('phase-bonus-progress')
    async getPhaseBonusProgress(@Req() req: any) {
        const league = await this.corpRanking.resolveActiveLeague(req.tenantId);
        if (!league) {
            throw new NotFoundException('No hay polla activa para este tenant');
        }
        return this.predictionsService.getPhaseBonusProgress(league.id, req.user.userId);
    }

    @Get('ranking')
    async getRanking(@Req() req: any, @Query('category') category?: string) {
        return this.corpRanking.getRankingPayload(req.tenantId, req.user.userId, category);
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

        const DEFAULT_SCORING_RULES = CORP_DEFAULT_SCORING_RULES.map(({ ruleType, points, description }) => ({
            ruleType,
            points,
            description,
        }));

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

        // Solo agrega partidos nuevos; no borra ni reactiva los desactivados.
        const result = await this.prisma.leagueMatch.createMany({
            data: matches.map(m => ({ leagueId, matchId: m.id, active: false })),
            skipDuplicates: true,
        });
        return { ok: true, count: result.count };
    }

    @UseGuards(TenantAdminGuard)
    @Get('leagues/:leagueId/match-ids')
    async getLeagueMatchIds(@Req() req: any, @Param('leagueId') leagueId: string) {
        const tenantId: string = req.tenantId;
        const league = await this.prisma.league.findFirst({ where: { id: leagueId, tenantId } });
        if (!league) throw new NotFoundException('Polla no encontrada');
        const rows = await this.prisma.leagueMatch.findMany({
            where: { leagueId, active: true },
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

        const validMatches = matchIds.length > 0
            ? await this.prisma.match.findMany({
                where: { id: { in: matchIds } },
                select: { id: true },
            })
            : [];
        const validMatchIds = validMatches.map(m => m.id);

        if (validMatchIds.length > 0) {
            await this.prisma.leagueMatch.createMany({
                data: validMatchIds.map(matchId => ({ leagueId, matchId })),
                skipDuplicates: true,
            });
            await this.prisma.leagueMatch.updateMany({
                where: { leagueId, matchId: { in: validMatchIds } },
                data: { active: true },
            });
        }

        await this.prisma.leagueMatch.updateMany({
            where: {
                leagueId,
                ...(validMatchIds.length > 0 ? { matchId: { notIn: validMatchIds } } : {}),
            },
            data: { active: false },
        });

        return { ok: true, count: validMatchIds.length };
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
            throw new BadRequestException('No se puede eliminar una polla que ya tiene pronÃ³sticos registrados.');
        }

        await this.prisma.league.delete({ where: { id: leagueId } });
        return { ok: true };
    }

    @Get('members/stats')
    async getMemberStats(@Req() req: any) {
        const tenantId: string = req.tenantId;
        const tenantRole: string = req.tenantRole;

        if (!['OWNER', 'ADMIN', 'STAFF'].includes(tenantRole)) {
            return { totalActive: 0, roleCounts: {} };
        }

        return this.tenantService.getMembersRoleStats(tenantId);
    }

    @UseGuards(TenantAdminGuard)
    @Get('participation/members')
    async getParticipationMembers(
        @Req() req: any,
        @Query('page') pageStr?: string,
        @Query('limit') limitStr?: string,
        @Query('search') search?: string,
        @Query('leagueId') leagueId?: string,
        @Query('filter') filter?: string,
        @Query('role') role?: string,
    ) {
        const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
        const limit = Math.min(100, Math.max(10, parseInt(limitStr ?? '50', 10) || 50));
        const validFilters: ParticipationMemberFilter[] = [
            'all', 'enrolled', 'with_predictions', 'without_predictions', 'pending',
        ];
        const roleFilter = role && Object.values(TenantRole).includes(role as TenantRole)
            ? (role as TenantRole)
            : undefined;

        return this.participationService.getMembersParticipation(req.tenantId, {
            page,
            limit,
            search,
            leagueId,
            filter: validFilters.includes(filter as ParticipationMemberFilter)
                ? (filter as ParticipationMemberFilter)
                : 'all',
            role: roleFilter,
        });
    }

    @UseGuards(TenantAdminGuard)
    @Get('participation')
    async getParticipation(@Req() req: any, @Query('leagueId') leagueId?: string) {
        return this.participationService.getOverview(req.tenantId, leagueId);
    }

    @Get('members')
    async getMembers(
        @Req() req: any,
        @Query('page') pageStr?: string,
        @Query('limit') limitStr?: string,
        @Query('search') search?: string,
        @Query('role') role?: string,
        @Query('includeStats') includeStatsStr?: string,
    ) {
        const tenantId: string = req.tenantId;
        const tenantRole: string = req.tenantRole;

        if (!['OWNER', 'ADMIN', 'STAFF'].includes(tenantRole)) {
            return { data: [], total: 0, totalActive: 0, page: 1, limit: 50, roleCounts: {} };
        }

        const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
        const limit = Math.min(200, Math.max(10, parseInt(limitStr ?? '50', 10) || 50));
        const searchTrim = search?.trim() ?? '';
        const includeStats = includeStatsStr === 'true' || includeStatsStr === '1';
        const roleFilter = role && Object.values(TenantRole).includes(role as TenantRole)
            ? (role as TenantRole)
            : undefined;

        const { members, total, totalExact, hasMore } = await this.tenantService.listMembersPaginated({
            tenantId,
            page,
            limit,
            search: searchTrim || undefined,
            role: roleFilter,
        });

        let totalActive = 0;
        let roleCounts: Record<string, number> = {};
        if (includeStats) {
            const stats = await this.tenantService.getMembersRoleStats(tenantId);
            totalActive = stats.totalActive;
            roleCounts = stats.roleCounts;
        }

        return {
            data: members.map((m) => ({
                id: m.id,
                userId: m.userId,
                name: m.user.name,
                email: m.user.email,
                username: m.user.documentNumber ?? m.user.username,
                avatar: m.user.avatar,
                mustChangePassword: m.user.mustChangePassword,
                emailVerified: m.user.emailVerified,
                role: m.role,
                status: m.status,
                joinedAt: m.joinedAt ?? m.invitedAt,
                createdAt: m.user.createdAt,
            })),
            total,
            totalExact,
            totalActive,
            page,
            limit,
            hasMore,
            roleCounts,
        };
    }

    @UseGuards(TenantStaffGuard)
    @Post('members')
    async createMember(@Req() req: any, @Body() dto: ProvisionMemberDto) {
        const tenantId: string = req.tenantId;
        const callerRole: string = req.tenantRole;
        if (callerRole === 'STAFF' && dto.role && ['OWNER', 'ADMIN', 'STAFF'].includes(dto.role)) {
            throw new ForbiddenException('El rol Usuario solo puede asignar el rol Jugador');
        }
        try {
            const result = await this.provisioning.provisionOwner(tenantId, {
                name: dto.name,
                email: dto.email,
                documentNumber: dto.documentNumber,
                username: dto.documentNumber ?? dto.username,
                phone: dto.phone,
                tempPassword: dto.tempPassword,
                role: dto.role ?? TenantRole.PLAYER,
                sendEmail: dto.sendEmail !== false,
            });
            this.tenantService.invalidateMembersStatsCache(tenantId);
            return result;
        } catch (err: any) {
            const msg: string = err?.message ?? 'Error desconocido';
            const isHttp = err?.status && err?.response;
            if (isHttp) throw err;
            console.error('[createMember] Error no manejado:', err);
            throw new BadRequestException(`Error al crear usuario: ${msg}`);
        }
    }

    @UseGuards(TenantStaffGuard)
    @Post('members/bulk')
    async bulkCreateMembers(@Req() req: any, @Body() dto: BulkProvisionMembersDto) {
        const tenantId: string = req.tenantId;
        const results: any[] = [];
        for (const user of dto.users) {
            try {
                const result = await this.provisioning.provisionOwner(tenantId, {
                    name: user.name,
                    email: user.email,
                    documentNumber: user.documentNumber,
                    username: user.documentNumber,
                    role: user.role ?? TenantRole.PLAYER,
                    tempPassword: user.tempPassword || dto.sharedTempPassword,
                    sendEmail: dto.sendEmail !== false,
                });
                results.push({ email: user.email, ok: true, isNewUser: result.isNewUser, tempPassword: result.tempPassword });
            } catch (e: any) {
                results.push({ email: user.email, ok: false, error: e?.message ?? 'Error desconocido' });
            }
        }
        const successful = results.filter(r => r.ok).length;
        if (successful > 0) this.tenantService.invalidateMembersStatsCache(tenantId);
        return { total: dto.users.length, successful, failed: dto.users.length - successful, results };
    }

    @UseGuards(TenantStaffGuard)
    @Patch('members/:memberId')
    async updateMember(@Req() req: any, @Param('memberId') memberId: string, @Body() dto: UpdateMemberDto) {
        const tenantId: string = req.tenantId;
        const callerRole: string = req.tenantRole;
        const member = await this.prisma.tenantMember.findFirst({
            where: { id: memberId, tenantId },
            include: { user: { select: { id: true } } },
        });
        if (!member) throw new NotFoundException('Miembro no encontrado');
        if (callerRole === 'STAFF' && dto.role && ['OWNER', 'ADMIN', 'STAFF'].includes(dto.role)) {
            throw new ForbiddenException('El rol Usuario solo puede asignar el rol Jugador');
        }

        const memberData: Partial<{ role: TenantRole; status: TenantMemberStatus }> = {};
        if (dto.role !== undefined) memberData.role = dto.role;
        if (dto.status !== undefined) memberData.status = dto.status;

        const userData: any = {};
        if (dto.name !== undefined) userData.name = dto.name.trim();
        if (dto.email !== undefined) {
            userData.email = dto.email.toLowerCase().trim();
        }
        if (dto.documentNumber !== undefined) {
            const doc = dto.documentNumber.trim().replace(/\D/g, '');
            const existingDoc = await this.prisma.user.findFirst({
                where: { documentNumber: doc, id: { not: member.userId } },
                select: { id: true },
            });
            if (existingDoc) throw new BadRequestException('Ya existe otro usuario con ese número de documento');
            userData.documentNumber = doc || null;
        }
        if (dto.tempPassword?.trim()) {
            const bcrypt = await import('bcrypt');
            userData.passwordHash = await bcrypt.hash(dto.tempPassword.trim(), 10);
            userData.mustChangePassword = true;
        }

        await this.prisma.$transaction(async (tx) => {
            if (Object.keys(memberData).length) {
                await tx.tenantMember.update({ where: { id: memberId }, data: memberData });
            }
            if (Object.keys(userData).length) {
                await tx.user.update({ where: { id: member.userId }, data: userData });
            }
        });

        if (memberData.role !== undefined || memberData.status !== undefined) {
            this.tenantService.invalidateMembersStatsCache(tenantId);
        }

        return { ok: true };
    }

    @UseGuards(TenantStaffGuard)
    @HttpCode(HttpStatus.OK)
    @Delete('members/:memberId')
    async removeMember(@Req() req: any, @Param('memberId') memberId: string) {
        const tenantId: string = req.tenantId;
        const member = await this.prisma.tenantMember.findFirst({
            where: { id: memberId, tenantId },
        });
        if (!member) throw new NotFoundException('Miembro no encontrado');
        await this.prisma.tenantMember.delete({ where: { id: memberId } });
        this.tenantService.invalidateMembersStatsCache(tenantId);
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
        const { matchId, leagueId, homeScore, awayScore, advanceTeamId } = dto;

        // Verificar que la polla pertenece al tenant
        const league = await this.prisma.league.findFirst({
            where: { id: leagueId, tenantId },
        });
        if (!league) throw new NotFoundException('Polla no encontrada en este tenant');

        // Verificar que el partido estÃ¡ activo en la polla
        const leagueMatch = await this.prisma.leagueMatch.findUnique({
            where: { leagueId_matchId: { leagueId, matchId } },
        });
        if (!leagueMatch || !leagueMatch.active) {
            throw new BadRequestException('Este partido no estÃ¡ disponible para pronÃ³sticos');
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

        const prediction = await this.predictionsService.upsertPrediction(userId, {
            matchId,
            leagueId,
            homeScore,
            awayScore,
            advanceTeamId,
        });

        this.participationService.invalidateOverviewCache(tenantId);

        return { ok: true, id: prediction.id };
    }

    @UseGuards(TenantAdminGuard)
    @Get('config')
    async getConfig(@Req() req: any) {
        const tenantId: string = req.tenantId;
        return (await this.prisma.tenantConfig.findUnique({ where: { tenantId } })) ?? {};
    }

    @UseGuards(TenantAdminGuard)
    @Patch('config')
    async updateConfig(@Req() req: any, @Body() dto: UpdateCorpConfigDto) {
        const tenantId: string = req.tenantId;
        const existing = await this.prisma.tenantConfig.findUnique({ where: { tenantId } });
        if (!existing) throw new NotFoundException('Configuración del tenant no encontrada');
        return this.prisma.tenantConfig.update({ where: { tenantId }, data: dto });
    }

    @UseGuards(TenantStaffGuard)
    @HttpCode(HttpStatus.OK)
    @Post('members/:memberId/resend-credentials')
    async resendMemberCredentials(@Req() req: any, @Param('memberId') memberId: string) {
        const tenantId: string = req.tenantId;
        const member = await this.prisma.tenantMember.findFirst({
            where: { id: memberId, tenantId },
            include: { user: { select: { documentNumber: true, email: true } } },
        });
        if (!member) throw new NotFoundException('Miembro no encontrado');
        return this.provisioning.resendCredentials(tenantId, {
            email: member.user.email,
            documentNumber: member.user.documentNumber ?? undefined,
        });
    }

    @UseGuards(TenantAdminGuard)
    @Get('matches/operations')
    async listMatchOperations(
        @Req() req: any,
        @Query('status') status?: string,
        @Query('page') pageStr?: string,
        @Query('limit') limitStr?: string,
    ) {
        const tenantId: string = req.tenantId;
        const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
        const limit = Math.min(100, Math.max(10, parseInt(limitStr ?? '25', 10) || 25));
        const statusFilter = status && Object.values(MatchStatus).includes(status as MatchStatus)
            ? (status as MatchStatus)
            : undefined;

        return this.matchOperations.listTenantMatches(tenantId, {
            status: statusFilter,
            page,
            limit,
        });
    }

    @UseGuards(TenantAdminGuard)
    @Post('matches/:matchId/recalculate')
    @HttpCode(HttpStatus.OK)
    async recalculateMatch(@Req() req: any, @Param('matchId') matchId: string) {
        const tenantId: string = req.tenantId;
        return this.matchOperations.recalculateMatch(tenantId, matchId);
    }
}
