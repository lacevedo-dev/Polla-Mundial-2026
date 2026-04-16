import {
    Controller, Get, Patch, Post, Delete, Param, Body, Query, UseGuards,
    NotFoundException, ParseIntPipe, DefaultValuePipe, HttpException, HttpStatus, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LeagueStatus, Plan, MemberStatus, ScoringType, Privacy, Phase, MatchStatus } from '@prisma/client';
import { IsOptional, IsEnum, IsString, IsInt, IsArray, ValidateNested, Min, IsNotEmpty, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { LeaguesService } from '../leagues/leagues.service';
import { CreateLeagueDto } from '../leagues/dto/create-league.dto';

export class UpdateLeagueAdminDto {
    @IsOptional()
    @IsEnum(LeagueStatus)
    status?: LeagueStatus;

    @IsOptional()
    @IsEnum(Plan)
    plan?: Plan;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    primaryTournamentId?: string | null;
}

export class BulkCreateTestLeaguesDto {
    @IsInt()
    @Min(1)
    count: number;

    @IsInt()
    @Min(2)
    membersPerLeague: number;

    @IsOptional()
    @IsBoolean()
    useExistingUsers?: boolean;

    @IsOptional()
    @IsString()
    namePrefix?: string;

    @IsOptional()
    @IsBoolean()
    linkTournaments?: boolean;

    @IsOptional()
    @IsBoolean()
    activateMatches?: boolean;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/leagues')
export class AdminLeaguesController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly leaguesService: LeaguesService,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Create a new league as admin' })
    async create(@CurrentUser() user: { userId: string }, @Body() dto: CreateLeagueDto) {
        return this.leaguesService.create(user.userId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List all leagues with pagination' })
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('status') status?: LeagueStatus,
        @Query('plan') plan?: Plan,
        @Query('search') search?: string,
    ) {
        const skip = (page - 1) * limit;
        const where: any = {
            ...(status && { status }),
            ...(plan && { plan }),
            ...(search && { name: { contains: search } }),
        };

        const [data, total] = await Promise.all([
            this.prisma.league.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: { select: { members: true, predictions: true } },
                },
            }),
            this.prisma.league.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get league detail with members' })
    async findOne(@Param('id') id: string) {
        const league = await this.prisma.league.findUnique({
            where: { id },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true, avatar: true } },
                    },
                },
                _count: { select: { predictions: true, payments: true } },
            },
        });
        if (!league) throw new NotFoundException('Liga no encontrada');
        return league;
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update league status, plan, or name' })
    async update(@Param('id') id: string, @Body() dto: UpdateLeagueAdminDto) {
        const league = await this.prisma.league.findUnique({ where: { id } });
        if (!league) throw new NotFoundException('Liga no encontrada');
        return this.prisma.league.update({ where: { id }, data: dto });
    }

    @Get(':id/members')
    @ApiOperation({ summary: 'Get league members' })
    async getMembers(@Param('id') id: string) {
        const league = await this.prisma.league.findUnique({ where: { id } });
        if (!league) throw new NotFoundException('Liga no encontrada');

        return this.prisma.leagueMember.findMany({
            where: { leagueId: id },
            include: {
                user: { select: { id: true, name: true, email: true, avatar: true, plan: true } },
            },
        });
    }

    @Patch(':id/members/:userId/ban')
    @ApiOperation({ summary: 'Ban a member from a league' })
    async banMember(@Param('id') id: string, @Param('userId') userId: string) {
        const member = await this.prisma.leagueMember.findUnique({
            where: { userId_leagueId: { userId, leagueId: id } },
        });
        if (!member) throw new NotFoundException('Miembro no encontrado');
        return this.prisma.leagueMember.update({
            where: { userId_leagueId: { userId, leagueId: id } },
            data: { status: MemberStatus.BANNED },
        });
    }

    /* ── Tournament management ─────────────────────────────────────────── */

    @Get(':id/tournaments')
    @ApiOperation({ summary: 'Get tournaments linked to a league' })
    async getLeagueTournaments(@Param('id') id: string) {
        const league = await this.prisma.league.findUnique({
            where: { id },
            select: {
                primaryTournamentId: true,
                leagueTournaments: {
                    include: {
                        tournament: {
                            select: { id: true, name: true, logoUrl: true, season: true, country: true, active: true },
                        },
                    },
                },
            },
        });
        if (!league) throw new NotFoundException('Liga no encontrada');
        return {
            primaryTournamentId: league.primaryTournamentId,
            tournaments: league.leagueTournaments.map(lt => ({
                ...lt.tournament,
                addedAt: lt.addedAt,
                isPrimary: lt.tournamentId === league.primaryTournamentId,
            })),
        };
    }

    @Post(':id/tournaments/:tournamentId')
    @ApiOperation({ summary: 'Link a tournament to a league' })
    async addTournament(@Param('id') id: string, @Param('tournamentId') tournamentId: string) {
        const [league, tournament] = await Promise.all([
            this.prisma.league.findUnique({ where: { id } }),
            this.prisma.tournament.findUnique({ where: { id: tournamentId } }),
        ]);
        if (!league) throw new NotFoundException('Liga no encontrada');
        if (!tournament) throw new NotFoundException('Torneo no encontrado');

        try {
            await this.prisma.leagueTournament.create({ data: { leagueId: id, tournamentId } });
        } catch {
            throw new HttpException('El torneo ya está vinculado a esta liga', HttpStatus.CONFLICT);
        }

        // If it's the first tournament, make it primary automatically
        if (!league.primaryTournamentId) {
            await this.prisma.league.update({ where: { id }, data: { primaryTournamentId: tournamentId } });
        }

        return { message: 'Torneo vinculado correctamente' };
    }

    @Delete(':id/tournaments/:tournamentId')
    @ApiOperation({ summary: 'Unlink a tournament from a league' })
    async removeTournament(@Param('id') id: string, @Param('tournamentId') tournamentId: string) {
        const lt = await this.prisma.leagueTournament.findUnique({
            where: { leagueId_tournamentId: { leagueId: id, tournamentId } },
        });
        if (!lt) throw new NotFoundException('Vínculo no encontrado');

        await this.prisma.leagueTournament.delete({
            where: { leagueId_tournamentId: { leagueId: id, tournamentId } },
        });

        // If removed tournament was primary, clear it
        const league = await this.prisma.league.findUnique({ where: { id }, select: { primaryTournamentId: true } });
        if (league?.primaryTournamentId === tournamentId) {
            // Set next available as primary, or null
            const next = await this.prisma.leagueTournament.findFirst({ where: { leagueId: id } });
            await this.prisma.league.update({
                where: { id },
                data: { primaryTournamentId: next?.tournamentId ?? null },
            });
        }

        return { message: 'Torneo desvinculado correctamente' };
    }

    @Patch(':id/tournaments/:tournamentId/set-primary')
    @ApiOperation({ summary: 'Set a tournament as primary (for participation suggestions)' })
    async setPrimaryTournament(@Param('id') id: string, @Param('tournamentId') tournamentId: string) {
        const lt = await this.prisma.leagueTournament.findUnique({
            where: { leagueId_tournamentId: { leagueId: id, tournamentId } },
        });
        if (!lt) throw new NotFoundException('El torneo no está vinculado a esta liga');

        await this.prisma.league.update({ where: { id }, data: { primaryTournamentId: tournamentId } });
        return { message: 'Torneo principal actualizado' };
    }

    /* ── Matches management ──────────────────────────────────────── */

    @Get(':id/matches')
    @ApiOperation({ summary: 'Get matches with activation status for league' })
    async getLeagueMatches(
        @Param('id') id: string,
        @Query('tournamentId') tournamentId?: string,
        @Query('phase') phase?: Phase,
    ) {
        const where: any = {};

        if (tournamentId) {
            where.tournamentId = tournamentId;
        } else {
            const leagueTournaments = await this.prisma.leagueTournament.findMany({
                where: { leagueId: id },
                select: { tournamentId: true },
            });
            if (leagueTournaments.length > 0) {
                where.tournamentId = { in: leagueTournaments.map(lt => lt.tournamentId) };
            }
        }

        if (phase) where.phase = phase;

        const matches = await this.prisma.match.findMany({
            where,
            orderBy: { matchDate: 'asc' },
            include: {
                homeTeam: { select: { name: true, shortCode: true, flagUrl: true } },
                awayTeam: { select: { name: true, shortCode: true, flagUrl: true } },
                leagueMatches: {
                    where: { leagueId: id },
                    select: { active: true, addedAt: true },
                },
            },
        });

        return matches.map(m => ({
            ...m,
            activeInLeague: m.leagueMatches[0]?.active ?? false,
            addedAt: m.leagueMatches[0]?.addedAt,
        }));
    }

    @Post(':id/matches/:matchId/activate')
    @ApiOperation({ summary: 'Activate match for league' })
    async activateMatch(
        @Param('id') leagueId: string,
        @Param('matchId') matchId: string,
        @CurrentUser() user: { userId: string },
    ) {
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            select: { tournamentId: true },
        });

        if (!match?.tournamentId) {
            throw new BadRequestException('Partido sin torneo asignado');
        }

        const leagueTournament = await this.prisma.leagueTournament.findUnique({
            where: {
                leagueId_tournamentId: {
                    leagueId,
                    tournamentId: match.tournamentId,
                },
            },
        });

        if (!leagueTournament) {
            throw new ForbiddenException('Partido no pertenece a ningún torneo vinculado');
        }

        await this.prisma.leagueMatch.upsert({
            where: { leagueId_matchId: { leagueId, matchId } },
            create: { leagueId, matchId, active: true, addedBy: user.userId },
            update: { active: true },
        });

        return { message: 'Partido activado' };
    }

    @Delete(':id/matches/:matchId')
    @ApiOperation({ summary: 'Deactivate match (keeps existing predictions)' })
    async deactivateMatch(
        @Param('id') leagueId: string,
        @Param('matchId') matchId: string,
    ) {
        await this.prisma.leagueMatch.updateMany({
            where: { leagueId, matchId },
            data: { active: false },
        });

        return { message: 'Partido desactivado' };
    }

    @Post(':id/tournaments/:tournamentId/activate-all-matches')
    @ApiOperation({ summary: 'Bulk activate all tournament matches' })
    async activateAllTournamentMatches(
        @Param('id') leagueId: string,
        @Param('tournamentId') tournamentId: string,
        @CurrentUser() user: { userId: string },
    ) {
        const lt = await this.prisma.leagueTournament.findUnique({
            where: { leagueId_tournamentId: { leagueId, tournamentId } },
        });

        if (!lt) throw new NotFoundException('Torneo no vinculado');

        const matches = await this.prisma.match.findMany({
            where: { tournamentId },
            select: { id: true },
        });

        const operations = matches.map(m =>
            this.prisma.leagueMatch.upsert({
                where: { leagueId_matchId: { leagueId, matchId: m.id } },
                create: { leagueId, matchId: m.id, active: true, addedBy: user.userId },
                update: { active: true },
            })
        );

        await this.prisma.$transaction(operations);

        return { message: 'Partidos activados', count: matches.length };
    }

    /* ── Scoring rules ── */

    @Get(':id/scoring-rules')
    @ApiOperation({ summary: 'Get scoring rules for a league' })
    async getScoringRules(@Param('id') id: string) {
        return this.prisma.scoringRule.findMany({
            where: { leagueId: id },
            orderBy: { ruleType: 'asc' },
        });
    }

    @Patch(':id/scoring-rules')
    @ApiOperation({ summary: 'Update scoring rules for a league' })
    async updateScoringRules(
        @Param('id') id: string,
        @Body() body: { rules: { ruleType: string; points: number }[] },
    ) {
        for (const rule of body.rules) {
            await this.prisma.scoringRule.updateMany({
                where: { leagueId: id, ruleType: rule.ruleType as ScoringType },
                data: { points: rule.points },
            });
        }
        return this.prisma.scoringRule.findMany({
            where: { leagueId: id },
            orderBy: { ruleType: 'asc' },
        });
    }

    /* ── Testing utilities ── */

    @Post('bulk-create-test')
    @ApiOperation({ summary: 'Bulk create test leagues with random users, tournaments and matches for stress testing' })
    async bulkCreateTest(@CurrentUser() user: { userId: string }, @Body() dto: BulkCreateTestLeaguesDto) {
        try {
            const { 
                count, 
                membersPerLeague, 
                useExistingUsers = false, 
                namePrefix = 'Test League',
                linkTournaments = true,
                activateMatches = true,
            } = dto;

            if (count > 50) throw new BadRequestException('Máximo 50 pollas por operación');
            if (membersPerLeague > 100) throw new BadRequestException('Máximo 100 miembros por polla');

        const createdLeagues: any[] = [];
        let usersPool: { id: string; name: string; email: string }[] = [];

        // Get existing users if requested
        if (useExistingUsers) {
            usersPool = await this.prisma.user.findMany({
                where: { status: 'ACTIVE' },
                select: { id: true, name: true, email: true },
                take: 1000,
            });
            if (usersPool.length < membersPerLeague) {
                throw new BadRequestException(`No hay suficientes usuarios activos (${usersPool.length} disponibles, ${membersPerLeague} requeridos)`);
            }
        }

        // Get active tournaments with matches
        let activeTournaments: any[] = [];
        let totalMatchesLinked = 0;

        if (linkTournaments) {
            // First, try to find tournaments that already have matches
            activeTournaments = await this.prisma.tournament.findMany({
                where: {
                    active: true,
                    matches: { some: {} }, // Only tournaments with at least one match
                },
                select: {
                    id: true,
                    name: true,
                    _count: { select: { matches: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
            });

            // If no active tournaments with matches exist, create test tournaments and matches
            if (activeTournaments.length === 0) {
                // Get some teams to create test matches
                const teams = await this.prisma.team.findMany({
                    take: 20, // More teams to create multiple tournaments
                    select: { id: true, name: true },
                });

                if (teams.length >= 4) {
                    // Create multiple test tournaments instead of just one
                    const tournamentsToCreate = Math.min(3, Math.floor(teams.length / 4));

                    for (let t = 0; t < tournamentsToCreate; t++) {
                        const testTournament = await this.prisma.tournament.create({
                            data: {
                                name: `Torneo de Prueba ${t + 1}`,
                                season: new Date().getFullYear(),
                                country: 'Test',
                                active: true,
                                apiFootballLeagueId: Math.floor(Date.now() / 1000) + t,
                            },
                        });

                        // Create matches for this specific tournament
                        const matchesToCreate: Array<{
                            tournamentId: string;
                            homeTeamId: string;
                            awayTeamId: string;
                            matchDate: Date;
                            status: MatchStatus;
                            round: string;
                            phase: Phase;
                        }> = [];
                        const now = new Date();

                        // Use different teams for each tournament
                        const tournamentTeamsStart = t * 4;
                        const tournamentTeamsEnd = Math.min(tournamentTeamsStart + 8, teams.length);
                        const tournamentTeams = teams.slice(tournamentTeamsStart, tournamentTeamsEnd);

                        for (let i = 0; i < Math.floor(tournamentTeams.length / 2); i++) {
                            const matchDate = new Date(now);
                            matchDate.setDate(matchDate.getDate() + i + (t * 10)); // Stagger dates

                            matchesToCreate.push({
                                tournamentId: testTournament.id,
                                homeTeamId: tournamentTeams[i * 2].id,
                                awayTeamId: tournamentTeams[i * 2 + 1].id,
                                matchDate,
                                status: MatchStatus.SCHEDULED,
                                round: `Jornada ${i + 1}`,
                                phase: Phase.GROUP,
                            });
                        }

                        if (matchesToCreate.length > 0) {
                            await this.prisma.match.createMany({
                                data: matchesToCreate,
                            });

                            activeTournaments.push({
                                id: testTournament.id,
                                name: testTournament.name,
                                _count: { matches: matchesToCreate.length },
                            });
                        }
                    }
                } else {
                    throw new BadRequestException('No hay suficientes equipos para crear torneos de prueba (mínimo 4 requeridos)');
                }
            }
        }

        for (let i = 1; i <= count; i++) {
            const leagueName = `${namePrefix} #${i}`;
            const code = `TEST${Date.now().toString().slice(-6)}${i.toString().padStart(2, '0')}`;

            // Create league
            const league = await this.prisma.league.create({
                data: {
                    name: leagueName,
                    description: `Polla de prueba generada automáticamente para stress testing`,
                    code,
                    privacy: Privacy.PRIVATE,
                    maxParticipants: membersPerLeague + 10,
                    baseFee: Math.random() > 0.5 ? Math.floor(Math.random() * 50000) + 10000 : null,
                    plan: Plan.FREE,
                    status: LeagueStatus.ACTIVE,
                },
            });

            // Add members
            const membersToAdd: string[] = [];

            // Always include the current SUPERADMIN user
            membersToAdd.push(user.userId);

            if (useExistingUsers) {
                // Randomly select from existing users (excluding the SUPERADMIN already added)
                const shuffled = [...usersPool].filter(u => u.id !== user.userId).sort(() => Math.random() - 0.5);
                membersToAdd.push(...shuffled.slice(0, membersPerLeague - 1).map(u => u.id));
            } else {
                // Create random test users (one less since SUPERADMIN is already included)
                // Generate a valid bcrypt hash for password "test123" (only once for performance)
                const testPasswordHash = await bcrypt.hash('test123', 10);
                
                for (let j = 1; j < membersPerLeague; j++) {
                    const randomId = Math.random().toString(36).substring(2, 10);
                    const testUser = await this.prisma.user.create({
                        data: {
                            email: `test.user.${randomId}@testpolla.local`,
                            username: `testuser${randomId}`,
                            name: `Test User ${randomId}`,
                            passwordHash: testPasswordHash,
                            status: 'ACTIVE',
                            plan: Plan.FREE,
                        },
                    });
                    membersToAdd.push(testUser.id);
                }
            }

            // Create league members
            await this.prisma.leagueMember.createMany({
                data: membersToAdd.map(userId => ({
                    userId,
                    leagueId: league.id,
                    status: MemberStatus.ACTIVE,
                })),
            });

            // Link tournaments and activate matches
            let linkedTournaments = 0;
            let activatedMatches = 0;

            if (linkTournaments && activeTournaments.length > 0) {
                // Link all active tournaments to this league
                for (const tournament of activeTournaments) {
                    try {
                        await this.prisma.leagueTournament.create({
                            data: {
                                leagueId: league.id,
                                tournamentId: tournament.id,
                            },
                        });
                        linkedTournaments++;

                        // Set first tournament as primary
                        if (linkedTournaments === 1) {
                            await this.prisma.league.update({
                                where: { id: league.id },
                                data: { primaryTournamentId: tournament.id },
                            });
                        }

                        // Activate all matches from this tournament if requested
                        if (activateMatches) {
                            const matches = await this.prisma.match.findMany({
                                where: { tournamentId: tournament.id },
                                select: { id: true },
                            });

                            if (matches.length > 0) {
                                await this.prisma.leagueMatch.createMany({
                                    data: matches.map(match => ({
                                        leagueId: league.id,
                                        matchId: match.id,
                                        active: true,
                                        addedBy: user.userId,
                                    })),
                                    skipDuplicates: true,
                                });
                                activatedMatches += matches.length;
                            }
                        }
                    } catch (error) {
                        // Skip if tournament already linked
                        console.error(`Error linking tournament ${tournament.id} to league ${league.id}:`, error);
                    }
                }
            }

            totalMatchesLinked += activatedMatches;

            createdLeagues.push({
                id: league.id,
                name: league.name,
                code: league.code,
                members: membersPerLeague,
                tournaments: linkedTournaments,
                matches: activatedMatches,
            });
        }

            return {
                created: count,
                totalMembers: count * membersPerLeague,
                totalTournamentsLinked: activeTournaments.length * count,
                totalMatchesActivated: totalMatchesLinked,
                leagues: createdLeagues,
                usedExistingUsers: useExistingUsers,
                tournamentsAvailable: activeTournaments.map(t => ({ id: t.id, name: t.name, matches: t._count.matches })),
            };
        } catch (error) {
            console.error('Error creating test leagues:', error);
            throw new HttpException(
                error.message || 'Error al crear pollas de prueba',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
