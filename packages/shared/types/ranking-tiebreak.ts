export interface TiebreakStats {
    points: number;
    hasChampion: boolean;
    exactCount: number;
    winnerCount: number;
    goalCount: number;
    uniqueCount: number;
}

export const TIEBREAK_CRITERIA = [
    { id: 'points', label: 'Puntos totales', icon: '🏅' },
    { id: 'champion', label: 'Campeón acertado', icon: '🏆' },
    { id: 'exact', label: 'Marcadores exactos', icon: '🎯' },
    { id: 'winner', label: 'Ganadores acertados', icon: '✅' },
    { id: 'goals', label: 'Goles acertados', icon: '⚽' },
    { id: 'unique', label: 'Predicciones únicas', icon: '⭐' },
] as const;

export type TiebreakCriterionId = (typeof TIEBREAK_CRITERIA)[number]['id'];

/** Orden de desempate: puntos → campeón → exactos → ganadores → goles → únicos. */
export function compareLeaderboardEntries(a: TiebreakStats, b: TiebreakStats): number {
    if (b.points !== a.points) return b.points - a.points;
    if (b.hasChampion !== a.hasChampion) return b.hasChampion ? 1 : -1;
    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
    if (b.winnerCount !== a.winnerCount) return b.winnerCount - a.winnerCount;
    if (b.goalCount !== a.goalCount) return b.goalCount - a.goalCount;
    return b.uniqueCount - a.uniqueCount;
}

export function sortLeaderboardEntries<T extends TiebreakStats>(rows: T[]): T[] {
    return [...rows].sort(compareLeaderboardEntries);
}

export function areFullyTied(a: TiebreakStats, b: TiebreakStats): boolean {
    return (
        a.points === b.points
        && a.hasChampion === b.hasChampion
        && a.exactCount === b.exactCount
        && a.winnerCount === b.winnerCount
        && a.goalCount === b.goalCount
        && a.uniqueCount === b.uniqueCount
    );
}

/** Ranking competitivo: misma posición si empatan en todos los criterios. */
export function assignCompetitionRanks<T extends TiebreakStats>(
    sorted: T[],
): Array<T & { rank: number }> {
    const result: Array<T & { rank: number }> = [];

    for (let i = 0; i < sorted.length; i++) {
        const rank =
            i === 0 || !areFullyTied(sorted[i - 1], sorted[i])
                ? i + 1
                : result[i - 1].rank;
        result.push({ ...sorted[i], rank });
    }

    return result;
}

export interface TiebreakResolution {
    criterionId: TiebreakCriterionId;
    label: string;
    detail: string;
}

/** Qué criterio separa a `higher` (mejor) de `lower` cuando tienen los mismos puntos. */
export function getTiebreakResolution(
    higher: TiebreakStats,
    lower: TiebreakStats,
): TiebreakResolution | null {
    if (higher.points !== lower.points) return null;

    if (higher.hasChampion !== lower.hasChampion) {
        return {
            criterionId: 'champion',
            label: 'Campeón acertado',
            detail: higher.hasChampion ? 'Acertó el campeón' : 'Sin campeón acertado',
        };
    }
    if (higher.exactCount !== lower.exactCount) {
        return {
            criterionId: 'exact',
            label: 'Marcadores exactos',
            detail: `${higher.exactCount} vs ${lower.exactCount}`,
        };
    }
    if (higher.winnerCount !== lower.winnerCount) {
        return {
            criterionId: 'winner',
            label: 'Ganadores acertados',
            detail: `${higher.winnerCount} vs ${lower.winnerCount}`,
        };
    }
    if (higher.goalCount !== lower.goalCount) {
        return {
            criterionId: 'goals',
            label: 'Goles acertados',
            detail: `${higher.goalCount} vs ${lower.goalCount}`,
        };
    }
    if (higher.uniqueCount !== lower.uniqueCount) {
        return {
            criterionId: 'unique',
            label: 'Predicciones únicas',
            detail: `${higher.uniqueCount} vs ${lower.uniqueCount}`,
        };
    }

    return null;
}

export function formatTiebreakNote(higher: TiebreakStats, lower: TiebreakStats): string | null {
    if (higher.points !== lower.points) return null;

    const resolution = getTiebreakResolution(higher, lower);
    if (!resolution) {
        return 'Empate total — misma posición que el anterior';
    }

    return `Por debajo del anterior: ${resolution.label.toLowerCase()} (${resolution.detail})`;
}

export function formatTiebreakAdvantage(higher: TiebreakStats, lower: TiebreakStats): string | null {
    if (higher.points !== lower.points) return null;

    const resolution = getTiebreakResolution(higher, lower);
    if (!resolution) {
        return 'Empate total — comparte posición con el siguiente';
    }

    return `Por encima del siguiente: ${resolution.label.toLowerCase()} (${resolution.detail})`;
}

export const TIEBREAK_ROW_METRICS = [
    { id: 'points', icon: '🏅', label: 'Pts', getValue: (s: TiebreakStats) => String(s.points) },
    { id: 'champion', icon: '🏆', label: 'Campeón', getValue: (s: TiebreakStats) => (s.hasChampion ? 'Sí' : 'No') },
    { id: 'exact', icon: '🎯', label: 'Exactos', getValue: (s: TiebreakStats) => String(s.exactCount) },
    { id: 'winner', icon: '✅', label: 'Ganadores', getValue: (s: TiebreakStats) => String(s.winnerCount) },
    { id: 'goals', icon: '⚽', label: 'Goles', getValue: (s: TiebreakStats) => String(s.goalCount) },
    { id: 'unique', icon: '⭐', label: 'Únicas', getValue: (s: TiebreakStats) => String(s.uniqueCount) },
] as const;
