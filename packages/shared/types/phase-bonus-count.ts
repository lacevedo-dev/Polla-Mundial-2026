export type PhaseBonusMatchForCount = {
    id: string;
    status: string;
    homeTeamId: string;
    awayTeamId: string;
    advancingTeamId: string | null;
    homeScore?: number | null;
    awayScore?: number | null;
    penaltyHomeScore?: number | null;
    penaltyAwayScore?: number | null;
};

export type PhaseBonusPredictionForCount = {
    matchId: string;
    homeScore: number;
    awayScore: number;
    advanceTeamId: string | null;
};

/**
 * Clasificado efectivo del pronóstico:
 * - Marcador decisivo → ganador del marcador (ignora advanceTeamId obsoleto).
 * - Empate → pick explícito de penales (advanceTeamId).
 */
export function resolveEffectiveAdvanceTeamId(
    prediction: PhaseBonusPredictionForCount,
    match: Pick<PhaseBonusMatchForCount, 'homeTeamId' | 'awayTeamId'>,
): string | null {
    if (prediction.homeScore > prediction.awayScore) {
        return match.homeTeamId;
    }
    if (prediction.awayScore > prediction.homeScore) {
        return match.awayTeamId;
    }
    return prediction.advanceTeamId;
}

/** El partido real se definió en penales (tanda o marcador empatado con clasificado). */
export function matchDecidedOnPenalties(match: PhaseBonusMatchForCount): boolean {
    if (match.penaltyHomeScore != null && match.penaltyAwayScore != null) {
        return true;
    }
    return (
        match.homeScore != null &&
        match.awayScore != null &&
        match.homeScore === match.awayScore &&
        match.advancingTeamId != null
    );
}

/**
 * Acierto de clasificado para bono de fase.
 * Un empate predicho solo cuenta si el partido real también se definió en penales;
 * si el partido se resolvió en el marcador (ej. 2-1), el pick de penales no otorga el acierto.
 */
export function isPhaseBonusAdvanceCorrect(
    prediction: PhaseBonusPredictionForCount,
    match: PhaseBonusMatchForCount,
): boolean {
    if (match.status !== 'FINISHED' || !match.advancingTeamId) {
        return false;
    }

    const effectiveAdvance = resolveEffectiveAdvanceTeamId(prediction, match);
    if (!effectiveAdvance || effectiveAdvance !== match.advancingTeamId) {
        return false;
    }

    if (prediction.homeScore === prediction.awayScore) {
        return matchDecidedOnPenalties(match);
    }

    return true;
}

export function countPhaseBonusCorrect(
    phaseMatches: PhaseBonusMatchForCount[],
    predictions: PhaseBonusPredictionForCount[],
): number {
    const predByMatch = new Map(predictions.map((pred) => [pred.matchId, pred]));
    let correctCount = 0;

    for (const match of phaseMatches) {
        if (match.status !== 'FINISHED' || !match.advancingTeamId) continue;
        const prediction = predByMatch.get(match.id);
        if (!prediction) continue;
        if (isPhaseBonusAdvanceCorrect(prediction, match)) {
            correctCount += 1;
        }
    }

    return correctCount;
}
