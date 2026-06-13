import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, Phase, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionsService } from '../predictions/predictions.service';

@Injectable()
export class MatchOperationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly predictionsService: PredictionsService,
    ) {}

    async listTenantMatches(
        tenantId: string,
        params: { status?: MatchStatus; page: number; limit: number },
    ) {
        const { status, page, limit } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.MatchWhereInput = {
            leagueMatches: { some: { league: { tenantId } } },
            ...(status && { status }),
        };

        const [rows, total] = await Promise.all([
            this.prisma.match.findMany({
                where,
                include: {
                    homeTeam: { select: { id: true, name: true, shortCode: true, code: true } },
                    awayTeam: { select: { id: true, name: true, shortCode: true, code: true } },
                    _count: {
                        select: {
                            predictions: {
                                where: { league: { tenantId } },
                            },
                        },
                    },
                },
                orderBy: [{ matchDate: 'desc' }, { id: 'asc' }],
                skip,
                take: limit,
            }),
            this.prisma.match.count({ where }),
        ]);

        const matchIds = rows.map((m) => m.id);
        const scoredCounts = matchIds.length
            ? await this.prisma.prediction.groupBy({
                by: ['matchId'],
                where: {
                    matchId: { in: matchIds },
                    league: { tenantId },
                    points: { not: null },
                },
                _count: { _all: true },
            })
            : [];

        const scoredMap = new Map(scoredCounts.map((r) => [r.matchId, r._count._all]));

        return {
            data: rows.map((m) => {
                const predictionCount = m._count.predictions;
                const scoredPredictionCount = scoredMap.get(m.id) ?? 0;
                const canRecalculate =
                    m.status === MatchStatus.FINISHED &&
                    m.homeScore != null &&
                    m.awayScore != null &&
                    predictionCount > 0;
                const needsScoring = canRecalculate && scoredPredictionCount < predictionCount;

                return {
                    id: m.id,
                    matchDate: m.matchDate,
                    status: m.status,
                    phase: m.phase,
                    homeScore: m.homeScore,
                    awayScore: m.awayScore,
                    externalId: m.externalId,
                    lastSyncAt: m.lastSyncAt,
                    syncCount: m.syncCount,
                    statusShort: m.statusShort,
                    homeTeam: m.homeTeam,
                    awayTeam: m.awayTeam,
                    predictionCount,
                    scoredPredictionCount,
                    canRecalculate,
                    needsScoring,
                };
            }),
            total,
            page,
            limit,
        };
    }

    async recalculateMatch(tenantId: string, matchId: string) {
        await this.assertMatchInTenant(tenantId, matchId);

        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            select: {
                id: true,
                phase: true,
                homeScore: true,
                awayScore: true,
                homeTeamId: true,
                awayTeamId: true,
                advancingTeamId: true,
                status: true,
            },
        });

        if (!match) throw new NotFoundException('Partido no encontrado');
        if (match.homeScore === null || match.awayScore === null) {
            throw new BadRequestException('El partido no tiene marcador final registrado.');
        }

        if (match.phase !== Phase.GROUP && match.homeScore !== match.awayScore) {
            const advancingTeamId = match.homeScore > match.awayScore
                ? match.homeTeamId
                : match.awayTeamId;
            if (advancingTeamId && match.advancingTeamId !== advancingTeamId) {
                await this.prisma.match.update({
                    where: { id: matchId },
                    data: { advancingTeamId },
                });
            }
        }

        await this.predictionsService.calculateMatchPoints(matchId);
        await this.predictionsService.calculatePhaseBonuses(matchId);

        const scoredPredictionCount = await this.prisma.prediction.count({
            where: {
                matchId,
                league: { tenantId },
                points: { not: null },
            },
        });

        return { ok: true, matchId, scoredPredictionCount };
    }

    private async assertMatchInTenant(tenantId: string, matchId: string) {
        const link = await this.prisma.leagueMatch.findFirst({
            where: { matchId, league: { tenantId } },
            select: { id: true },
        });
        if (!link) {
            throw new NotFoundException('Partido no encontrado en las pollas de esta organización');
        }
    }
}
