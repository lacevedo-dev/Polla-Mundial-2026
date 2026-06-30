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
