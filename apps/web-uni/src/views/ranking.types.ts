export type LeaderboardCategory = 'GENERAL' | 'MATCH' | 'GROUP' | 'ROUND';

export interface RankingCategoryMeta {
    id: LeaderboardCategory;
    label: string;
}

export interface CorpRankingEntry {
    rank: number;
    userId: string;
    name: string;
    username: string;
    avatar: string | null;
    totalPoints: number;
    phaseBonusPoints: number;
    hasChampion: boolean;
    exactCount: number;
    winnerCount: number;
    goalCount: number;
    uniqueCount: number;
    isMe: boolean;
}

export interface CorpRankingResponse {
    league: { id: string; name: string } | null;
    category: LeaderboardCategory;
    availableCategories: RankingCategoryMeta[];
    entries: CorpRankingEntry[];
    totalParticipants: number;
    limit: number;
}

export interface RankingBreakdownMatch {
    id: string;
    points: number;
    submittedAt: string;
    pointDetail?: {
        type: string;
        exactPoints: number;
        winnerPoints: number;
        goalPoints: number;
        uniqueBonus: number;
        basePoints: number;
        phase: string;
        multiplier: number;
        total: number;
        explanation?: string;
    } | null;
    prediction: {
        homeScore: number;
        awayScore: number;
        advanceTeamId?: string | null;
    };
    match: {
        id: string;
        matchDate: string;
        phase: string;
        group?: string | null;
        venue?: string | null;
        homeScore?: number | null;
        awayScore?: number | null;
        homeTeam: { name: string };
        awayTeam: { name: string };
    };
}

export interface RankingBreakdownResponse {
    user: {
        id: string;
        username: string;
        name: string;
        avatar?: string | null;
    };
    summary: {
        points: number;
        exactCount: number;
        winnerCount: number;
        goalCount: number;
        uniqueCount: number;
        phaseBonusPoints: number;
    };
    matches: RankingBreakdownMatch[];
    bonuses: Array<{
        id: string;
        phase: string;
        points: number;
        awardedAt: string;
    }>;
}
