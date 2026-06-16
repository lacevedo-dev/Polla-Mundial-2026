import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class CorpRankingService {
    constructor(private readonly prisma: PrismaService) {}

    private parsePointDetail(pointDetail: string | null): PointDetail | null {
        if (!pointDetail) return null;
        try {
            return JSON.parse(pointDetail) as PointDetail;
        } catch {
            return null;
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

    private sortLeaderboardRows(rows: CorpLeaderboardRow[]): CorpLeaderboardRow[] {
        return [...rows].sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.hasChampion !== a.hasChampion) return b.hasChampion ? 1 : -1;
            if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
            if (b.winnerCount !== a.winnerCount) return b.winnerCount - a.winnerCount;
            if (b.goalCount !== a.goalCount) return b.goalCount - a.goalCount;
            return b.uniqueCount - a.uniqueCount;
        });
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

        return this.sortLeaderboardRows(rows);
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
        const leaderboard = await this.buildLeaderboard(league.id, activeCategory);

        return {
            league: { id: league.id, name: league.name },
            category: activeCategory,
            availableCategories: CORP_RANKING_CATEGORY_META.filter((item) =>
                available.includes(item.id),
            ),
            entries: leaderboard
                .slice(0, CORP_RANKING_LIMIT)
                .map((entry, index) => this.mapLeaderboardEntry(entry, index + 1, viewerUserId)),
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
        const leaderboard = await this.buildLeaderboard(leagueId, category);
        const myIndex = leaderboard.findIndex((entry) => entry.id === viewerUserId);

        return {
            entries: leaderboard
                .slice(0, limit)
                .map((entry, index) => this.mapLeaderboardEntry(entry, index + 1, viewerUserId)),
            totalParticipants: leaderboard.length,
            myPoints: myIndex >= 0 ? leaderboard[myIndex].points : 0,
            myRank: myIndex >= 0 ? myIndex + 1 : null,
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

        return {
            user: {
                ...member.user,
                username: member.user.documentNumber ?? member.user.username,
            },
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
            bonuses: phaseBonuses.map((bonus, index) => ({
                id: `${bonus.userId}-${bonus.phase}-${index}`,
                phase: bonus.phase,
                points: bonus.points,
                awardedAt: new Date().toISOString(),
            })),
        };
    }
}
