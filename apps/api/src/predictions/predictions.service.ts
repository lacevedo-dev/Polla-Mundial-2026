import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/prediction.dto';
import { MemberStatus, ParticipationCategory, ParticipationStatus, Phase, ScoringType } from '@prisma/client';
import { matchTeamSelect } from '../matches/match-response.util';
import { USER_STATUS } from '../users/user-status.constants';

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
type LeaderboardCategory = 'GENERAL' | 'MATCH' | 'GROUP' | 'ROUND';

type LeaderboardSummaryStats = {
    points: number;
    exactCount: number;
    winnerCount: number;
    goalCount: number;
    uniqueCount: number;
};

@Injectable()
export class PredictionsService {
    private readonly logger = new Logger(PredictionsService.name);

    private static readonly DEFAULT_POINTS = {
        EXACT_SCORE:        5,
        CORRECT_WINNER:     2,
        TEAM_GOALS:         1,
        UNIQUE_PREDICTION:  5,
        PHASE_BONUS_R32:    0,
        PHASE_BONUS_R16:    8,
        PHASE_BONUS_QF:     4,
        PHASE_BONUS_SF:     2,
        PHASE_BONUS_FINAL:  5,
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
                advanceTeamId: createPredictionDto.advanceTeamId ?? null,
                submittedAt: now,
            },
            create: {
                userId,
                matchId,
                leagueId,
                homeScore,
                awayScore,
                advanceTeamId: createPredictionDto.advanceTeamId ?? null,
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

    async calculatePhaseBonuses(matchId: string): Promise<void> {
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            include: { homeTeam: true, awayTeam: true },
        });

        if (!match || match.phase === Phase.GROUP || (match.phase as string) === 'THIRD_PLACE') return;

        // Get all leagues with predictions on knockout matches in this phase
        const leagueEntries = await this.prisma.prediction.findMany({
            where: { matchId },
            select: { leagueId: true },
            distinct: ['leagueId'],
        });

        for (const { leagueId } of leagueEntries) {
            // All matches in this phase for this league
            const phaseMatches = await this.prisma.match.findMany({
                where: {
                    phase: match.phase,
                    predictions: { some: { leagueId } },
                },
                select: { id: true, status: true, homeTeamId: true, awayTeamId: true, advancingTeamId: true },
            });

            // Only proceed if ALL phase matches are finished AND have advancingTeamId set
            const allDone = phaseMatches.every(
                m => m.status === 'FINISHED' && m.advancingTeamId !== null,
            );
            if (!allDone) continue;

            const league = await this.prisma.league.findUnique({
                where: { id: leagueId },
                include: { scoringRules: { where: { active: true } } },
            });
            if (!league) continue;

            const bonusPoints = this.getPhaseBonusPoints(match.phase, league.scoringRules);
            if (bonusPoints === 0) continue;

            // 1 query: ALL advance predictions for this league+phase (replaces N+1 per user)
            const allAdvancePreds = await this.prisma.prediction.findMany({
                where: {
                    leagueId,
                    match: { phase: match.phase },
                    advanceTeamId: { not: null },
                },
                select: { userId: true, matchId: true, advanceTeamId: true },
            });

            // Index by userId -> matchId -> advanceTeamId
            const predsByUser = new Map<string, Map<string, string | null>>();
            for (const pred of allAdvancePreds) {
                if (!predsByUser.has(pred.userId)) {
                    predsByUser.set(pred.userId, new Map());
                }
                predsByUser.get(pred.userId)!.set(pred.matchId, pred.advanceTeamId);
            }

            for (const [userId, userPreds] of predsByUser) {
                // Must have predicted ALL phase matches
                if (userPreds.size !== phaseMatches.length) continue;

                // Check all were correct
                const allCorrect = phaseMatches.every(pm =>
                    userPreds.get(pm.id) === pm.advancingTeamId,
                );

                if (allCorrect) {
                    await this.prisma.phaseBonus.upsert({
                        where: { userId_leagueId_phase: { userId, leagueId, phase: match.phase } },
                        update: { points: bonusPoints, awardedAt: new Date() },
                        create: { userId, leagueId, phase: match.phase, points: bonusPoints },
                    });
                    this.logger.log(`Bono de fase ${match.phase} otorgado a ${userId} en liga ${leagueId}`);
                }
            }
        }
    }

    private getPhaseBonusPoints(phase: Phase, rules: ScoringRuleLike[]): number {
        const phaseToScoringType: Partial<Record<Phase, ScoringType>> = {
            [Phase.ROUND_OF_32]: ScoringType.PHASE_BONUS_R32,
            [Phase.ROUND_OF_16]: ScoringType.PHASE_BONUS_R16,
            [Phase.QUARTER]:     ScoringType.PHASE_BONUS_QF,
            [Phase.SEMI]:        ScoringType.PHASE_BONUS_SF,
            [Phase.FINAL]:       ScoringType.PHASE_BONUS_FINAL,
        };
        const scoringType = phaseToScoringType[phase];
        if (!scoringType) return 0;

        const defaultKey = {
            [ScoringType.PHASE_BONUS_R32]:   'PHASE_BONUS_R32',
            [ScoringType.PHASE_BONUS_R16]:   'PHASE_BONUS_R16',
            [ScoringType.PHASE_BONUS_QF]:    'PHASE_BONUS_QF',
            [ScoringType.PHASE_BONUS_SF]:    'PHASE_BONUS_SF',
            [ScoringType.PHASE_BONUS_FINAL]: 'PHASE_BONUS_FINAL',
        }[scoringType] as keyof typeof PredictionsService.DEFAULT_POINTS;

        return this.getRulePoints(rules, scoringType, PredictionsService.DEFAULT_POINTS[defaultKey]);
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

    async getLeaderboard(leagueId: string, category?: string) {
        const leaderboardCategory = this.normalizeLeaderboardCategory(category);
        const members = await this.prisma.leagueMember.findMany({
            where: {
                leagueId,
                status: MemberStatus.ACTIVE,
                user: { is: { status: USER_STATUS.ACTIVE } },
            },
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

        const allMemberIds = members.map((member) => member.userId);
        const participationKeys = await this.getParticipationScopeKeys(leagueId, leaderboardCategory);
        const eligibleUserIds =
            leaderboardCategory === 'GENERAL'
                ? new Set(allMemberIds)
                : new Set(
                    [...participationKeys]
                        .map((key) => key.split(':', 1)[0])
                        .filter((userId) => allMemberIds.includes(userId)),
                );

        const predictions = await this.prisma.prediction.findMany({
            where: {
                leagueId,
                points: { not: null },
                ...(leaderboardCategory === 'GENERAL' ? {} : { userId: { in: [...eligibleUserIds] } }),
            },
            select: {
                userId: true,
                matchId: true,
                points: true,
                pointDetail: true,
                match: {
                    select: {
                        group: true,
                        phase: true,
                    },
                },
            },
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
            if (!this.matchesLeaderboardScope(leaderboardCategory, pred, participationKeys)) {
                continue;
            }

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

        // Phase bonuses
        const phaseBonuses = await this.prisma.phaseBonus.findMany({
            where: {
                leagueId,
                ...(leaderboardCategory === 'GENERAL' ? {} : { userId: { in: [...eligibleUserIds] } }),
            },
            select: { userId: true, points: true, phase: true },
        });

        const bonusByUser = new Map<string, { total: number; hasChampion: boolean }>();
        for (const b of phaseBonuses) {
            if (!this.matchesPhaseBonusScope(leaderboardCategory, b, participationKeys)) {
                continue;
            }
            const curr = bonusByUser.get(b.userId) ?? { total: 0, hasChampion: false };
            curr.total += b.points;
            if (b.phase === Phase.FINAL) curr.hasChampion = true;
            bonusByUser.set(b.userId, curr);
        }

        // Criterios de desempate según reglas (en orden de prioridad):
        // 1. Puntos totales (predicciones + bonos de fase)
        // 2. Acertó el campeón (bono FINAL)
        // 3. Marcadores exactos
        // 4. Ganadores acertados
        // 5. Goles acertados
        // 6. Predicciones únicas
        return members
            .filter((member) => leaderboardCategory === 'GENERAL' || eligibleUserIds.has(member.userId))
            .map((member) => {
                const stats = userStats.get(member.userId) ?? {
                    points: 0, exactCount: 0, winnerCount: 0, goalCount: 0, uniqueCount: 0,
                };
                const bonus = bonusByUser.get(member.userId) ?? { total: 0, hasChampion: false };
                return {
                    ...member.user,
                    points:           stats.points + bonus.total,
                    predictionPoints: stats.points,
                    phaseBonusPoints: bonus.total,
                    hasChampion:      bonus.hasChampion,
                    exactCount:       stats.exactCount,
                    winnerCount:      stats.winnerCount,
                    goalCount:        stats.goalCount,
                    uniqueCount:      stats.uniqueCount,
                };
            })
            .sort((a, b) => {
                if (b.points      !== a.points)       return b.points      - a.points;
                // Tiebreaker 1: acertó el campeón
                if (b.hasChampion !== a.hasChampion)  return b.hasChampion ? 1 : -1;
                // Tiebreaker 2-5
                if (b.exactCount  !== a.exactCount)   return b.exactCount  - a.exactCount;
                if (b.winnerCount !== a.winnerCount)  return b.winnerCount - a.winnerCount;
                if (b.goalCount   !== a.goalCount)    return b.goalCount   - a.goalCount;
                return b.uniqueCount - a.uniqueCount;
            });
    }

    async getLeaderboardUserBreakdown(leagueId: string, userId: string, category?: string) {
        const leaderboardCategory = this.normalizeLeaderboardCategory(category);
        const participationKeys = await this.getParticipationScopeKeys(leagueId, leaderboardCategory);

        const member = await this.prisma.leagueMember.findFirst({
            where: {
                userId,
                leagueId,
                status: MemberStatus.ACTIVE,
                user: { is: { status: USER_STATUS.ACTIVE } },
            },
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

        if (!member) {
            throw new NotFoundException('Participante no encontrado en esta liga');
        }

        const eligibleUserIds =
            leaderboardCategory === 'GENERAL'
                ? new Set([userId])
                : new Set(
                    [...participationKeys]
                        .map((key) => key.split(':', 1)[0])
                        .filter((candidate) => candidate === userId),
                );

        if (leaderboardCategory !== 'GENERAL' && !eligibleUserIds.has(userId)) {
            return {
                user: member.user,
                summary: {
                    points: 0,
                    exactCount: 0,
                    winnerCount: 0,
                    goalCount: 0,
                    uniqueCount: 0,
                    phaseBonusPoints: 0,
                },
                matches: [],
                bonuses: [],
            };
        }

        const predictions = await this.prisma.prediction.findMany({
            where: {
                leagueId,
                userId,
                points: { not: null },
            },
            orderBy: { submittedAt: 'desc' },
            include: {
                match: {
                    include: {
                        homeTeam: { select: matchTeamSelect },
                        awayTeam: { select: matchTeamSelect },
                    },
                },
            },
        });

        const filteredPredictions = predictions.filter((prediction) =>
            this.matchesLeaderboardScope(
                leaderboardCategory,
                {
                    userId: prediction.userId,
                    matchId: prediction.matchId,
                    match: {
                        group: prediction.match.group,
                        phase: prediction.match.phase,
                    },
                },
                participationKeys,
            ),
        );

        const phaseBonuses = await this.prisma.phaseBonus.findMany({
            where: { leagueId, userId },
            orderBy: { awardedAt: 'desc' },
        });

        const filteredBonuses = phaseBonuses.filter((bonus) =>
            this.matchesPhaseBonusScope(leaderboardCategory, bonus, participationKeys),
        );

        const summary = filteredPredictions.reduce<LeaderboardSummaryStats>(
            (acc, prediction) => {
                acc.points += prediction.points ?? 0;
                const detail = this.parsePointDetail(prediction.pointDetail);
                if (!detail) {
                    return acc;
                }
                if (detail.type === 'EXACT_SCORE') acc.exactCount += 1;
                if (detail.type === 'CORRECT_WINNER' || detail.type === 'CORRECT_WINNER_GOAL') acc.winnerCount += 1;
                if (detail.type === 'TEAM_GOALS' || detail.type === 'CORRECT_WINNER_GOAL') acc.goalCount += 1;
                if ((detail.uniqueBonus ?? 0) > 0) acc.uniqueCount += 1;
                return acc;
            },
            { points: 0, exactCount: 0, winnerCount: 0, goalCount: 0, uniqueCount: 0 },
        );

        const bonusTotal = filteredBonuses.reduce((sum, bonus) => sum + bonus.points, 0);

        return {
            user: member.user,
            summary: {
                ...summary,
                points: summary.points + bonusTotal,
                phaseBonusPoints: bonusTotal,
            },
            matches: filteredPredictions.map((prediction) => ({
                id: prediction.id,
                points: prediction.points ?? 0,
                submittedAt: prediction.submittedAt,
                pointDetail: this.parsePointDetail(prediction.pointDetail),
                prediction: {
                    homeScore: prediction.homeScore,
                    awayScore: prediction.awayScore,
                    advanceTeamId: prediction.advanceTeamId,
                },
                match: {
                    id: prediction.match.id,
                    matchDate: prediction.match.matchDate,
                    phase: prediction.match.phase,
                    group: prediction.match.group,
                    venue: prediction.match.venue,
                    homeScore: prediction.match.homeScore,
                    awayScore: prediction.match.awayScore,
                    homeTeam: prediction.match.homeTeam,
                    awayTeam: prediction.match.awayTeam,
                },
            })),
            bonuses: filteredBonuses.map((bonus) => ({
                id: bonus.id,
                phase: bonus.phase,
                points: bonus.points,
                awardedAt: bonus.awardedAt,
            })),
        };
    }

    private normalizeLeaderboardCategory(category?: string): LeaderboardCategory {
        const normalized = category?.trim().toUpperCase();
        if (normalized === 'MATCH' || normalized === 'GROUP' || normalized === 'ROUND') {
            return normalized;
        }

        return 'GENERAL';
    }

    private parsePointDetail(pointDetail: string | null): PredictionPointDetail | null {
        if (!pointDetail) {
            return null;
        }

        try {
            return JSON.parse(pointDetail) as PredictionPointDetail;
        } catch {
            return null;
        }
    }

    private async getParticipationScopeKeys(
        leagueId: string,
        category: LeaderboardCategory,
    ): Promise<Set<string>> {
        if (category === 'GENERAL') {
            return new Set();
        }

        const participationCategory =
            category === 'MATCH'
                ? ParticipationCategory.MATCH
                : category === 'GROUP'
                    ? ParticipationCategory.GROUP
                    : ParticipationCategory.ROUND;

        const obligations = await this.prisma.participationObligation.findMany({
            where: {
                leagueId,
                category: participationCategory,
                status: ParticipationStatus.PAID,
            },
            select: {
                userId: true,
                matchId: true,
                referenceId: true,
            },
        });

        return new Set(
            obligations.map((obligation) =>
                category === 'MATCH'
                    ? `${obligation.userId}:${obligation.matchId ?? ''}`
                    : `${obligation.userId}:${obligation.referenceId ?? ''}`,
            ),
        );
    }

    private matchesLeaderboardScope(
        category: LeaderboardCategory,
        prediction: {
            userId: string;
            matchId: string;
            match: { group: string | null; phase: Phase };
        },
        participationKeys: Set<string>,
    ) {
        if (category === 'GENERAL') {
            return true;
        }

        if (category === 'MATCH') {
            return participationKeys.has(`${prediction.userId}:${prediction.matchId}`);
        }

        if (category === 'GROUP') {
            return prediction.match.group
                ? participationKeys.has(`${prediction.userId}:${prediction.match.group}`)
                : false;
        }

        return participationKeys.has(`${prediction.userId}:${prediction.match.phase}`);
    }

    private matchesPhaseBonusScope(
        category: LeaderboardCategory,
        phaseBonus: { userId: string; phase: Phase },
        participationKeys: Set<string>,
    ) {
        if (category === 'GENERAL') {
            return true;
        }

        if (category !== 'ROUND') {
            return false;
        }

        return participationKeys.has(`${phaseBonus.userId}:${phaseBonus.phase}`);
    }

    /**
     * Clasificación provisional: standings actuales + puntos hipotéticos si los partidos
     * en vivo terminaran con el marcador actual.
     */
    async getLiveStandings(leagueId: string, requestingUserId: string) {
        // 1. Partidos en vivo de esta liga
        const liveMatches = await this.prisma.match.findMany({
            where: {
                status: 'LIVE',
                predictions: { some: { leagueId } },
            },
            select: { id: true, homeScore: true, awayScore: true, phase: true },
        });

        if (liveMatches.length === 0) {
            return { hasLive: false, standings: [] };
        }

        // 2. Reglas de puntuación de la liga
        const league = await this.prisma.league.findUnique({
            where: { id: leagueId },
            include: { scoringRules: { where: { active: true } } },
        });
        const rules = league?.scoringRules ?? [];

        // 3. Leaderboard actual (puntos reales ya calculados)
        const leaderboard = await this.getLeaderboard(leagueId);

        // 4. Predicciones de los miembros activos para los partidos en vivo
        const liveMatchIds = liveMatches.map(m => m.id);
        const livePredictions = await this.prisma.prediction.findMany({
            where: { leagueId, matchId: { in: liveMatchIds } },
            select: { userId: true, matchId: true, homeScore: true, awayScore: true },
        });

        // 5. Calcular puntos hipotéticos por usuario
        const liveGain = new Map<string, number>();
        for (const pred of livePredictions) {
            const match = liveMatches.find(m => m.id === pred.matchId);
            if (!match || match.homeScore === null || match.awayScore === null) continue;
            const { total } = this.calculatePointsForOne(
                { homeScore: match.homeScore, awayScore: match.awayScore, phase: match.phase },
                { homeScore: pred.homeScore, awayScore: pred.awayScore },
                rules,
            );
            liveGain.set(pred.userId, (liveGain.get(pred.userId) ?? 0) + total);
        }

        // 6. Merge, re-ordenar y calcular cambio de posición
        const withLive = leaderboard.map((entry, idx) => ({
            ...entry,
            currentPosition:    idx + 1,
            livePoints:         liveGain.get(entry.id) ?? 0,
            provisionalPoints:  entry.points + (liveGain.get(entry.id) ?? 0),
        }));

        withLive.sort((a, b) =>
            b.provisionalPoints !== a.provisionalPoints
                ? b.provisionalPoints - a.provisionalPoints
                : b.exactCount - a.exactCount,
        );

        const standings = withLive.map((entry, idx) => ({
            ...entry,
            provisionalPosition: idx + 1,
            positionChange: entry.currentPosition - (idx + 1), // >0 subió, <0 bajó
            isMe: entry.id === requestingUserId,
        }));

        const myEntry = standings.find(s => s.id === requestingUserId);

        return {
            hasLive: true,
            liveMatchCount: liveMatches.length,
            myProvisionalPosition: myEntry?.provisionalPosition ?? null,
            myPositionChange:      myEntry?.positionChange ?? 0,
            myLivePoints:          myEntry?.livePoints ?? 0,
            standings: standings.slice(0, 10), // top 10 provisional
        };
    }
}
