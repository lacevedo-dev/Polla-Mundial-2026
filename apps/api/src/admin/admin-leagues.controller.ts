import {
    Controller, Get, Patch, Post, Delete, Param, Body, Query, UseGuards,
    NotFoundException, ParseIntPipe, DefaultValuePipe, HttpException, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LeagueStatus, Plan, MemberStatus, ScoringType, Privacy } from '@prisma/client';
import { IsOptional, IsEnum, IsString, IsInt, IsArray, ValidateNested, Min, IsNotEmpty, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
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
    async create(@CurrentUser() user: { id: string }, @Body() dto: CreateLeagueDto) {
        return this.leaguesService.create(user.id, dto);
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
    @ApiOperation({ summary: 'Bulk create test leagues with random users for stress testing' })
    async bulkCreateTest(@CurrentUser() user: { id: string }, @Body() dto: BulkCreateTestLeaguesDto) {
        const { count, membersPerLeague, useExistingUsers = false, namePrefix = 'Test League' } = dto;

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

            if (useExistingUsers) {
                // Randomly select from existing users
                const shuffled = [...usersPool].sort(() => Math.random() - 0.5);
                membersToAdd.push(...shuffled.slice(0, membersPerLeague).map(u => u.id));
            } else {
                // Create random test users
                for (let j = 1; j <= membersPerLeague; j++) {
                    const randomId = Math.random().toString(36).substring(2, 10);
                    const testUser = await this.prisma.user.create({
                        data: {
                            email: `test.user.${randomId}@testpolla.local`,
                            name: `Test User ${randomId}`,
                            password: 'hashed_test_password',
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

            createdLeagues.push({
                id: league.id,
                name: league.name,
                code: league.code,
                members: membersPerLeague,
            });
        }

        return {
            created: count,
            totalMembers: count * membersPerLeague,
            leagues: createdLeagues,
            usedExistingUsers: useExistingUsers,
        };
    }
}
