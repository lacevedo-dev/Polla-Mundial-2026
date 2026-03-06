export interface MatchResponse {
    id: string;
    matchDate: string;
    status: string;
    phase: string;
    group?: string | null;
    venue?: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
    homeTeam: {
        name: string;
        flagUrl?: string | null;
        code?: string | null;
    };
    awayTeam: {
        name: string;
        flagUrl?: string | null;
        code?: string | null;
    };
}

export interface LeaguePredictionResponse {
    id: string;
    matchId: string;
    homeScore: number;
    awayScore: number;
    points?: number | null;
}

export interface LeaderboardApiEntry {
    id: string;
    username: string;
    name: string;
    avatar?: string | null;
    points: number;
}

export interface MatchViewModel {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeFlag: string;
    awayFlag: string;
    date: string;
    displayDate: string;
    status: 'open' | 'closed' | 'live' | 'finished';
    phase: string;
    group?: string;
    venue: string;
    prediction: {
        home: string;
        away: string;
    };
    result?: {
        home: number;
        away: number;
    };
    pointsEarned?: number;
    saved: boolean;
}

export interface LeaderboardRow {
    id: string;
    rank: number;
    username: string;
    name: string;
    avatar: string;
    points: number;
    trend: 'same';
}

const DEFAULT_FLAG_URL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

function normalizeMatchStatus(status: string): MatchViewModel['status'] {
    switch (status) {
        case 'LIVE':
            return 'live';
        case 'FINISHED':
            return 'finished';
        case 'POSTPONED':
        case 'CANCELLED':
            return 'closed';
        default:
            return 'open';
    }
}

function toDisplayDate(matchDate: string): string {
    return matchDate.includes('T') ? matchDate.split('T')[0] : matchDate;
}

function resolveFlagUrl(flagUrl?: string | null, code?: string | null): string {
    if (flagUrl) {
        return flagUrl;
    }

    if (code && code.length === 2) {
        return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
    }

    return DEFAULT_FLAG_URL;
}

function toAvatar(name: string): string {
    const encoded = encodeURIComponent(name || 'Jugador');
    return `https://ui-avatars.com/api/?name=${encoded}&background=E2E8F0&color=0F172A`;
}

export function toMatchViewModel(
    match: MatchResponse,
    prediction?: LeaguePredictionResponse,
): MatchViewModel {
    const hasPrediction = Boolean(prediction);

    return {
        id: match.id,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeFlag: resolveFlagUrl(match.homeTeam.flagUrl, match.homeTeam.code),
        awayFlag: resolveFlagUrl(match.awayTeam.flagUrl, match.awayTeam.code),
        date: match.matchDate,
        displayDate: toDisplayDate(match.matchDate),
        status: normalizeMatchStatus(match.status),
        phase: match.phase,
        group: match.group ?? undefined,
        venue: match.venue ?? 'Por definir',
        prediction: {
            home: hasPrediction ? String(prediction?.homeScore ?? '') : '',
            away: hasPrediction ? String(prediction?.awayScore ?? '') : '',
        },
        result:
            typeof match.homeScore === 'number' && typeof match.awayScore === 'number'
                ? {
                      home: match.homeScore,
                      away: match.awayScore,
                  }
                : undefined,
        pointsEarned: prediction?.points ?? undefined,
        saved: hasPrediction,
    };
}

export function mergeLeaguePredictions(
    matches: MatchResponse[],
    predictions: LeaguePredictionResponse[],
): MatchViewModel[] {
    const predictionsByMatchId = new Map(
        predictions.map((prediction) => [prediction.matchId, prediction] as const),
    );

    return matches.map((match) => toMatchViewModel(match, predictionsByMatchId.get(match.id)));
}

export function toLeaderboardRows(entries: LeaderboardApiEntry[]): LeaderboardRow[] {
    return [...entries]
        .sort((left, right) => right.points - left.points)
        .map((entry, index) => ({
            id: entry.id,
            rank: index + 1,
            username: entry.username,
            name: entry.name,
            avatar: entry.avatar ?? toAvatar(entry.name),
            points: entry.points,
            trend: 'same',
        }));
}
