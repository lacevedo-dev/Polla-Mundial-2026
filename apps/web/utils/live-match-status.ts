import { isPenaltyPhaseStatus } from './knockout-advance';

const LIVE_STATUS_SHORT = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE']);

export function isLivePlayStatusShort(statusShort?: string | null): boolean {
    return !!statusShort && LIVE_STATUS_SHORT.has(statusShort);
}

export function isLiveApiStatus(status?: string | null): boolean {
    return status === 'LIVE';
}

export function inferLiveFromFixture(
    apiStatus?: string | null,
    statusShort?: string | null,
): boolean {
    return isLiveApiStatus(apiStatus) || isLivePlayStatusShort(statusShort);
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

export function shouldShowPenaltyHint(
    statusShort?: string | null,
    penaltyHomeScore?: number | null,
    penaltyAwayScore?: number | null,
): boolean {
    return (
        penaltyHomeScore != null &&
        penaltyAwayScore != null
    ) || isPenaltyPhaseStatus(statusShort);
}
