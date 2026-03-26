import {
    Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

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
