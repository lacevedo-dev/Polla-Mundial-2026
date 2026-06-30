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

export type QuickPredictionDraft = {
    home: string;
    away: string;
    advanceTeamId?: string;
};

export function resolveQuickDraftAdvanceTeamId(
    match: {
        isKnockout: boolean;
        homeTeamId: string;
        awayTeamId: string;
        prediction: { home: string; away: string; advanceTeamId?: string };
    },
    draft?: Partial<QuickPredictionDraft>,
): string | undefined {
    const home = draft?.home ?? match.prediction.home ?? '';
    const away = draft?.away ?? match.prediction.away ?? '';

    if (!match.isKnockout) {
        return draft?.advanceTeamId ?? match.prediction.advanceTeamId;
    }

    return (
        draft?.advanceTeamId ??
        match.prediction.advanceTeamId ??
        resolveAdvanceTeamIdFromScore(home, away, match.homeTeamId, match.awayTeamId)
    );
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
