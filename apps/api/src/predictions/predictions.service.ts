import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/prediction.dto';
import { MemberStatus, ParticipationCategory, ParticipationStatus, Phase, ScoringType } from '@prisma/client';
import { matchTeamSelect } from '../matches/match-response.util';
import { USER_STATUS } from '../users/user-status.constants';
import {
    PHASE_BONUS_DISPLAY_LABELS,
    TRACKED_PHASE_BONUS_PHASES,
    countPhaseBonusCorrect,
    resolveEffectiveAdvanceTeamId,
    type PhaseBonusProgressItem,
} from '@polla-2026/shared';
import { loadLeaguePhaseMatches } from './league-phase-matches.util';

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
    /** Explicación legible del cálculo (ej: "5 pts (marcador exacto) × 1.5 (eliminatoria) = 7.5 pts") */
    explanation?: string;
}

type CalculatePointsResult = { total: number; detail: PredictionPointDetail };

export type ProvisionalMatchImpactEntry = {
    userId: string;
    displayName: string;
    predictedHome: number;
    predictedAway: number;
    points: number;
    detailType: PointType;
};

export type ProvisionalLeagueImpact = {
    leagueId: string;
    leagueName: string;
    entries: ProvisionalMatchImpactEntry[];
};

export type ProvisionalRankingRow = {
    displayName: string;
    provisionalPosition: number;
    currentPosition: number;
    positionChange: number;
    provisionalPoints: number;
};
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
        PHASE_BONUS_R32:    12,
        PHASE_BONUS_R16:    8,
        PHASE_BONUS_QF:     4,
        PHASE_BONUS_SF:     2,
        PHASE_BONUS_FINAL:  5,
    } as const;

    // Regla vigente: en eliminatorias se aplica un factor adicional al puntaje base.
    private static readonly KNOCKOUT_PHASE_MULTIPLIER = 1.5;

    constructor(private readonly prisma: PrismaService) { }

    async upsertPrediction(
        userId: string,
        createPredictionDto: CreatePredictionDto,
        options?: { skipDeadline?: boolean },
    ) {
        const { matchId, leagueId, homeScore, awayScore } = createPredictionDto;

        // 1. Verificar que el usuario sea miembro activo de la liga
        const membership = await this.prisma.leagueMember.findUnique({
            where: { userId_leagueId: { userId, leagueId } },
        });

        if (!membership || (membership.status !== MemberStatus.ACTIVE && membership.status !== MemberStatus.PENDING_PAYMENT)) {
            throw new ForbiddenException('No eres un miembro activo de esta liga');
        }

        // 2. Validar que el partido está activo en la polla
        const leagueMatch = await this.prisma.leagueMatch.findUnique({
            where: {
                leagueId_matchId: {
                    leagueId,
                    matchId,
                },
            },
        });

        if (!leagueMatch || !leagueMatch.active) {
            throw new ForbiddenException('Este partido no está disponible para pronósticos en esta polla');
        }

        // 3. Obtener información del partido y de la liga (para el tiempo de cierre)
        const [match, league] = await Promise.all([
            this.prisma.match.findUnique({ where: { id: matchId } }),
            this.prisma.league.findUnique({ where: { id: leagueId } }),
        ]);

        if (!match || !league) {
            throw new NotFoundException('Partido o Liga no encontrados');
        }

        // 3b. No permitir si el partido ya finalizó (scores en vivo no cuentan)
        if (match.status === 'FINISHED') {
            throw new BadRequestException('No se puede ingresar pronóstico: el partido ya finalizó');
        }

        // 4. Validar si el tiempo para predecir ya expiró (salvo override admin)
        const now = new Date();
        if (!options?.skipDeadline) {
            const matchDate = new Date(match.matchDate);
            const closingTime = new Date(matchDate.getTime() - league.closePredictionMinutes * 60000);

            if (now > closingTime) {
                throw new BadRequestException('El tiempo para realizar predicciones ha expirado para este partido');
            }
        }

        const advanceTeamId = this.resolveKnockoutAdvanceTeamId(
            match,
            homeScore,
            awayScore,
            createPredictionDto.advanceTeamId,
        );

        // 5. Crear o actualizar la predicción
        return this.prisma.prediction.upsert({
            where: {
                userId_matchId_leagueId: { userId, matchId, leagueId },
            },
            update: {
                homeScore,
                awayScore,
                advanceTeamId,
                submittedAt: now,
            },
            create: {
                userId,
                matchId,
                leagueId,
                homeScore,
                awayScore,
                advanceTeamId,
                submittedAt: now,
            },
        });
    }

    /** SUPERADMIN: ingresar/corregir pronóstico de un participante (omite deadline). */
    async upsertPredictionForUser(targetUserId: string, createPredictionDto: CreatePredictionDto) {
        return this.upsertPrediction(targetUserId, createPredictionDto, { skipDeadline: true });
    }

    private resolveKnockoutAdvanceTeamId(
        match: { phase: Phase; homeTeamId: string; awayTeamId: string },
        homeScore: number,
        awayScore: number,
        requestedAdvanceTeamId?: string | null,
    ): string | null {
        const isKnockout = match.phase !== Phase.GROUP && match.phase !== Phase.THIRD_PLACE;
        if (!isKnockout) {
            return null;
        }

        if (homeScore === awayScore) {
            if (!requestedAdvanceTeamId) {
                throw new BadRequestException('En eliminatorias con empate debes indicar qué equipo clasifica.');
            }

            if (
                requestedAdvanceTeamId !== match.homeTeamId &&
                requestedAdvanceTeamId !== match.awayTeamId
            ) {
                throw new BadRequestException('El equipo clasificado debe ser el local o el visitante.');
            }

            return requestedAdvanceTeamId;
        }

        return homeScore > awayScore ? match.homeTeamId : match.awayTeamId;
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

            // Agregar el bono único a la explicación
            if (uniqueBonus > 0 && result.detail.explanation) {
                result.detail.explanation = result.detail.explanation.replace(/ = ([\d.]+) pts$/, ` + Única (${uniqueBonus} pts) = ${newTotal} pts`);
            }

            await this.prisma.prediction.update({
                where: { id: pred.id },
                data: {
                    points: newTotal,
                    pointDetail: JSON.stringify(result.detail),
                },
            });
        }
    }

    /**
     * Puntos provisionales por liga para un marcador en curso (sin bono único ni persistencia).
     */
    async computeProvisionalImpactByLeague(
        matchId: string,
        homeScore: number,
        awayScore: number,
    ): Promise<ProvisionalLeagueImpact[]> {
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            select: { phase: true },
        });
        if (!match) return [];

        const predictions = await this.prisma.prediction.findMany({
            where: { matchId },
            include: {
                user: { select: { id: true, name: true, username: true } },
                league: {
                    select: {
                        id: true,
                        name: true,
                        scoringRules: { where: { active: true } },
                    },
                },
            },
        });

        const byLeague = new Map<string, ProvisionalLeagueImpact>();
        const matchForScoring: MatchScoreLike = {
            homeScore,
            awayScore,
            phase: match.phase,
        };

        for (const pred of predictions) {
            const result = this.calculatePointsForOne(
                matchForScoring,
                { homeScore: pred.homeScore, awayScore: pred.awayScore },
                pred.league.scoringRules,
            );

            const displayName =
                pred.user.name?.trim() ||
                pred.user.username?.trim() ||
                'Participante';

            let leagueImpact = byLeague.get(pred.leagueId);
            if (!leagueImpact) {
                leagueImpact = {
                    leagueId: pred.leagueId,
                    leagueName: pred.league.name,
                    entries: [],
                };
                byLeague.set(pred.leagueId, leagueImpact);
            }

            leagueImpact.entries.push({
                userId: pred.userId,
                displayName,
                predictedHome: pred.homeScore,
                predictedAway: pred.awayScore,
                points: result.total,
                detailType: result.detail.type,
            });
        }

        return [...byLeague.values()];
    }

    /**
     * Clasificación provisional de la polla tras un marcador en curso (incluye partidos LIVE).
     */
    async computeProvisionalRankingAfterMatchScore(
        leagueId: string,
        matchId: string,
        homeScore: number,
        awayScore: number,
    ): Promise<ProvisionalRankingRow[]> {
        const leaderboard = await this.getLeaderboard(leagueId);
        if (leaderboard.length === 0) return [];

        const liveMatches = await this.prisma.match.findMany({
            where: {
                OR: [
                    { status: 'LIVE', predictions: { some: { leagueId } } },
                    { id: matchId, predictions: { some: { leagueId } } },
                ],
            },
            select: { id: true, homeScore: true, awayScore: true, phase: true },
        });

        if (liveMatches.length === 0) return [];

        const league = await this.prisma.league.findUnique({
            where: { id: leagueId },
            include: { scoringRules: { where: { active: true } } },
        });
        const rules = league?.scoringRules ?? [];

        const liveMatchIds = liveMatches.map((m) => m.id);
        const livePredictions = await this.prisma.prediction.findMany({
            where: { leagueId, matchId: { in: liveMatchIds } },
            select: { userId: true, matchId: true, homeScore: true, awayScore: true },
        });

        const liveGain = new Map<string, number>();
        for (const pred of livePredictions) {
            const liveMatch = liveMatches.find((m) => m.id === pred.matchId);
            if (!liveMatch) continue;

            const hs = liveMatch.id === matchId ? homeScore : liveMatch.homeScore;
            const as = liveMatch.id === matchId ? awayScore : liveMatch.awayScore;
            if (hs === null || as === null) continue;

            const { total } = this.calculatePointsForOne(
                { homeScore: hs, awayScore: as, phase: liveMatch.phase },
                { homeScore: pred.homeScore, awayScore: pred.awayScore },
                rules,
            );
            liveGain.set(pred.userId, (liveGain.get(pred.userId) ?? 0) + total);
        }

        const withLive = leaderboard.map((entry, idx) => ({
            displayName:
                entry.name?.trim() ||
                entry.username?.trim() ||
                'Participante',
            userId: entry.id,
            currentPosition: idx + 1,
            provisionalPoints: entry.points + (liveGain.get(entry.id) ?? 0),
            exactCount: entry.exactCount ?? 0,
        }));

        withLive.sort((a, b) =>
            b.provisionalPoints !== a.provisionalPoints
                ? b.provisionalPoints - a.provisionalPoints
                : b.exactCount - a.exactCount,
        );

        return withLive.slice(0, 5).map((entry, idx) => ({
            displayName: entry.displayName,
            provisionalPosition: idx + 1,
            currentPosition: entry.currentPosition,
            positionChange: entry.currentPosition - (idx + 1),
            provisionalPoints: entry.provisionalPoints,
        }));
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
            const phaseMatchesRaw = await this.loadLeaguePhaseMatches(leagueId, match.phase);
            const phaseMatches = phaseMatchesRaw.filter(
                (phaseMatch): phaseMatch is typeof phaseMatch & { homeTeamId: string; awayTeamId: string } =>
                    Boolean(phaseMatch.homeTeamId && phaseMatch.awayTeamId),
            );

            // Only proceed if ALL phase matches are finished AND have advancingTeamId set
            const allDone = phaseMatches.every(
                (m) => m.status === 'FINISHED' && m.advancingTeamId !== null,
            );
            if (!allDone) continue;

            const league = await this.prisma.league.findUnique({
                where: { id: leagueId },
                include: { scoringRules: { where: { active: true } } },
            });
            if (!league) continue;

            const bonusPoints = this.getPhaseBonusPoints(match.phase, league.scoringRules);
            if (bonusPoints === 0) continue;

            const allPreds = await this.prisma.prediction.findMany({
                where: {
                    leagueId,
                    matchId: { in: phaseMatches.map((phaseMatch) => phaseMatch.id) },
                },
                select: {
                    userId: true,
                    matchId: true,
                    advanceTeamId: true,
                    homeScore: true,
                    awayScore: true,
                },
            });

            const matchById = new Map(phaseMatches.map((phaseMatch) => [phaseMatch.id, phaseMatch]));
            const predsByUser = new Map<string, Map<string, string>>();

            for (const pred of allPreds) {
                const phaseMatch = matchById.get(pred.matchId);
                if (!phaseMatch?.homeTeamId || !phaseMatch?.awayTeamId) continue;

                const effectiveAdvance = resolveEffectiveAdvanceTeamId(pred, phaseMatch);
                if (!effectiveAdvance) continue;

                if (!predsByUser.has(pred.userId)) {
                    predsByUser.set(pred.userId, new Map());
                }
                predsByUser.get(pred.userId)!.set(pred.matchId, effectiveAdvance);
            }

            for (const [userId, userPreds] of predsByUser) {
                if (userPreds.size !== phaseMatches.length) continue;

                const allCorrect = phaseMatches.every(
                    (phaseMatch) => userPreds.get(phaseMatch.id) === phaseMatch.advancingTeamId,
                );

                if (allCorrect) {
                    await this.upsertPhaseBonusAward({
                        userId,
                        leagueId,
                        phase: match.phase,
                        points: bonusPoints,
                    });
                    this.logger.log(`Bono de fase ${match.phase} otorgado a ${userId} en liga ${leagueId}`);
                }
            }
        }
    }

    /**
     * Persiste un bono de fase. Usa el modelo Prisma cuando existe;
     * en api-corp (cliente sin PhaseBonus) cae a SQL crudo.
     */
    private async upsertPhaseBonusAward(params: {
        userId: string;
        leagueId: string;
        phase: Phase;
        points: number;
    }): Promise<void> {
        const { userId, leagueId, phase, points } = params;
        const phaseBonusDelegate = (this.prisma as { phaseBonus?: { upsert: Function } }).phaseBonus;

        if (typeof phaseBonusDelegate?.upsert === 'function') {
            await phaseBonusDelegate.upsert({
                where: { userId_leagueId_phase: { userId, leagueId, phase } },
                update: { points, awardedAt: new Date() },
                create: { userId, leagueId, phase, points },
            });
            return;
        }

        const id = `pb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        await this.prisma.$executeRaw`
            INSERT INTO PhaseBonus (id, userId, leagueId, phase, points, awardedAt)
            VALUES (${id}, ${userId}, ${leagueId}, ${phase}, ${points}, NOW())
            ON DUPLICATE KEY UPDATE points = VALUES(points), awardedAt = VALUES(awardedAt)
        `;
    }

    async getPhaseBonusProgress(leagueId: string, userId: string): Promise<PhaseBonusProgressItem[]> {
        try {
            return await this.computePhaseBonusProgress(leagueId, userId);
        } catch (error) {
            this.logger.warn(
                `No se pudo calcular progreso de bonos para liga ${leagueId}, usuario ${userId}: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            return [];
        }
    }

    private async computePhaseBonusProgress(
        leagueId: string,
        userId: string,
    ): Promise<PhaseBonusProgressItem[]> {
        const league = await this.prisma.league.findUnique({
            where: { id: leagueId },
            include: { scoringRules: { where: { active: true } } },
        });
        if (!league) {
            throw new NotFoundException('Liga no encontrada');
        }

        const awardedBonuses = await this.loadUserPhaseBonuses(leagueId, userId);
        const awardedMap = new Map(awardedBonuses.map((bonus) => [bonus.phase, bonus.points]));

        const progress: PhaseBonusProgressItem[] = [];

        for (const phaseKey of TRACKED_PHASE_BONUS_PHASES) {
            const phase = phaseKey as Phase;
            const maxBonusPoints = this.getPhaseBonusPoints(phase, league.scoringRules);

            const phaseMatches = await this.loadLeaguePhaseMatches(leagueId, phase);

            if (phaseMatches.length === 0) continue;

            const countableMatches = phaseMatches.filter(
                (match): match is typeof match & { homeTeamId: string; awayTeamId: string } =>
                    Boolean(match.homeTeamId && match.awayTeamId),
            );
            if (countableMatches.length === 0) continue;

            const totalMatches = countableMatches.length;
            const isPhaseComplete = countableMatches.every(
                (match) => match.status === 'FINISHED' && match.advancingTeamId !== null,
            );

            const userPreds = await this.prisma.prediction.findMany({
                where: {
                    leagueId,
                    userId,
                    matchId: { in: countableMatches.map((match) => match.id) },
                },
                select: {
                    matchId: true,
                    homeScore: true,
                    awayScore: true,
                    advanceTeamId: true,
                },
            });

            const correctCount = countPhaseBonusCorrect(countableMatches, userPreds);
            const finishedInPhase = countableMatches.some(
                (match) => match.status === 'FINISHED' && match.advancingTeamId !== null,
            );
            if (maxBonusPoints === 0 && correctCount === 0 && !finishedInPhase) continue;

            const isAwarded = awardedMap.has(phase);
            const awardedPoints = isAwarded ? awardedMap.get(phase)! : 0;

            progress.push({
                phase,
                label: PHASE_BONUS_DISPLAY_LABELS[phase] ?? phase,
                correctCount,
                totalMatches,
                maxBonusPoints,
                awardedPoints,
                isPhaseComplete,
                isAwarded,
                progressLabel: `${correctCount}/${totalMatches}:${awardedPoints}`,
            });
        }

        return progress;
    }

    private loadLeaguePhaseMatches(leagueId: string, phase: Phase) {
        return loadLeaguePhaseMatches(this.prisma, leagueId, phase);
    }

    /** Compatible con api-corp: PhaseBonus no está en el cliente Prisma corporativo. */
    private async loadUserPhaseBonuses(
        leagueId: string,
        userId: string,
    ): Promise<Array<{ phase: Phase; points: number }>> {
        try {
            const rows = await this.prisma.$queryRaw<Array<{ phase: string; points: number }>>`
                SELECT phase, points
                FROM PhaseBonus
                WHERE leagueId = ${leagueId} AND userId = ${userId}
            `;
            return rows.map((row) => ({
                phase: row.phase as Phase,
                points: Number(row.points ?? 0),
            }));
        } catch {
            return [];
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

        // Generar explicación legible del cálculo
        let explanation = '';
        if (type === 'EXACT_SCORE') {
            explanation = `Marcador exacto: ${basePoints} pts`;
        } else if (type === 'CORRECT_WINNER_GOAL') {
            explanation = `Ganador (${winnerPoints} pts) + Gol (${goalPoints} pt) = ${basePoints} pts`;
        } else if (type === 'CORRECT_WINNER') {
            explanation = `Ganador correcto: ${winnerPoints} pts`;
        } else if (type === 'TEAM_GOALS') {
            explanation = `Gol acertado: ${goalPoints} pt`;
        } else {
            explanation = 'Sin aciertos';
        }

        if (phaseMultiplier !== 1.0) {
            explanation += ` × ${phaseMultiplier} (eliminatoria) = ${total} pts`;
        } else if (basePoints > 0) {
            explanation += ` = ${total} pts`;
        }

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
            explanation,
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
                status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING_PAYMENT] },
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
                phaseBonusProgress: [],
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
        const phaseBonusProgress =
            leaderboardCategory === 'GENERAL'
                ? await this.getPhaseBonusProgress(leagueId, userId)
                : [];

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
            phaseBonusProgress,
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

    async getCorpTenantUserBreakdown(tenantId: string, userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, name: true, avatar: true },
        });
        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        const leagueIds = (
            await this.prisma.league.findMany({
                where: { tenantId },
                select: { id: true },
            })
        ).map((league) => league.id);

        const predictionWhere = leagueIds.length
            ? { userId, leagueId: { in: leagueIds }, points: { not: null } }
            : { userId, league: { tenantId }, points: { not: null } };

        const predictions = await this.prisma.prediction.findMany({
            where: predictionWhere,
            orderBy: { submittedAt: 'desc' },
            include: {
                league: { select: { id: true, name: true } },
                match: {
                    include: {
                        homeTeam: { select: matchTeamSelect },
                        awayTeam: { select: matchTeamSelect },
                    },
                },
            },
        });

        const scoredPredictions = predictions.filter((prediction) => (prediction.points ?? 0) > 0);

        const summary = scoredPredictions.reduce<LeaderboardSummaryStats>(
            (acc, prediction) => {
                acc.points += prediction.points ?? 0;
                const detail = this.parsePointDetail(prediction.pointDetail);
                if (!detail) return acc;
                if (detail.type === 'EXACT_SCORE') acc.exactCount += 1;
                if (detail.type === 'CORRECT_WINNER' || detail.type === 'CORRECT_WINNER_GOAL') acc.winnerCount += 1;
                if (detail.type === 'TEAM_GOALS' || detail.type === 'CORRECT_WINNER_GOAL') acc.goalCount += 1;
                if ((detail.uniqueBonus ?? 0) > 0) acc.uniqueCount += 1;
                return acc;
            },
            { points: 0, exactCount: 0, winnerCount: 0, goalCount: 0, uniqueCount: 0 },
        );

        return {
            user,
            summary: {
                ...summary,
                phaseBonusPoints: 0,
            },
            matches: scoredPredictions.map((prediction) => ({
                id: prediction.id,
                leagueId: prediction.leagueId,
                leagueName: prediction.league.name,
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
            bonuses: [],
        };
    }
}
