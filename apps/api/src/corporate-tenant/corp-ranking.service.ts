import { Injectable, NotFoundException } from '@nestjs/common';
import {
    assignCompetitionRanks,
    formatTiebreakNote,
    sortLeaderboardEntries,
    PHASE_BONUS_DISPLAY_LABELS,
    TRACKED_PHASE_BONUS_PHASES,
    countPhaseBonusCorrect,
    DEFAULT_PHASE_BONUS_POINTS,
    isKnockoutPhaseComplete,
    selectCountableKnockoutMatches,
    type PhaseBonusProgressItem,
} from '@polla-2026/shared';
import { Phase, ScoringType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionsService } from '../predictions/predictions.service';
import { loadLeaguePhaseMatches } from '../predictions/league-phase-matches.util';

export const CORP_RANKING_LIMIT = 50;

export type CorpLeaderboardCategory = 'GENERAL' | 'MATCH' | 'GROUP' | 'ROUND';

export const CORP_RANKING_CATEGORY_META: Array<{ id: CorpLeaderboardCategory; label: string }> = [
    { id: 'GENERAL', label: 'General' },
    { id: 'MATCH', label: 'Por partido' },
    { id: 'GROUP', label: 'Por grupo' },
    { id: 'ROUND', label: 'Por ronda' },
];

type LeagueWithFees = {
    id: string;
    name: string;
    includeBaseFee: boolean;
    includeStageFees: boolean;
    stageFees: Array<{ type: string; amount: number; active: boolean }>;
};

type UserStats = {
    points: number;
    exactCount: number;
    winnerCount: number;
    goalCount: number;
    uniqueCount: number;
};

type CorpLeaderboardRow = {
    id: string;
    username: string;
    name: string;
    avatar: string | null;
    points: number;
    predictionPoints: number;
    phaseBonusPoints: number;
    hasChampion: boolean;
    exactCount: number;
    winnerCount: number;
    goalCount: number;
    uniqueCount: number;
};

type PointDetail = {
    type?: string;
    uniqueBonus?: number;
};

type PhaseBonusRow = {
    userId: string;
    points: number;
    phase: string;
};

type ParticipationRow = {
    userId: string;
    matchId: string | null;
    referenceId: string | null;
};

type ScoringRuleRow = {
    ruleType: ScoringType | string;
    points: number;
};

const PHASE_TO_SCORING_TYPE: Partial<Record<Phase, ScoringType>> = {
    [Phase.ROUND_OF_32]: ScoringType.PHASE_BONUS_R32,
    [Phase.ROUND_OF_16]: ScoringType.PHASE_BONUS_R16,
    [Phase.QUARTER]: ScoringType.PHASE_BONUS_QF,
    [Phase.SEMI]: ScoringType.PHASE_BONUS_SF,
    [Phase.FINAL]: ScoringType.PHASE_BONUS_FINAL,
};

@Injectable()
export class CorpRankingService {
    private readonly phaseBonusRefreshAt = new Map<string, number>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly predictionsService: PredictionsService,
    ) {}

    private parsePointDetail(pointDetail: string | null): PointDetail | null {
        if (!pointDetail) return null;
        try {
            return JSON.parse(pointDetail) as PointDetail;
        } catch {
            return null;
        }
    }

    /**
     * Reescribe PhaseBonus con la regla vigente (empate solo si hubo penales reales).
     * Se dispara al consultar ranking/detalle para no depender de un sync manual.
     */
    private async refreshPhaseBonusesForLeague(leagueId: string, force = false): Promise<void> {
        const now = Date.now();
        const last = this.phaseBonusRefreshAt.get(leagueId) ?? 0;
        if (!force && now - last < 15_000) return;
        this.phaseBonusRefreshAt.set(leagueId, now);

        for (const phaseKey of TRACKED_PHASE_BONUS_PHASES) {
            const phase = phaseKey as Phase;
            try {
                const matches = await loadLeaguePhaseMatches(this.prisma, leagueId, phase);
                const sample = matches.find(
                    (match) =>
                        match.status === 'FINISHED' &&
                        match.homeScore != null &&
                        match.awayScore != null,
                );
                if (!sample) continue;
                await this.predictionsService.calculatePhaseBonuses(sample.id);
            } catch {
                // No bloquear ranking si una fase falla al recalcular.
            }
        }
    }

    private accumulateStats(stats: UserStats, pointDetail: PointDetail | null, points: number) {
        stats.points += points;
        if (!pointDetail) return;

        if (pointDetail.type === 'EXACT_SCORE') stats.exactCount += 1;
        if (pointDetail.type === 'CORRECT_WINNER' || pointDetail.type === 'CORRECT_WINNER_GOAL') {
            stats.winnerCount += 1;
        }
        if (pointDetail.type === 'TEAM_GOALS' || pointDetail.type === 'CORRECT_WINNER_GOAL') {
            stats.goalCount += 1;
        }
        if ((pointDetail.uniqueBonus ?? 0) > 0) stats.uniqueCount += 1;
    }

    private async loadStageFees(
        leagueId: string,
    ): Promise<Array<{ type: string; amount: number; active: boolean }>> {
        try {
            const rows = await this.prisma.$queryRaw<
                Array<{ type: string; amount: number; active: number | boolean }>
            >`SELECT type, amount, active FROM StageFee WHERE leagueId = ${leagueId}`;

            return rows.map((row) => ({
                type: String(row.type),
                amount: Number(row.amount ?? 0),
                active: Boolean(row.active),
            }));
        } catch {
            return [];
        }
    }

    private async loadPhaseBonuses(leagueId: string): Promise<PhaseBonusRow[]> {
        try {
            const rows = await this.prisma.$queryRaw<
                Array<{ userId: string; points: number; phase: string }>
            >`SELECT userId, points, phase FROM PhaseBonus WHERE leagueId = ${leagueId}`;

            return rows.map((row) => ({
                userId: row.userId,
                points: Number(row.points ?? 0),
                phase: String(row.phase),
            }));
        } catch {
            return [];
        }
    }

    private async loadParticipationKeys(
        leagueId: string,
        category: CorpLeaderboardCategory,
    ): Promise<Set<string>> {
        if (category === 'GENERAL') return new Set();

        const participationCategory =
            category === 'MATCH' ? 'MATCH' : category === 'GROUP' ? 'GROUP' : 'ROUND';

        try {
            const rows = await this.prisma.$queryRaw<ParticipationRow[]>`
                SELECT userId, matchId, referenceId
                FROM ParticipationObligation
                WHERE leagueId = ${leagueId}
                  AND category = ${participationCategory}
                  AND status = 'PAID'
            `;

            return new Set(
                rows.map((row) =>
                    category === 'MATCH'
                        ? `${row.userId}:${row.matchId ?? ''}`
                        : `${row.userId}:${row.referenceId ?? ''}`,
                ),
            );
        } catch {
            return new Set();
        }
    }

    private matchesLeaderboardScope(
        category: CorpLeaderboardCategory,
        prediction: {
            userId: string;
            matchId: string;
            match: { group: string | null; phase: string };
        },
        participationKeys: Set<string>,
    ) {
        if (category === 'GENERAL') return true;
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
        category: CorpLeaderboardCategory,
        phaseBonus: PhaseBonusRow,
        participationKeys: Set<string>,
    ) {
        if (category === 'GENERAL') return true;
        if (category !== 'ROUND') return false;
        return participationKeys.has(`${phaseBonus.userId}:${phaseBonus.phase}`);
    }

    async getPhaseBonusProgressForUser(
        leagueId: string,
        userId: string,
    ): Promise<PhaseBonusProgressItem[]> {
        try {
            await this.refreshPhaseBonusesForLeague(leagueId, true);
            return await this.buildPhaseBonusProgress(leagueId, userId);
        } catch {
            return [];
        }
    }

    private resolvePhaseBonusPoints(phase: Phase, rules: ScoringRuleRow[]): number {
        const scoringType = PHASE_TO_SCORING_TYPE[phase];
        if (!scoringType) return 0;

        const defaultKey = {
            [ScoringType.PHASE_BONUS_R32]: 'PHASE_BONUS_R32',
            [ScoringType.PHASE_BONUS_R16]: 'PHASE_BONUS_R16',
            [ScoringType.PHASE_BONUS_QF]: 'PHASE_BONUS_QF',
            [ScoringType.PHASE_BONUS_SF]: 'PHASE_BONUS_SF',
            [ScoringType.PHASE_BONUS_FINAL]: 'PHASE_BONUS_FINAL',
        }[scoringType];

        const fallback = DEFAULT_PHASE_BONUS_POINTS[defaultKey] ?? 0;
        return rules.find((rule) => rule.ruleType === scoringType)?.points ?? fallback;
    }

    private async loadUserAwardedPhaseBonuses(
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

    private async loadLeaguePhaseMatches(
        leagueId: string,
        phase: Phase,
    ): Promise<
        Array<{
            id: string;
            status: string;
            homeTeamId: string;
            awayTeamId: string;
            advancingTeamId: string | null;
            homeScore: number | null;
            awayScore: number | null;
            penaltyHomeScore: number | null;
            penaltyAwayScore: number | null;
        }>
    > {
        try {
            const rows = await loadLeaguePhaseMatches(this.prisma, leagueId, phase);
            return rows.filter(
                (row): row is typeof row & { homeTeamId: string; awayTeamId: string } =>
                    Boolean(row.homeTeamId && row.awayTeamId),
            );
        } catch {
            return [];
        }
    }

    private async buildPhaseBonusProgress(
        leagueId: string,
        userId: string,
    ): Promise<PhaseBonusProgressItem[]> {
        const league = await this.prisma.league.findUnique({
            where: { id: leagueId },
            include: { scoringRules: { where: { active: true } } },
        });
        if (!league) return [];

        const awardedMap = new Map(
            (await this.loadUserAwardedPhaseBonuses(leagueId, userId)).map((bonus) => [
                bonus.phase,
                bonus.points,
            ]),
        );

        const progress: PhaseBonusProgressItem[] = [];

        for (const phaseKey of TRACKED_PHASE_BONUS_PHASES) {
            const phase = phaseKey as Phase;
            const maxBonusPoints = this.resolvePhaseBonusPoints(phase, league.scoringRules);

            const phaseMatchesRaw = await this.loadLeaguePhaseMatches(leagueId, phase);
            if (phaseMatchesRaw.length === 0) continue;

            const phaseMatches = selectCountableKnockoutMatches(phaseMatchesRaw, phase);
            if (phaseMatches.length === 0) continue;

            const totalMatches = phaseMatches.length;
            const isPhaseComplete = isKnockoutPhaseComplete(phaseMatches, phase);

            const userPreds = await this.prisma.prediction.findMany({
                where: {
                    leagueId,
                    userId,
                    matchId: { in: phaseMatches.map((match) => match.id) },
                },
                select: {
                    matchId: true,
                    homeScore: true,
                    awayScore: true,
                    advanceTeamId: true,
                },
            });

            const correctCount = countPhaseBonusCorrect(phaseMatches, userPreds);
            const finishedInPhase = phaseMatches.some(
                (match) => match.status === 'FINISHED' && match.advancingTeamId !== null,
            );
            if (maxBonusPoints === 0 && correctCount === 0 && !finishedInPhase) continue;

            const fullyCorrect = totalMatches > 0 && correctCount >= totalMatches;
            const isAwarded = awardedMap.has(phase) && fullyCorrect;
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

    /** Leaderboard compatible con api-corp (sin modelos Prisma PhaseBonus / ParticipationObligation). */
    async buildLeaderboard(
        leagueId: string,
        category: CorpLeaderboardCategory = 'GENERAL',
    ): Promise<CorpLeaderboardRow[]> {
        const members = await this.prisma.leagueMember.findMany({
            where: {
                leagueId,
                status: 'ACTIVE',
                user: { status: 'ACTIVE' },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        avatar: true,
                        documentNumber: true,
                    },
                },
            },
        });

        const allMemberIds = members.map((member) => member.userId);
        const participationKeys = await this.loadParticipationKeys(leagueId, category);
        const eligibleUserIds =
            category === 'GENERAL'
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
                ...(category === 'GENERAL' ? {} : { userId: { in: [...eligibleUserIds] } }),
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

        const userStats = new Map<string, UserStats>();

        for (const prediction of predictions) {
            if (!this.matchesLeaderboardScope(category, prediction, participationKeys)) {
                continue;
            }

            const stats = userStats.get(prediction.userId) ?? {
                points: 0,
                exactCount: 0,
                winnerCount: 0,
                goalCount: 0,
                uniqueCount: 0,
            };
            this.accumulateStats(stats, this.parsePointDetail(prediction.pointDetail), prediction.points ?? 0);
            userStats.set(prediction.userId, stats);
        }

        const phaseBonuses = await this.loadPhaseBonuses(leagueId);
        const bonusByUser = new Map<string, { total: number; hasChampion: boolean }>();

        for (const bonus of phaseBonuses) {
            if (!this.matchesPhaseBonusScope(category, bonus, participationKeys)) {
                continue;
            }
            if (category !== 'GENERAL' && !eligibleUserIds.has(bonus.userId)) {
                continue;
            }

            const current = bonusByUser.get(bonus.userId) ?? { total: 0, hasChampion: false };
            current.total += bonus.points;
            if (bonus.phase === 'FINAL') current.hasChampion = true;
            bonusByUser.set(bonus.userId, current);
        }

        const rows = members
            .filter((member) => category === 'GENERAL' || eligibleUserIds.has(member.userId))
            .map((member) => {
                const stats = userStats.get(member.userId) ?? {
                    points: 0,
                    exactCount: 0,
                    winnerCount: 0,
                    goalCount: 0,
                    uniqueCount: 0,
                };
                const bonus = bonusByUser.get(member.userId) ?? { total: 0, hasChampion: false };

                return {
                    id: member.user.id,
                    username: member.user.documentNumber ?? member.user.username,
                    name: member.user.name,
                    avatar: member.user.avatar,
                    points: stats.points + bonus.total,
                    predictionPoints: stats.points,
                    phaseBonusPoints: bonus.total,
                    hasChampion: bonus.hasChampion,
                    exactCount: stats.exactCount,
                    winnerCount: stats.winnerCount,
                    goalCount: stats.goalCount,
                    uniqueCount: stats.uniqueCount,
                };
            });

        return sortLeaderboardEntries(rows);
    }

    private mapRankedEntries(
        leaderboard: CorpLeaderboardRow[],
        viewerUserId: string,
        limit?: number,
    ) {
        const ranked = assignCompetitionRanks(leaderboard);
        const slice = limit != null ? ranked.slice(0, limit) : ranked;

        return slice.map((entry, index) => {
            const previous = index > 0 ? slice[index - 1] : null;
            const tieBreakNote =
                previous && previous.points === entry.points
                    ? formatTiebreakNote(previous, entry)
                    : null;

            return {
                ...this.mapLeaderboardEntry(entry, entry.rank, viewerUserId),
                tieBreakNote,
            };
        });
    }

    async resolveActiveLeague(tenantId: string): Promise<LeagueWithFees | null> {
        const league = await this.prisma.league.findFirst({
            where: { tenantId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                includeBaseFee: true,
                includeStageFees: true,
            },
        });

        if (!league) return null;

        const stageFees = league.includeStageFees
            ? await this.loadStageFees(league.id)
            : [];

        return { ...league, stageFees };
    }

    buildAvailableCategories(league: LeagueWithFees): CorpLeaderboardCategory[] {
        const categories: CorpLeaderboardCategory[] = [];

        if (league.includeBaseFee !== false) {
            categories.push('GENERAL');
        }

        const activeStageFeeTypes = new Set(
            (league.stageFees ?? [])
                .filter((fee) => fee.active && Number(fee.amount ?? 0) > 0)
                .map((fee) => fee.type.toUpperCase()),
        );

        if (activeStageFeeTypes.has('MATCH')) categories.push('MATCH');
        if (activeStageFeeTypes.has('PHASE')) categories.push('GROUP');
        if (activeStageFeeTypes.has('ROUND')) categories.push('ROUND');

        return categories.length > 0 ? categories : ['GENERAL'];
    }

    normalizeCategory(
        requested: string | undefined,
        available: CorpLeaderboardCategory[],
    ): CorpLeaderboardCategory {
        const normalized = requested?.trim().toUpperCase() as CorpLeaderboardCategory | undefined;
        if (normalized && available.includes(normalized)) {
            return normalized;
        }
        return available[0] ?? 'GENERAL';
    }

    private mapLeaderboardEntry(
        entry: CorpLeaderboardRow,
        rank: number,
        viewerUserId: string,
    ) {
        return {
            rank,
            userId: entry.id,
            name: entry.name,
            username: entry.username,
            avatar: entry.avatar,
            totalPoints: entry.points,
            phaseBonusPoints: entry.phaseBonusPoints ?? 0,
            hasChampion: entry.hasChampion ?? false,
            exactCount: entry.exactCount ?? 0,
            winnerCount: entry.winnerCount ?? 0,
            goalCount: entry.goalCount ?? 0,
            uniqueCount: entry.uniqueCount ?? 0,
            isMe: entry.id === viewerUserId,
        };
    }

    async getRankingPayload(tenantId: string, viewerUserId: string, category?: string) {
        const league = await this.resolveActiveLeague(tenantId);
        if (!league) {
            return {
                league: null as null,
                category: 'GENERAL' as CorpLeaderboardCategory,
                availableCategories: [] as typeof CORP_RANKING_CATEGORY_META,
                entries: [] as ReturnType<CorpRankingService['mapLeaderboardEntry']>[],
                totalParticipants: 0,
                limit: CORP_RANKING_LIMIT,
            };
        }

        const available = this.buildAvailableCategories(league);
        const activeCategory = this.normalizeCategory(category, available);
        await this.refreshPhaseBonusesForLeague(league.id);
        const leaderboard = await this.buildLeaderboard(league.id, activeCategory);

        return {
            league: { id: league.id, name: league.name },
            category: activeCategory,
            availableCategories: CORP_RANKING_CATEGORY_META.filter((item) =>
                available.includes(item.id),
            ),
            entries: this.mapRankedEntries(leaderboard, viewerUserId, CORP_RANKING_LIMIT),
            totalParticipants: leaderboard.length,
            limit: CORP_RANKING_LIMIT,
        };
    }

    async getLeagueRankingSnapshot(
        leagueId: string,
        viewerUserId: string,
        limit = CORP_RANKING_LIMIT,
        category: CorpLeaderboardCategory = 'GENERAL',
    ) {
        await this.refreshPhaseBonusesForLeague(leagueId);
        const leaderboard = await this.buildLeaderboard(leagueId, category);
        const ranked = assignCompetitionRanks(leaderboard);
        const myEntry = ranked.find((entry) => entry.id === viewerUserId);

        return {
            entries: this.mapRankedEntries(leaderboard, viewerUserId, limit),
            totalParticipants: leaderboard.length,
            myPoints: myEntry?.points ?? 0,
            myRank: myEntry?.rank ?? null,
        };
    }

    async getUserBreakdown(
        tenantId: string,
        targetUserId: string,
        category?: string,
    ) {
        const league = await this.resolveActiveLeague(tenantId);
        if (!league) {
            throw new NotFoundException('No hay polla activa para este tenant');
        }

        const available = this.buildAvailableCategories(league);
        const activeCategory = this.normalizeCategory(category, available);
        await this.refreshPhaseBonusesForLeague(league.id, true);

        return this.buildUserBreakdown(league.id, targetUserId, activeCategory);
    }

    private async buildUserBreakdown(
        leagueId: string,
        userId: string,
        category: CorpLeaderboardCategory,
    ) {
        const member = await this.prisma.leagueMember.findFirst({
            where: {
                userId,
                leagueId,
                status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },
                user: { status: 'ACTIVE' },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        avatar: true,
                        documentNumber: true,
                    },
                },
            },
        });

        if (!member) {
            throw new NotFoundException('Participante no encontrado en esta liga');
        }

        const participationKeys = await this.loadParticipationKeys(leagueId, category);

        if (category !== 'GENERAL') {
            const hasParticipation = [...participationKeys].some((key) => key.startsWith(`${userId}:`));
            if (!hasParticipation) {
                return {
                    user: {
                        ...member.user,
                        username: member.user.documentNumber ?? member.user.username,
                    },
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
                        homeTeam: { select: { id: true, name: true, flagUrl: true, code: true, shortCode: true } },
                        awayTeam: { select: { id: true, name: true, flagUrl: true, code: true, shortCode: true } },
                    },
                },
            },
        });

        const filteredPredictions = predictions.filter((prediction) =>
            this.matchesLeaderboardScope(
                category,
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

        const phaseBonuses = (await this.loadPhaseBonuses(leagueId)).filter(
            (bonus) =>
                bonus.userId === userId && this.matchesPhaseBonusScope(category, bonus, participationKeys),
        );

        const summary = filteredPredictions.reduce(
            (acc, prediction) => {
                this.accumulateStats(
                    acc,
                    this.parsePointDetail(prediction.pointDetail),
                    prediction.points ?? 0,
                );
                return acc;
            },
            {
                points: 0,
                exactCount: 0,
                winnerCount: 0,
                goalCount: 0,
                uniqueCount: 0,
            } as UserStats,
        );

        const bonusTotal = phaseBonuses.reduce((sum, bonus) => sum + bonus.points, 0);
        const phaseBonusProgress =
            category === 'GENERAL'
                ? await this.getPhaseBonusProgressForUser(leagueId, userId)
                : [];

        // El progreso vivo ya anula premios stale (ej. 3/4); no sumar PhaseBonus obsoleto al total.
        const liveBonusTotal =
            category === 'GENERAL'
                ? phaseBonusProgress.reduce((sum, item) => sum + item.awardedPoints, 0)
                : bonusTotal;
        const awardedPhases = new Set(
            phaseBonusProgress
                .filter((item) => item.isAwarded && item.awardedPoints > 0)
                .map((item) => item.phase),
        );
        const visibleBonuses =
            category === 'GENERAL'
                ? phaseBonuses.filter((bonus) => awardedPhases.has(bonus.phase))
                : phaseBonuses;

        return {
            user: {
                ...member.user,
                username: member.user.documentNumber ?? member.user.username,
            },
            summary: {
                ...summary,
                points: summary.points + liveBonusTotal,
                phaseBonusPoints: liveBonusTotal,
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
                    status: prediction.match.status,
                    homeScore: prediction.match.homeScore,
                    awayScore: prediction.match.awayScore,
                    penaltyHomeScore: prediction.match.penaltyHomeScore,
                    penaltyAwayScore: prediction.match.penaltyAwayScore,
                    advancingTeamId: prediction.match.advancingTeamId,
                    homeTeam: prediction.match.homeTeam,
                    awayTeam: prediction.match.awayTeam,
                },
            })),
            bonuses: visibleBonuses.map((bonus, index) => ({
                id: `${bonus.userId}-${bonus.phase}-${index}`,
                phase: bonus.phase,
                points: bonus.points,
                awardedAt: new Date().toISOString(),
            })),
            phaseBonusProgress,
        };
    }
}
