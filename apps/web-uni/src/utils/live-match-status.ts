import { isPenaltyPhaseStatus } from './knockout-advance';

export function resolveLiveStatusLabel(
    statusShort?: string | null,
    elapsed?: number | null,
): string {
    if (isPenaltyPhaseStatus(statusShort)) {
        return 'Penales';
    }
    if (statusShort === 'ET') {
        return 'Prórroga';
    }
    if (statusShort === 'HT') {
        return 'Entretiempo';
    }
    if (elapsed != null && elapsed > 0) {
        return `${elapsed}'`;
    }
    return 'En vivo';
}

export function formatMatchScoreWithPenalties(params: {
    homeScore?: number | null;
    awayScore?: number | null;
    penaltyHomeScore?: number | null;
    penaltyAwayScore?: number | null;
}): string {
    const h = params.homeScore ?? 0;
    const a = params.awayScore ?? 0;
    if (params.penaltyHomeScore != null && params.penaltyAwayScore != null) {
        return `${h} (${params.penaltyHomeScore})–${a} (${params.penaltyAwayScore}) pen.`;
    }
    return `${h}–${a}`;
}
