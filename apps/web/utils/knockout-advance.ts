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
