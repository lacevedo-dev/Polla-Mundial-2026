import { request, ApiError } from '../api';
import type { CorpRankingBreakdownApiResponse } from './rankingBreakdown';

type CorpLeagueSummary = { id: string; name: string };

type LeaderboardBreakdownResponse = Omit<CorpRankingBreakdownApiResponse, 'matches'> & {
    matches: Array<
        Omit<CorpRankingBreakdownApiResponse['matches'][number], 'leagueId' | 'leagueName'>
    >;
};

const BREAKDOWN_PATHS = [
    (userId: string) =>
        `/corp/ranking?breakdownUserId=${encodeURIComponent(userId)}`,
    (userId: string) => `/corp/ranking/user/${userId}/breakdown`,
    (userId: string) => `/corp/ranking-breakdown/${userId}`,
] as const;

function isBreakdownPayload(data: unknown): data is CorpRankingBreakdownApiResponse {
    if (!data || typeof data !== 'object') return false;
    const record = data as Record<string, unknown>;
    return Array.isArray(record.matches) && record.summary !== undefined && record.user !== undefined;
}

function isRouteNotFound(err: unknown): boolean {
    if (!(err instanceof ApiError)) return false;
    if (err.status === 404) return true;
    return err.message.includes('Cannot GET');
}

function isPredictionsRouteMissing(err: unknown): boolean {
    if (!(err instanceof ApiError)) return false;
    return err.status === 404 && err.message.includes('Cannot GET');
}

function isParticipantMissing(err: unknown): boolean {
    if (!(err instanceof ApiError)) return false;
    if (err.status !== 404) return false;
    const msg = err.message.toLowerCase();
    return msg.includes('participante') || msg.includes('not found') || msg.includes('no encontrado');
}

function mergeBreakdowns(
    parts: CorpRankingBreakdownApiResponse[],
): CorpRankingBreakdownApiResponse {
    const user = parts[0].user;
    const matches = parts.flatMap((part) => part.matches);
    const bonuses = parts.flatMap((part) => part.bonuses);

    const summary = {
        points: 0,
        exactCount: 0,
        winnerCount: 0,
        goalCount: 0,
        uniqueCount: 0,
        phaseBonusPoints: 0,
    };

    for (const part of parts) {
        summary.points += part.summary.points;
        summary.exactCount += part.summary.exactCount;
        summary.winnerCount += part.summary.winnerCount;
        summary.goalCount += part.summary.goalCount;
        summary.uniqueCount += part.summary.uniqueCount;
        summary.phaseBonusPoints += part.summary.phaseBonusPoints;
    }

    return { user, summary, matches, bonuses };
}

async function fetchBreakdownViaLeagues(userId: string): Promise<CorpRankingBreakdownApiResponse | null> {
    const leagues = await request<CorpLeagueSummary[]>('/corp/leagues');
    if (!leagues.length) return null;

    const parts: CorpRankingBreakdownApiResponse[] = [];
    let predictionsRouteMissing = false;
    let participantMissingInAllLeagues = true;

    for (const league of leagues) {
        try {
            const data = await request<LeaderboardBreakdownResponse>(
                `/predictions/leaderboard/${league.id}/user/${userId}`,
            );
            participantMissingInAllLeagues = false;
            parts.push({
                user: data.user,
                summary: data.summary,
                bonuses: data.bonuses,
                matches: data.matches
                    .filter((match) => match.points > 0)
                    .map((match) => ({
                        ...match,
                        leagueId: league.id,
                        leagueName: league.name,
                    })),
            });
        } catch (err) {
            if (isPredictionsRouteMissing(err)) {
                predictionsRouteMissing = true;
                break;
            }
            if (isParticipantMissing(err)) continue;
            if (err instanceof ApiError && err.status === 404) continue;
            throw err;
        }
    }

    if (predictionsRouteMissing || !parts.length) {
        return null;
    }

    if (participantMissingInAllLeagues) {
        throw new ApiError(
            'Este participante no tiene pronósticos puntuados en las pollas del tenant.',
            { status: 404 },
        );
    }

    return mergeBreakdowns(parts);
}

async function fetchCorpBreakdownDirect(userId: string): Promise<CorpRankingBreakdownApiResponse | null> {
    for (const buildPath of BREAKDOWN_PATHS) {
        try {
            const data = await request<unknown>(buildPath(userId));
            if (isBreakdownPayload(data)) {
                return data;
            }
        } catch (err) {
            if (!isRouteNotFound(err)) throw err;
        }
    }
    return null;
}

const STALE_BACKEND_MESSAGE =
    'El backend api-corp en api-polla-coop no se ha actualizado. En Dokploy despliega la app Backend ' +
    '(dominio api-polla-coop), con Clean Cache, y confirma que /health incluye buildGitCommit.';

export async function fetchCorpRankingBreakdown(userId: string): Promise<CorpRankingBreakdownApiResponse> {
    const direct = await fetchCorpBreakdownDirect(userId);
    if (direct) return direct;

    const viaLeagues = await fetchBreakdownViaLeagues(userId);
    if (viaLeagues) return viaLeagues;

    throw new ApiError(STALE_BACKEND_MESSAGE, { status: 404 });
}
