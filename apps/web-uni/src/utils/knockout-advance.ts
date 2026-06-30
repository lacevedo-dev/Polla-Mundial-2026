export function parseDraftScore(value: string): number | null {
    if (value === '') {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

export function isKnockoutDraftTie(home: string, away: string): boolean {
    const homeScore = parseDraftScore(home);
    const awayScore = parseDraftScore(away);
    return homeScore !== null && awayScore !== null && homeScore === awayScore;
}

export function resolveAdvanceTeamIdFromScore(
    home: string,
    away: string,
    homeTeamId: string,
    awayTeamId: string,
): string | undefined {
    const homeScore = parseDraftScore(home);
    const awayScore = parseDraftScore(away);

    if (homeScore === null || awayScore === null) {
        return undefined;
    }

    if (homeScore > awayScore) {
        return homeTeamId;
    }

    if (awayScore > homeScore) {
        return awayTeamId;
    }

    return undefined;
}

export function requiresKnockoutAdvanceSelection(home: string, away: string, advanceTeamId?: string): boolean {
    return isKnockoutDraftTie(home, away) && !advanceTeamId;
}

export function isKnockoutPhase(phase?: string | null): boolean {
    return !!phase && phase !== 'GROUP' && phase !== 'THIRD_PLACE';
}

/** API-Football: P/BT = tanda en curso; PEN = partido ya finalizado tras penales. */
export function isPenaltyPhaseStatus(statusShort?: string | null): boolean {
    return statusShort === 'P' || statusShort === 'BT' || statusShort === 'PEN';
}

export function isLiveScoreTied(result?: { home: number; away: number } | null): boolean {
    return !!result && result.home === result.away;
}

export function resolvePredictionAdvanceTeamId(
    homeTeamId: string,
    awayTeamId: string,
    draft: { home: string; away: string; advanceTeamId?: string },
): string | undefined {
    return (
        resolveAdvanceTeamIdFromScore(draft.home, draft.away, homeTeamId, awayTeamId) ??
        draft.advanceTeamId
    );
}

export type LiveAdvancePickStatus = 'pending_penalties' | 'winning' | 'losing';

export function getLiveAdvancePickStatus(params: {
    resolvedAdvanceTeamId?: string;
    advancingTeamId?: string;
    result?: { home: number; away: number };
    statusShort?: string | null;
}): LiveAdvancePickStatus | null {
    const { resolvedAdvanceTeamId, advancingTeamId, result, statusShort } = params;
    if (!resolvedAdvanceTeamId) {
        return null;
    }

    if (advancingTeamId) {
        return resolvedAdvanceTeamId === advancingTeamId ? 'winning' : 'losing';
    }

    if (isPenaltyPhaseStatus(statusShort) || isLiveScoreTied(result)) {
        return 'pending_penalties';
    }

    return null;
}

export type MatchUiStatus = 'open' | 'live' | 'finished';

export function resolveMatchUiStatus(apiStatus: string): MatchUiStatus {
    if (['LIVE', 'IN_PLAY', 'HALFTIME'].includes(apiStatus)) {
        return 'live';
    }
    if (['FINISHED', 'FT'].includes(apiStatus)) {
        return 'finished';
    }
    return 'open';
}

export function buildKnockoutAdvanceMatch(
    match: {
        id: string;
        status: string;
        homeTeam: { id: string };
        awayTeam: { id: string };
        homeScore: number | null;
        awayScore: number | null;
        advancingTeamId?: string | null;
        phase?: string | null;
        statusShort?: string | null;
    },
    homeTeamCode: string,
    awayTeamCode: string,
) {
    return {
        id: match.id,
        homeTeamId: match.homeTeam.id,
        awayTeamId: match.awayTeam.id,
        homeTeamCode,
        awayTeamCode,
        advancingTeamId: match.advancingTeamId,
        isKnockout: isKnockoutPhase(match.phase),
        status: resolveMatchUiStatus(match.status),
        statusShort: match.statusShort ?? null,
        result:
            match.homeScore != null && match.awayScore != null
                ? { home: match.homeScore, away: match.awayScore }
                : undefined,
    };
}
