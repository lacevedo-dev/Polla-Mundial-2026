import type { CorpRankingEntry, RankingBreakdownMatch } from './ranking.types';

export const POINTS_LEGEND = [
    { code: 'ME', label: 'Marcador exacto' },
    { code: 'GA', label: 'Ganador acertado' },
    { code: 'GoA', label: 'Gol acertado' },
    { code: 'Pu', label: 'Predicción única' },
    { code: 'BF', label: 'Bono de fase' },
] as const;

export function buildPointsResume(entry: Pick<
    CorpRankingEntry,
    'exactCount' | 'winnerCount' | 'goalCount' | 'uniqueCount' | 'phaseBonusPoints'
>): string {
    const parts: string[] = [];
    if (entry.exactCount) {
        parts.push(`${entry.exactCount} marcador${entry.exactCount === 1 ? '' : 'es'} exacto${entry.exactCount === 1 ? '' : 's'}`);
    }
    if (entry.winnerCount) {
        parts.push(`${entry.winnerCount} ganador${entry.winnerCount === 1 ? '' : 'es'} acertado${entry.winnerCount === 1 ? '' : 's'}`);
    }
    if (entry.goalCount) {
        parts.push(`${entry.goalCount} gol${entry.goalCount === 1 ? '' : 'es'} acertado${entry.goalCount === 1 ? '' : 's'}`);
    }
    if (entry.uniqueCount) {
        parts.push(`${entry.uniqueCount} predicción${entry.uniqueCount === 1 ? '' : 'es'} única${entry.uniqueCount === 1 ? '' : 's'}`);
    }
    if (entry.phaseBonusPoints) {
        parts.push(`${entry.phaseBonusPoints} pts en bonos de fase`);
    }
    return parts.length ? parts.join(' · ') : 'Aún no suma puntos detallados en esta categoría';
}

export function toPointSummaryLabel(
    pointDetail?: RankingBreakdownMatch['pointDetail'] | null,
): string {
    if (!pointDetail) return 'Sin puntos';
    if (pointDetail.explanation) return pointDetail.explanation;

    const parts: string[] = [];
    if (pointDetail.exactPoints > 0) parts.push(`Marcador exacto +${pointDetail.exactPoints}`);
    if (pointDetail.winnerPoints > 0) parts.push(`Ganador +${pointDetail.winnerPoints}`);
    if (pointDetail.goalPoints > 0) parts.push(`Gol +${pointDetail.goalPoints}`);
    if (pointDetail.uniqueBonus > 0) parts.push(`Única +${pointDetail.uniqueBonus}`);
    return parts.length ? parts.join(' · ') : 'Sin puntos';
}

export function toDisplayDate(matchDate: string): string {
    const date = new Date(matchDate);
    if (Number.isNaN(date.getTime())) return matchDate;
    return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

export function formatPhaseLabel(phase: string): string {
    switch (phase) {
        case 'GROUP': return 'Grupos';
        case 'ROUND_OF_32': return 'Dieciseisavos';
        case 'ROUND_OF_16': return 'Octavos';
        case 'QUARTER': return 'Cuartos';
        case 'SEMI': return 'Semifinal';
        case 'THIRD_PLACE': return 'Tercer puesto';
        case 'FINAL': return 'Final';
        default: return phase;
    }
}
