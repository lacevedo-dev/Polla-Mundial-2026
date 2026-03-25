import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/prediction.dto';
import { MemberStatus, Phase, ScoringType } from '@prisma/client';
import { matchTeamSelect } from '../matches/match-response.util';

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

export type PointType = 'EXACT_SCORE' | 'CORRECT_WINNER_GOAL' | 'CORRECT_WINNER' | 'TEAM_GOALS' | 'NONE';

export interface PredictionPointDetail {
    type: PointType;
    exactPoints: number;
    winnerPoints: number;
    goalPoints: number;
    uniqueBonus: number;
    basePoints: number;
    phase: Phase;
    multiplier: number;
    total: number;
}

type CalculatePointsResult = { total: number; detail: PredictionPointDetail };

@Injectable()
export class PredictionsService {
    private static readonly DEFAULT_POINTS = {
        EXACT_SCORE:       5,
        CORRECT_WINNER:    2,
        TEAM_GOALS:        1,
        UNIQUE_PREDICTION: 5,
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
                        homeTeam: {
                            select: matchTeamSelect,
                        },
                        awayTeam: {
                            select: matchTeamSelect,
                        },
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

        const matchForScoring: MatchScoreLike = {
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            phase: match.phase,
        };

        // 3. Calcular y persistir puntos base por predicción
        const scoredItems: Array<{ pred: (typeof predictions)[0]; result: CalculatePointsResult }> = [];

        for (const pred of predictions) {
            const result = this.calculatePointsForOne(matchForScoring, pred, pred.league.scoringRules);
            scoredItems.push({ pred, result });

            await this.prisma.prediction.update({
                where: { id: pred.id },
                data: {
                    points: result.total,
                    pointDetail: JSON.stringify(result.detail),
                },
            });
        }

        // 4. Aplicar bono de Predicción Única por liga (solo si exactamente 1 persona acertó el marcador exacto)
        const byLeague = new Map<string, typeof scoredItems>();
        for (const item of scoredItems) {
            const arr = byLeague.get(item.pred.leagueId) ?? [];
            arr.push(item);
            byLeague.set(item.pred.leagueId, arr);
        }

        for (const leaguePreds of byLeague.values()) {
            const exactPreds = leaguePreds.filter(({ result }) => result.detail.type === 'EXACT_SCORE');
            if (exactPreds.length !== 1) continue; // El bono solo aplica cuando hay UN único acertador

            const { pred, result } = exactPreds[0];
            const uniqueBonus = this.getRulePoints(
                pred.league.scoringRules,
                ScoringType.UNIQUE_PREDICTION,
                PredictionsService.DEFAULT_POINTS.UNIQUE_PREDICTION,
            );
            const newTotal = result.total + uniqueBonus;
            result.detail.uniqueBonus = uniqueBonus;
            result.detail.total = newTotal;

            await this.prisma.prediction.update({
                where: { id: pred.id },
                data: {
                    points: newTotal,
                    pointDetail: JSON.stringify(result.detail),
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
    ): CalculatePointsResult {
        const actualHome = match.homeScore;
        const actualAway = match.awayScore;
        const predHome = pred.homeScore;
        const predAway = pred.awayScore;

        const actualWinner = actualHome > actualAway ? 'HOME' : actualHome < actualAway ? 'AWAY' : 'DRAW';
        const predWinner   = predHome  > predAway   ? 'HOME' : predHome  < predAway   ? 'AWAY' : 'DRAW';

        const ruleExact  = this.getRulePoints(rules, ScoringType.EXACT_SCORE,    PredictionsService.DEFAULT_POINTS.EXACT_SCORE);
        const ruleWinner = this.getRulePoints(rules, ScoringType.CORRECT_WINNER, PredictionsService.DEFAULT_POINTS.CORRECT_WINNER);
        const ruleGoal   = this.getRulePoints(rules, ScoringType.TEAM_GOALS,     PredictionsService.DEFAULT_POINTS.TEAM_GOALS);

        let type: PointType = 'NONE';
        let exactPoints  = 0;
        let winnerPoints = 0;
        let goalPoints   = 0;

        if (actualHome === predHome && actualAway === predAway) {
            // Marcador exacto: puntaje plano, no acumulativo
            exactPoints = ruleExact;
            type = 'EXACT_SCORE';
        } else {
            // Ganador acertado (+2 pts)
            if (actualWinner === predWinner) {
                winnerPoints = ruleWinner;
            }
            // Gol acertado: al menos un equipo tiene los goles correctos (+1 pt)
            if (actualHome === predHome || actualAway === predAway) {
                goalPoints = ruleGoal;
            }

            if (winnerPoints > 0 && goalPoints > 0) type = 'CORRECT_WINNER_GOAL';
            else if (winnerPoints > 0) type = 'CORRECT_WINNER';
            else if (goalPoints > 0) type = 'TEAM_GOALS';
        }

        const basePoints = exactPoints > 0 ? exactPoints : (winnerPoints + goalPoints);

        // Multiplicador de fase: grupos x1.0, eliminatorias x1.5
        const phaseMultiplier = match.phase !== Phase.GROUP ? PredictionsService.KNOCKOUT_PHASE_MULTIPLIER : 1.0;
        const total = basePoints * phaseMultiplier;

        const detail: PredictionPointDetail = {
            type,
            exactPoints,
            winnerPoints,
            goalPoints,
            uniqueBonus: 0,
            basePoints,
            phase: match.phase,
            multiplier: phaseMultiplier,
            total,
        };

        return { total, detail };
    }

    async getLeaderboard(leagueId: string) {
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

        const predictions = await this.prisma.prediction.findMany({
            where: { leagueId, points: { not: null } },
            select: { userId: true, points: true, pointDetail: true },
        });

        // Acumular estadísticas por usuario para criterios de desempate
        const userStats = new Map<string, {
            points: number;
            exactCount:  number;  // marcadores exactos
            winnerCount: number;  // ganadores acertados (sin exacto)
            goalCount:   number;  // goles acertados (sin exacto)
            uniqueCount: number;  // predicciones únicas
        }>();

        for (const pred of predictions) {
            const stats = userStats.get(pred.userId) ?? {
                points: 0, exactCount: 0, winnerCount: 0, goalCount: 0, uniqueCount: 0,
            };
            stats.points += pred.points ?? 0;

            if (pred.pointDetail) {
                try {
                    const detail = JSON.parse(pred.pointDetail) as PredictionPointDetail;
                    if (detail.type === 'EXACT_SCORE')                                   stats.exactCount++;
                    if (detail.type === 'CORRECT_WINNER' || detail.type === 'CORRECT_WINNER_GOAL') stats.winnerCount++;
                    if (detail.type === 'TEAM_GOALS'     || detail.type === 'CORRECT_WINNER_GOAL') stats.goalCount++;
                    if ((detail.uniqueBonus ?? 0) > 0)                                   stats.uniqueCount++;
                } catch (_) { /* ignorar pointDetail malformado */ }
            }

            userStats.set(pred.userId, stats);
        }

        // Criterios de desempate según reglas (en orden de prioridad):
        // 1. Puntos totales
        // 2. Marcadores exactos
        // 3. Ganadores acertados
        // 4. Goles acertados
        // 5. Predicciones únicas
        return members
            .map((member) => {
                const stats = userStats.get(member.userId) ?? {
                    points: 0, exactCount: 0, winnerCount: 0, goalCount: 0, uniqueCount: 0,
                };
                return { ...member.user, ...stats };
            })
            .sort((a, b) => {
                if (b.points      !== a.points)      return b.points      - a.points;
                if (b.exactCount  !== a.exactCount)  return b.exactCount  - a.exactCount;
                if (b.winnerCount !== a.winnerCount) return b.winnerCount - a.winnerCount;
                if (b.goalCount   !== a.goalCount)   return b.goalCount   - a.goalCount;
                return b.uniqueCount - a.uniqueCount;
            });
    }
}
