import { request, ApiError } from '../api';
import type { CorpRankingBreakdownApiResponse } from './rankingBreakdown';

type CorpLeagueSummary = { id: string; name: string };

type LeaderboardBreakdownResponse = Omit<CorpRankingBreakdownApiResponse, 'matches'> & {
    matches: Array<
        Omit<CorpRankingBreakdownApiResponse['matches'][number], 'leagueId' | 'leagueName'>
    >;
};

function isRouteNotFound(err: unknown): boolean {
    if (!(err instanceof ApiError)) return false;
    if (err.status === 404) return true;
    return err.message.includes('Cannot GET');
}

function isBreakdownRouteMissing(err: unknown): boolean {
    return isRouteNotFound(err);
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

async function fetchBreakdownViaLeagues(userId: string): Promise<CorpRankingBreakdownApiResponse> {
    const leagues = await request<CorpLeagueSummary[]>('/corp/leagues');
    if (!leagues.length) {
        throw new ApiError('No hay pollas corporativas para calcular el detalle de puntos.', { status: 404 });
    }

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

    if (predictionsRouteMissing) {
        throw new ApiError(
            'El backend corporativo aún no expone el desglose de ranking. Redespliega api-corp y reinicia el contenedor.',
            { status: 404 },
        );
    }

    if (!parts.length) {
        if (participantMissingInAllLeagues) {
            throw new ApiError(
                'Este participante no tiene pronósticos puntuados en las pollas del tenant.',
                { status: 404 },
            );
        }
        throw new ApiError('No se pudo cargar el detalle de puntos para este participante.', { status: 404 });
    }

    return mergeBreakdowns(parts);
}

export async function fetchCorpRankingBreakdown(userId: string): Promise<CorpRankingBreakdownApiResponse> {
    try {
        return await request<CorpRankingBreakdownApiResponse>(`/corp/ranking/user/${userId}/breakdown`);
    } catch (err) {
        if (!isBreakdownRouteMissing(err)) throw err;
        return fetchBreakdownViaLeagues(userId);
    }
}
