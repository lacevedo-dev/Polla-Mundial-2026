import { resolveApiAssetUrl } from '../api';

export interface MatchResponse {
    id: string;
    matchDate: string;
    status: string;
    phase: string;
    group?: string | null;
    venue?: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
    advancingTeamId?: string | null;
    homeTeam: {
        id?: string;
        name: string;
        flagUrl?: string | null;
        code?: string | null;
        shortCode?: string | null;
    };
    awayTeam: {
        id?: string;
        name: string;
        flagUrl?: string | null;
        code?: string | null;
        shortCode?: string | null;
    };
}

export interface LeaguePredictionResponse {
    id: string;
    matchId: string;
    homeScore: number;
    awayScore: number;
    points?: number | null;
    advanceTeamId?: string | null;
}

export interface LeaderboardApiEntry {
    id: string;
    username: string;
    name: string;
    avatar?: string | null;
    points: number;
    phaseBonusPoints?: number;
    hasChampion?: boolean;
    exactCount?: number;
    winnerCount?: number;
    goalCount?: number;
    uniqueCount?: number;
}

export type LeaderboardCategory = 'GENERAL' | 'MATCH' | 'GROUP' | 'ROUND';

export interface MatchViewModel {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamCode: string;
    awayTeamCode: string;
    homeTeamId: string;
    awayTeamId: string;
    homeFlag: string;
    awayFlag: string;
    date: string;
    displayDate: string;
    status: 'open' | 'closed' | 'live' | 'finished';
    phase: string;
    group?: string;
    venue: string;
    isKnockout: boolean;
    advancingTeamId?: string;
    prediction: {
        home: string;
        away: string;
        advanceTeamId?: string;
    };
    result?: {
        home: number;
        away: number;
    };
    elapsed?: number | null;
    statusShort?: string | null;
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
    phaseBonusPoints?: number;
    hasChampion?: boolean;
    exactCount?: number;
    winnerCount?: number;
    goalCount?: number;
    uniqueCount?: number;
    trend: 'same';
}

export interface LeaderboardBreakdownApiResponse {
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
    matches: Array<{
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
        } | null;
        prediction: {
            homeScore: number;
            awayScore: number;
            advanceTeamId?: string | null;
        };
        match: MatchResponse;
    }>;
    bonuses: Array<{
        id: string;
        phase: string;
        points: number;
        awardedAt: string;
    }>;
}

export interface LeaderboardBreakdownDetail {
    id: string;
    points: number;
    summaryLabel: string;
    date: string;
    displayDate: string;
    phase: string;
    group?: string;
    venue: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamCode: string;
    awayTeamCode: string;
    homeFlag: string;
    awayFlag: string;
    predictionHome: number;
    predictionAway: number;
    resultHome?: number;
    resultAway?: number;
}

export interface LeaderboardBreakdown {
    user: {
        id: string;
        username: string;
        name: string;
        avatar: string;
    };
    summary: {
        points: number;
        exactCount: number;
        winnerCount: number;
        goalCount: number;
        uniqueCount: number;
        phaseBonusPoints: number;
    };
    matches: LeaderboardBreakdownDetail[];
    bonuses: Array<{
        id: string;
        phase: string;
        points: number;
        awardedAt: string;
    }>;
}

function toPointSummaryLabel(pointDetail?: LeaderboardBreakdownApiResponse['matches'][number]['pointDetail'] | null): string {
    if (!pointDetail) return 'Sin puntos';

    const parts: string[] = [];
    if (pointDetail.exactPoints > 0) parts.push(`Marcador exacto +${pointDetail.exactPoints}`);
    if (pointDetail.winnerPoints > 0) parts.push(`Ganador +${pointDetail.winnerPoints}`);
    if (pointDetail.goalPoints > 0) parts.push(`Gol +${pointDetail.goalPoints}`);
    if (pointDetail.uniqueBonus > 0) parts.push(`Única +${pointDetail.uniqueBonus}`);
    if (!parts.length) return 'Sin puntos';
    return parts.join(' · ');
}

const DEFAULT_FLAG_URL =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 60'%3E%3Crect width='80' height='60' rx='6' fill='%23e2e8f0'/%3E%3Cpath d='M40 10 L56 18 L56 38 C56 47 40 53 40 53 C40 53 24 47 24 38 L24 18 Z' fill='%2394a3b8'/%3E%3Cpath d='M33 30 L37 34 L47 24' stroke='%23e2e8f0' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E";

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

/** Si el partido aún figura como SCHEDULED pero ya pasó su hora, lo cerramos en el frontend. */
function resolveMatchStatus(apiStatus: string, matchDate: string): MatchViewModel['status'] {
    const base = normalizeMatchStatus(apiStatus);
    if (base === 'open' && new Date(matchDate).getTime() < Date.now()) {
        return 'closed';
    }
    return base;
}

function toDisplayDate(matchDate: string): string {
    return matchDate.includes('T') ? matchDate.split('T')[0] : matchDate;
}

function resolveTeamCompactCode(
    shortCode?: string | null,
    code?: string | null,
    name?: string | null,
): string {
    if (shortCode?.trim()) {
        return shortCode.trim().toUpperCase();
    }

    if (code?.trim()) {
        return code.trim().toUpperCase();
    }

    const fallback = (name ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9 ]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => token[0])
        .join('')
        .slice(0, 3)
        .toUpperCase();

    return fallback || 'TBD';
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
    const isKnockout = match.phase?.toUpperCase() !== 'GROUP';

    return {
        id: match.id,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeTeamCode: resolveTeamCompactCode(
            match.homeTeam.shortCode,
            match.homeTeam.code,
            match.homeTeam.name,
        ),
        awayTeamCode: resolveTeamCompactCode(
            match.awayTeam.shortCode,
            match.awayTeam.code,
            match.awayTeam.name,
        ),
        homeTeamId: match.homeTeam.id ?? '',
        awayTeamId: match.awayTeam.id ?? '',
        homeFlag: resolveFlagUrl(match.homeTeam.flagUrl, match.homeTeam.code),
        awayFlag: resolveFlagUrl(match.awayTeam.flagUrl, match.awayTeam.code),
        date: match.matchDate,
        displayDate: toDisplayDate(match.matchDate),
        status: resolveMatchStatus(match.status, match.matchDate),
        phase: match.phase,
        group: match.group ?? undefined,
        venue: match.venue ?? 'Por definir',
        isKnockout,
        advancingTeamId: match.advancingTeamId ?? undefined,
        prediction: {
            home: hasPrediction ? String(prediction?.homeScore ?? '') : '',
            away: hasPrediction ? String(prediction?.awayScore ?? '') : '',
            advanceTeamId: prediction?.advanceTeamId ?? undefined,
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
            avatar: resolveApiAssetUrl(entry.avatar) ?? toAvatar(entry.name),
            points: entry.points,
            phaseBonusPoints: entry.phaseBonusPoints,
            hasChampion: entry.hasChampion,
            exactCount: entry.exactCount,
            winnerCount: entry.winnerCount,
            goalCount: entry.goalCount,
            uniqueCount: entry.uniqueCount,
            trend: 'same',
        }));
}

export function toLeaderboardBreakdown(
    input: LeaderboardBreakdownApiResponse,
): LeaderboardBreakdown {
    return {
        user: {
            ...input.user,
            avatar: resolveApiAssetUrl(input.user.avatar) ?? toAvatar(input.user.name),
        },
        summary: input.summary,
        matches: input.matches.map((item) => ({
            id: item.id,
            points: item.points,
            summaryLabel: toPointSummaryLabel(item.pointDetail),
            date: item.match.matchDate,
            displayDate: toDisplayDate(item.match.matchDate),
            phase: item.match.phase,
            group: item.match.group ?? undefined,
            venue: item.match.venue ?? 'Por definir',
            homeTeam: item.match.homeTeam.name,
            awayTeam: item.match.awayTeam.name,
            homeTeamCode: resolveTeamCompactCode(item.match.homeTeam.shortCode, item.match.homeTeam.code, item.match.homeTeam.name),
            awayTeamCode: resolveTeamCompactCode(item.match.awayTeam.shortCode, item.match.awayTeam.code, item.match.awayTeam.name),
            homeFlag: resolveFlagUrl(item.match.homeTeam.flagUrl, item.match.homeTeam.code),
            awayFlag: resolveFlagUrl(item.match.awayTeam.flagUrl, item.match.awayTeam.code),
            predictionHome: item.prediction.homeScore,
            predictionAway: item.prediction.awayScore,
            resultHome: item.match.homeScore ?? undefined,
            resultAway: item.match.awayScore ?? undefined,
        })),
        bonuses: input.bonuses,
    };
}
