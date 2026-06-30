export interface Team {
    id: string;
    name: string;
    shortCode: string | null;
    flagUrl: string | null;
    code: string;
}

export interface UpcomingMatch {
    id: string;
    matchDate: string;
    status: string;
    statusShort?: string | null;
    elapsed?: number | null;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: Team;
    awayTeam: Team;
    phase?: string | null;
    group?: string | null;
    venue?: string | null;
    advancingTeamId?: string | null;
    myPrediction: { homeScore: number; awayScore: number; points: number | null; advanceTeamId?: string | null } | null;
}

export interface RecentPrediction {
    matchId: string;
    matchDate: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    predictedHome: number;
    predictedAway: number;
    points: number | null;
}

export interface TopRankEntry {
    userId: string;
    name: string;
    username: string | null;
    avatar: string | null;
    totalPoints: number;
    rank: number;
    isMe: boolean;
}

export interface ScoringRule {
    ruleType: string;
    points: number;
    description: string | null;
    multiplier: number;
}

export interface LeagueDetail {
    id: string;
    name: string;
    description: string | null;
    status: string;
    participantsCount: number;
    maxParticipants: number;
    closePredictionMinutes: number;
    myPoints: number;
    myRank: number;
    scoringRules: ScoringRule[];
    upcomingMatches: UpcomingMatch[];
    recentPredictions: RecentPrediction[];
    topRanking: TopRankEntry[];
}
