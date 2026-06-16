import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionsService } from '../predictions/predictions.service';

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
    stageFees: Array<{ type: string; amount: number; active: boolean }>;
};

@Injectable()
export class CorpRankingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly predictionsService: PredictionsService,
    ) {}

    /** Polla activa del tenant: la liga ACTIVE más reciente (opción A). */
    async resolveActiveLeague(tenantId: string): Promise<LeagueWithFees | null> {
        return this.prisma.league.findFirst({
            where: { tenantId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                includeBaseFee: true,
                stageFees: {
                    select: { type: true, amount: true, active: true },
                },
            },
        });
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
        entry: Awaited<ReturnType<PredictionsService['getLeaderboard']>>[number],
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
        const leaderboard = await this.predictionsService.getLeaderboard(league.id, activeCategory);

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
        const leaderboard = await this.predictionsService.getLeaderboard(leagueId, category);
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

        return this.predictionsService.getLeaderboardUserBreakdown(
            league.id,
            targetUserId,
            activeCategory,
        );
    }
}
