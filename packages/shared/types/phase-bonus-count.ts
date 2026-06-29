export type PhaseBonusMatchForCount = {
    id: string;
    status: string;
    homeTeamId: string;
    awayTeamId: string;
    advancingTeamId: string | null;
};

export type PhaseBonusPredictionForCount = {
    matchId: string;
    homeScore: number;
    awayScore: number;
    advanceTeamId: string | null;
};

/** Clasificado efectivo: advanceTeamId explícito o ganador inferido del marcador (sin empate). */
export function resolveEffectiveAdvanceTeamId(
    prediction: PhaseBonusPredictionForCount,
    match: Pick<PhaseBonusMatchForCount, 'homeTeamId' | 'awayTeamId'>,
): string | null {
    if (prediction.advanceTeamId) {
        return prediction.advanceTeamId;
    }
    if (prediction.homeScore > prediction.awayScore) {
        return match.homeTeamId;
    }
    if (prediction.awayScore > prediction.homeScore) {
        return match.awayTeamId;
    }
    return null;
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
        const effectiveAdvance = resolveEffectiveAdvanceTeamId(prediction, match);
        if (effectiveAdvance === match.advancingTeamId) {
            correctCount += 1;
        }
    }

    return correctCount;
}
