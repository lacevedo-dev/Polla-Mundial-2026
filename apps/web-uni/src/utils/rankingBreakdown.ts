import { resolveApiAssetUrl } from '../api';
import type { PointDetail } from '../components/PointsBreakdown';

const DEFAULT_FLAG_URL =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 60'%3E%3Crect width='80' height='60' rx='6' fill='%23e2e8f0'/%3E%3Cpath d='M40 10 L56 18 L56 38 C56 47 40 53 40 53 C40 53 24 47 24 38 L24 18 Z' fill='%2394a3b8'/%3E%3Cpath d='M33 30 L37 34 L47 24' stroke='%23e2e8f0' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E";

export interface CorpRankingBreakdownApiResponse {
    user: { id: string; username: string; name: string; avatar: string | null };
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
        leagueId: string;
        leagueName: string;
        points: number;
        submittedAt: string;
        pointDetail: PointDetail | null;
        prediction: { homeScore: number; awayScore: number; advanceTeamId?: string | null };
        match: {
            id: string;
            matchDate: string;
            phase: string;
            group: string | null;
            venue: string | null;
            homeScore: number | null;
            awayScore: number | null;
            homeTeam: { id: string; name: string; code: string; shortCode?: string | null; flagUrl?: string | null };
            awayTeam: { id: string; name: string; code: string; shortCode?: string | null; flagUrl?: string | null };
        };
    }>;
    bonuses: Array<{ id: string; phase: string; points: number; awardedAt: string }>;
}

export interface CorpRankingBreakdownMatch {
    id: string;
    leagueName: string;
    points: number;
    summaryLabel: string;
    pointDetail: PointDetail | null;
    displayDate: string;
    phase: string;
    group?: string;
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

export interface CorpRankingBreakdown {
    user: CorpRankingBreakdownApiResponse['user'];
    summary: CorpRankingBreakdownApiResponse['summary'];
    matches: CorpRankingBreakdownMatch[];
    bonuses: CorpRankingBreakdownApiResponse['bonuses'];
}

function toDisplayDate(matchDate: string): string {
    const date = new Date(matchDate);
    if (Number.isNaN(date.getTime())) return matchDate;
    return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

function resolveTeamCompactCode(
    shortCode?: string | null,
    code?: string | null,
    name?: string | null,
): string {
    if (shortCode?.trim()) return shortCode.trim().toUpperCase();
    if (code?.trim()) return code.trim().toUpperCase();
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
    const resolved = resolveApiAssetUrl(flagUrl);
    if (resolved) return resolved;
    if (code && code.length === 2) return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
    return DEFAULT_FLAG_URL;
}

function toPointSummaryLabel(pointDetail: PointDetail | null): string {
    if (!pointDetail) return 'Puntos registrados';
    if (pointDetail.explanation) return pointDetail.explanation;
    const parts: string[] = [];
    if (pointDetail.exactPoints > 0) parts.push(`Marcador exacto +${pointDetail.exactPoints}`);
    if (pointDetail.winnerPoints > 0) parts.push(`Ganador +${pointDetail.winnerPoints}`);
    if (pointDetail.goalPoints > 0) parts.push(`Gol +${pointDetail.goalPoints}`);
    if (pointDetail.uniqueBonus > 0) parts.push(`Única +${pointDetail.uniqueBonus}`);
    return parts.length ? parts.join(' · ') : 'Puntos registrados';
}

export function toCorpRankingBreakdown(input: CorpRankingBreakdownApiResponse): CorpRankingBreakdown {
    return {
        user: input.user,
        summary: input.summary,
        matches: input.matches.map((item) => ({
            id: item.id,
            leagueName: item.leagueName,
            points: item.points,
            summaryLabel: toPointSummaryLabel(item.pointDetail),
            pointDetail: item.pointDetail,
            displayDate: toDisplayDate(item.match.matchDate),
            phase: item.match.phase,
            group: item.match.group ?? undefined,
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
