import {
    Controller, Get, Patch, Post, Delete, Param, Body, Query, UseGuards,
    NotFoundException, ParseIntPipe, DefaultValuePipe, HttpException, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LeagueStatus, Plan, MemberStatus, ScoringType } from '@prisma/client';
import { IsOptional, IsEnum, IsString, IsInt, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

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

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/leagues')
export class AdminLeaguesController {
    constructor(private readonly prisma: PrismaService) {}

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
}
