import { request, ApiError, getLastCorpDeployStamp } from '../api';
import type { CorpRankingBreakdownApiResponse } from './rankingBreakdown';

type CorpLeagueSummary = { id: string; name: string };

type LeaderboardBreakdownResponse = Omit<CorpRankingBreakdownApiResponse, 'matches'> & {
    matches: Array<
        Omit<CorpRankingBreakdownApiResponse['matches'][number], 'leagueId' | 'leagueName'>
    >;
};

type LeagueDetailWithBreakdown = {
    memberPointsBreakdown?: CorpRankingBreakdownApiResponse;
};

type CorpHealthResponse = {
    deployStamp?: string | null;
    buildMarker?: string;
    buildGitCommit?: string;
};

type CorpPingResponse = {
    ok?: boolean;
    buildMarker?: string;
    deployStamp?: string | null;
};

const EXPECTED_BUILD_MARKER = 'ranking-breakdown-v5';

const BREAKDOWN_PATHS = [
    (userId: string) => `/corp/member-points/${userId}`,
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

function isRankingListPayload(data: unknown): boolean {
    return Array.isArray(data);
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

async function readBackendDeployStatus(): Promise<string> {
    const headerStamp = getLastCorpDeployStamp();
    let health: CorpHealthResponse | null = null;
    let ping: CorpPingResponse | null = null;

    try {
        health = await request<CorpHealthResponse>('/health');
    } catch {
        /* ignore */
    }

    try {
        ping = await request<CorpPingResponse>('/corp-api-ping');
    } catch {
        /* ignore */
    }

    const marker = ping?.buildMarker ?? health?.buildMarker;
    const stamp = ping?.deployStamp ?? health?.deployStamp ?? headerStamp;

    if (marker === EXPECTED_BUILD_MARKER || stamp === EXPECTED_BUILD_MARKER) {
        return 'updated';
    }

    return JSON.stringify({
        headerStamp,
        health,
        ping,
        expected: EXPECTED_BUILD_MARKER,
    });
}

async function fetchBreakdownViaLeagueDetails(userId: string): Promise<CorpRankingBreakdownApiResponse | null> {
    const leagues = await request<CorpLeagueSummary[]>('/corp/leagues');
    if (!leagues.length) return null;

    const parts: CorpRankingBreakdownApiResponse[] = [];

    for (const league of leagues) {
        try {
            const detail = await request<LeagueDetailWithBreakdown>(
                `/corp/leagues/${league.id}?scoredForUserId=${encodeURIComponent(userId)}`,
            );
            const breakdown = detail.memberPointsBreakdown;
            if (!breakdown?.matches?.length) continue;
            parts.push({
                user: breakdown.user,
                summary: breakdown.summary,
                bonuses: breakdown.bonuses,
                matches: breakdown.matches.map((match) => ({
                    ...match,
                    leagueName: match.leagueName || league.name,
                })),
            });
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) continue;
            throw err;
        }
    }

    if (!parts.length) return null;
    return mergeBreakdowns(parts);
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
            if (buildPath(userId).includes('breakdownUserId') && isRankingListPayload(data)) {
                break;
            }
        } catch (err) {
            if (!isRouteNotFound(err)) throw err;
        }
    }
    return null;
}

function buildStaleBackendMessage(diagnostics: string): string {
    return (
        'El dominio api-polla-coop sigue sirviendo un contenedor antiguo (sin ranking-breakdown-v5). ' +
        'En Dokploy: app Backend → Stop → elimina el contenedor → Clean Cache → Deploy. ' +
        'Verifica https://api-polla-coop.atencionesvirtuales.com.co/corp-api-ping debe mostrar buildMarker v5. ' +
        `Diagnóstico: ${diagnostics}`
    );
}

export async function fetchCorpRankingBreakdown(userId: string): Promise<CorpRankingBreakdownApiResponse> {
    const deployStatus = await readBackendDeployStatus();

    const direct = await fetchCorpBreakdownDirect(userId);
    if (direct) return direct;

    const viaLeagueDetails = await fetchBreakdownViaLeagueDetails(userId);
    if (viaLeagueDetails) return viaLeagueDetails;

    const viaLeagues = await fetchBreakdownViaLeagues(userId);
    if (viaLeagues) return viaLeagues;

    throw new ApiError(buildStaleBackendMessage(deployStatus), { status: 404 });
}
