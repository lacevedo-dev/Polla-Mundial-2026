import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/prediction.dto';
import { MemberStatus, Phase, ScoringType } from '@prisma/client';

type ScoringRuleLike = {
    ruleType: ScoringType | string;
    points: number;
};

type MatchScoreLike = {
    homeScore: number;
    awayScore: number;
    phase: Phase;
};

type PredictionScoreLike = {
    homeScore: number;
    awayScore: number;
};

type PointType = 'EXACT_SCORE' | 'CORRECT_DIFF' | 'CORRECT_WINNER' | 'NONE';

interface PredictionPointDetail {
    type: PointType;
    basePoints: number;
    phase: Phase;
    multiplier: number;
}

@Injectable()
export class PredictionsService {
    private static readonly DEFAULT_POINTS = {
        EXACT_SCORE: 5,
        CORRECT_DIFF: 3,
        CORRECT_WINNER: 2,
    } as const;

    // Regla vigente: en eliminatorias se aplica un factor adicional al puntaje base.
    private static readonly KNOCKOUT_PHASE_MULTIPLIER = 1.5;

    constructor(private readonly prisma: PrismaService) { }

    async upsertPrediction(userId: string, createPredictionDto: CreatePredictionDto) {
        const { matchId, leagueId, homeScore, awayScore } = createPredictionDto;

        // 1. Verificar que el usuario sea miembro activo de la liga
        const membership = await this.prisma.leagueMember.findUnique({
            where: { userId_leagueId: { userId, leagueId } },
        });

        if (!membership || membership.status !== MemberStatus.ACTIVE) {
            throw new ForbiddenException('No eres un miembro activo de esta liga');
        }

        // 2. Obtener información del partido y de la liga (para el tiempo de cierre)
        const [match, league] = await Promise.all([
            this.prisma.match.findUnique({ where: { id: matchId } }),
            this.prisma.league.findUnique({ where: { id: leagueId } }),
        ]);

        if (!match || !league) {
            throw new NotFoundException('Partido o Liga no encontrados');
        }

        // 3. Validar si el tiempo para predecir ya expiró
        const now = new Date();
        const matchDate = new Date(match.matchDate);
        const closingTime = new Date(matchDate.getTime() - league.closePredictionMinutes * 60000);

        if (now > closingTime) {
            throw new BadRequestException('El tiempo para realizar predicciones ha expirado para este partido');
        }

        // 4. Crear o actualizar la predicción
        return this.prisma.prediction.upsert({
            where: {
                userId_matchId_leagueId: { userId, matchId, leagueId },
            },
            update: {
                homeScore,
                awayScore,
                submittedAt: now,
            },
            create: {
                userId,
                matchId,
                leagueId,
                homeScore,
                awayScore,
                submittedAt: now,
            },
        });
    }

    async findByLeagueAndUser(leagueId: string, userId: string) {
        return this.prisma.prediction.findMany({
            where: { leagueId, userId },
            include: {
                match: {
                    include: {
                        homeTeam: true,
                        awayTeam: true,
                    },
                },
            },
        });
    }

    async calculateMatchPoints(matchId: string) {
        // 1. Obtener el partido finalizado
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
        });

        if (!match || match.homeScore === null || match.awayScore === null) {
            return;
        }

        // 2. Obtener todas las predicciones para este partido
        const predictions = await this.prisma.prediction.findMany({
            where: { matchId },
            include: {
                league: {
                    include: {
                        scoringRules: {
                            where: { active: true },
                        },
                    },
                },
            },
        });

        // 3. Procesar cada predicción
        const matchForScoring: MatchScoreLike = {
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            phase: match.phase,
        };

        for (const pred of predictions) {
            const points = this.calculatePointsForOne(matchForScoring, pred, pred.league.scoringRules);

            await this.prisma.prediction.update({
                where: { id: pred.id },
                data: {
                    points: points.total,
                    // Contrato pointDetail: { type, basePoints, phase, multiplier }
                    pointDetail: points.detail as any,
                },
            });
        }
    }

    private getRulePoints(rules: ScoringRuleLike[], ruleType: ScoringType, fallback: number): number {
        return rules.find((rule) => rule.ruleType === ruleType)?.points ?? fallback;
    }

    private calculatePointsForOne(
        match: MatchScoreLike,
        pred: PredictionScoreLike,
        rules: ScoringRuleLike[],
    ) {
        let basePoints = 0;
        let type: PointType = 'NONE';

        const actualHome = match.homeScore;
        const actualAway = match.awayScore;
        const predHome = pred.homeScore;
        const predAway = pred.awayScore;

        const actualWinner = actualHome > actualAway ? 'HOME' : actualHome < actualAway ? 'AWAY' : 'DRAW';
        const predWinner = predHome > predAway ? 'HOME' : predHome < predAway ? 'AWAY' : 'DRAW';

        const ruleExact = this.getRulePoints(
            rules,
            ScoringType.EXACT_SCORE,
            PredictionsService.DEFAULT_POINTS.EXACT_SCORE,
        );
        const ruleDiff = this.getRulePoints(
            rules,
            ScoringType.CORRECT_DIFF,
            PredictionsService.DEFAULT_POINTS.CORRECT_DIFF,
        );
        const ruleWinner = this.getRulePoints(
            rules,
            ScoringType.CORRECT_WINNER,
            PredictionsService.DEFAULT_POINTS.CORRECT_WINNER,
        );

        // 1. Determinar puntos base según jerarquía (sin acumulación doble)
        if (actualHome === predHome && actualAway === predAway) {
            basePoints = ruleExact;
            type = 'EXACT_SCORE';
        } else {
            const actualDiff = actualHome - actualAway;
            const predDiff = predHome - predAway;

            if (actualWinner === predWinner) {
                if (actualDiff === predDiff && actualWinner !== 'DRAW') {
                    basePoints = ruleDiff;
                    type = 'CORRECT_DIFF';
                } else {
                    basePoints = ruleWinner;
                    type = 'CORRECT_WINNER';
                }
            }
        }

        // 2. Aplicar multiplicador de fase (grupos 1.0, eliminatorias > 1.0)
        let phaseMultiplier = 1.0;
        if (match.phase !== Phase.GROUP) {
            phaseMultiplier = PredictionsService.KNOCKOUT_PHASE_MULTIPLIER;
        }

        const total = basePoints * phaseMultiplier;
        const detail: PredictionPointDetail = {
            type,
            basePoints,
            phase: match.phase,
            multiplier: phaseMultiplier,
        };

        return { total, detail };
    }

    async getLeaderboard(leagueId: string) {
        // Ranking basado en la suma de puntos (incluye decimales para fases eliminatorias)
        const members = await this.prisma.leagueMember.findMany({
            where: { leagueId, status: MemberStatus.ACTIVE },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
        });

        const predictions = await this.prisma.prediction.groupBy({
            by: ['userId'],
            _sum: {
                points: true,
            },
            where: { leagueId },
        });

        const leaderboard = members
            .map((member) => {
                const predSum = predictions.find((prediction) => prediction.userId === member.userId);
                return {
                    ...member.user,
                    points: predSum?._sum?.points || 0,
                };
            })
            .sort((a, b) => b.points - a.points);

        return leaderboard;
    }
}
