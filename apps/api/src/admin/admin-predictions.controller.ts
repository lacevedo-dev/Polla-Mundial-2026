import {
    Controller, Get, Post, Body, Query, UseGuards, ParseIntPipe, DefaultValuePipe,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { USER_STATUS } from '../users/user-status.constants';

export enum PredictionStrategy {
    RANDOM = 'random',
    CONSERVATIVE = 'conservative',
    HOME_BIAS = 'home_bias',
    REALISTIC = 'realistic',
}

export class BulkSeedPredictionsDto {
    @IsArray()
    @IsString({ each: true })
    leagueIds: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    matchIds?: string[];

    @IsOptional()
    @IsEnum(PredictionStrategy)
    strategy?: PredictionStrategy;

    @IsOptional()
    @IsBoolean()
    simulatePayments?: boolean;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/predictions')
export class AdminPredictionsController {
    constructor(private readonly prisma: PrismaService) {}

    @Get('filters')
    @ApiOperation({ summary: 'List compact filter options for admin predictions' })
    async getFilterOptions(@Query('leagueId') leagueId?: string) {
        const predictionWhere = leagueId ? { leagueId } : {};

        const [leagues, matches, users] = await Promise.all([
            this.prisma.league.findMany({
                where: { predictions: { some: {} } },
                orderBy: { name: 'asc' },
                select: { id: true, name: true },
            }),
            this.prisma.match.findMany({
                where: {
                    predictions: {
                        some: predictionWhere,
                    },
                },
                orderBy: [{ matchDate: 'desc' }],
                select: {
                    id: true,
                    group: true,
                    phase: true,
                    round: true,
                    homeTeam: { select: { id: true, name: true } },
                    awayTeam: { select: { id: true, name: true } },
                },
                take: 500,
            }),
            this.prisma.user.findMany({
                where: {
                    status: USER_STATUS.ACTIVE,
                    predictions: {
                        some: predictionWhere,
                    },
                },
                orderBy: { name: 'asc' },
                select: { id: true, name: true },
                take: 200,
            }),
        ]);

        const teamsMap = new Map<string, { id: string; name: string }>();
        const groups = new Set<string>();
        const phases = new Set<string>();
        const rounds = new Set<string>();

        for (const match of matches) {
            teamsMap.set(match.homeTeam.id, { id: match.homeTeam.id, name: match.homeTeam.name });
            teamsMap.set(match.awayTeam.id, { id: match.awayTeam.id, name: match.awayTeam.name });
            if (match.group) groups.add(match.group);
            if (match.phase) phases.add(match.phase);
            if (match.round) rounds.add(match.round);
        }

        return {
            leagues,
            teams: [...teamsMap.values()].sort((left, right) => left.name.localeCompare(right.name, 'es')),
            players: users,
            groups: [...groups].sort((left, right) => left.localeCompare(right, 'es')),
            phases: [...phases].sort((left, right) => left.localeCompare(right, 'es')),
            rounds: [...rounds].sort((left, right) => left.localeCompare(right, 'es')),
        };
    }

    @Post('bulk-seed')
    @ApiOperation({ summary: 'Seed test predictions for league members with strategy and payment simulation' })
    async bulkSeed(@Body() dto: BulkSeedPredictionsDto) {
        const { leagueIds, matchIds, strategy = PredictionStrategy.RANDOM, simulatePayments = false } = dto;

        if (leagueIds.length === 0) throw new BadRequestException('Debe seleccionar al menos una polla');

        // Validate leagues exist
        const leagues = await this.prisma.league.findMany({
            where: { id: { in: leagueIds } },
            select: { id: true, name: true, baseFee: true },
        });
        if (leagues.length === 0) throw new BadRequestException('No se encontraron las pollas seleccionadas');

        // Get matches to seed
        const matchWhere: any = matchIds?.length
            ? { id: { in: matchIds } }
            : {
                matchDate: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) },
                OR: [{ status: 'NS' }, { status: null }],
              };

        const matches = await this.prisma.match.findMany({
            where: matchWhere,
            select: { id: true, homeTeamId: true, awayTeamId: true },
            take: 200,
        });
        if (matches.length === 0) throw new BadRequestException('No se encontraron partidos para semillar');

        // Score generator based on strategy
        const generateScores = (): { home: number; away: number } => {
            switch (strategy) {
                case PredictionStrategy.CONSERVATIVE:
                    // Mostly draws and low scores
                    const conservativeScores = [0, 0, 0, 1, 1, 1, 1, 2];
                    const home = conservativeScores[Math.floor(Math.random() * conservativeScores.length)];
                    const away = Math.random() < 0.6 ? home : conservativeScores[Math.floor(Math.random() * conservativeScores.length)];
                    return { home, away };

                case PredictionStrategy.HOME_BIAS:
                    // Home team favored
                    const homeScore = [1, 1, 2, 2, 2, 3, 3, 4][Math.floor(Math.random() * 8)];
                    const awayScore = [0, 0, 0, 1, 1, 2][Math.floor(Math.random() * 6)];
                    return { home: homeScore, away: awayScore };

                case PredictionStrategy.REALISTIC:
                    // Based on FIFA statistics: 40% draws, balanced wins
                    const rand = Math.random();
                    if (rand < 0.4) {
                        // Draw
                        const score = [0, 1, 1, 2][Math.floor(Math.random() * 4)];
                        return { home: score, away: score };
                    } else if (rand < 0.7) {
                        // Home wins
                        return { home: [1, 2, 2, 3][Math.floor(Math.random() * 4)], away: [0, 0, 1, 1][Math.floor(Math.random() * 4)] };
                    } else {
                        // Away wins
                        return { home: [0, 0, 1, 1][Math.floor(Math.random() * 4)], away: [1, 2, 2, 3][Math.floor(Math.random() * 4)] };
                    }

                case PredictionStrategy.RANDOM:
                default:
                    const scores = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 1, 0, 2, 1, 3];
                    return {
                        home: scores[Math.floor(Math.random() * scores.length)],
                        away: scores[Math.floor(Math.random() * scores.length)],
                    };
            }
        };

        let totalCreated = 0;
        let totalSkipped = 0;
        let totalPayments = 0;
        const leagueResults: Array<{ name: string; members: number; created: number; skipped: number; payments: number }> = [];

        for (const league of leagues) {
            // Get all active members
            const members = await this.prisma.leagueMember.findMany({
                where: { leagueId: league.id, status: 'ACTIVE' },
                select: { userId: true },
            });
            if (members.length === 0) continue;

            let created = 0;
            let skipped = 0;
            let payments = 0;

            for (const member of members) {
                // Create predictions
                for (const match of matches) {
                    const existing = await this.prisma.prediction.findUnique({
                        where: { userId_matchId_leagueId: { userId: member.userId, matchId: match.id, leagueId: league.id } },
                        select: { id: true },
                    });
                    if (existing) { skipped++; continue; }

                    const { home, away } = generateScores();
                    await this.prisma.prediction.create({
                        data: {
                            userId: member.userId,
                            matchId: match.id,
                            leagueId: league.id,
                            homeScore: home,
                            awayScore: away,
                            submittedAt: new Date(),
                        },
                    });
                    created++;
                }

                // Simulate payment if requested and league has base fee
                if (simulatePayments && league.baseFee && league.baseFee > 0) {
                    const existingPayment = await this.prisma.payment.findFirst({
                        where: { userId: member.userId, leagueId: league.id, status: 'CONFIRMED' },
                        select: { id: true },
                    });
                    if (!existingPayment) {
                        await this.prisma.payment.create({
                            data: {
                                userId: member.userId,
                                leagueId: league.id,
                                amount: league.baseFee,
                                method: 'GATEWAY',
                                status: 'CONFIRMED',
                                note: 'Pago simulado para testing (seed)',
                            },
                        });
                        payments++;
                    }
                }
            }

            totalCreated += created;
            totalSkipped += skipped;
            totalPayments += payments;
            leagueResults.push({ name: league.name, members: members.length, created, skipped, payments });
        }

        return {
            strategy,
            leagues: leagueResults,
            matches: matches.length,
            totalCreated,
            totalSkipped,
            totalPayments,
        };
    }

    @Get()
    @ApiOperation({ summary: 'List all predictions with filters' })
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('matchId') matchId?: string,
        @Query('leagueId') leagueId?: string,
        @Query('userId') userId?: string,
        @Query('search') search?: string,
        @Query('team') team?: string,
        @Query('phase') phase?: string,
        @Query('group') group?: string,
        @Query('round') round?: string,
    ) {
        const skip = (page - 1) * limit;
        const and: any[] = [];

        if (matchId) and.push({ matchId });
        if (leagueId) and.push({ leagueId });
        if (userId) and.push({ userId });
        and.push({ user: { is: { status: USER_STATUS.ACTIVE } } });
        if (phase) and.push({ match: { phase } });
        if (group) and.push({ match: { group } });
        if (round) and.push({ match: { round } });

        if (team) {
            and.push({
                match: {
                    OR: [
                        { homeTeam: { name: { contains: team } } },
                        { awayTeam: { name: { contains: team } } },
                    ],
                },
            });
        }

        if (search) {
            and.push({
                OR: [
                    { id: { contains: search } },
                    { user: { name: { contains: search } } },
                    { user: { username: { contains: search } } },
                    { league: { name: { contains: search } } },
                    { matchId: { contains: search } },
                    { match: { homeTeam: { name: { contains: search } } } },
                    { match: { awayTeam: { name: { contains: search } } } },
                ],
            });
        }

        const where = and.length ? { AND: and } : {};

        const [data, total] = await Promise.all([
            this.prisma.prediction.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ match: { matchDate: 'desc' } }, { submittedAt: 'desc' }],
                include: {
                    user: { select: { id: true, name: true, username: true, avatar: true } },
                    match: {
                        include: {
                            homeTeam: { select: { id: true, name: true, flagUrl: true, code: true } },
                            awayTeam: { select: { id: true, name: true, flagUrl: true, code: true } },
                        },
                    },
                    league: { select: { id: true, name: true } },
                },
            }),
            this.prisma.prediction.count({ where }),
        ]);

        return { data, total, page, limit };
    }
}
