import { effectiveStatusShort } from '../../utils/liveFixture.util';

export type LiveClockAnchor = {
    /** Minuto reportado por la API en el último sync (fixture/events). */
    minute: number;
    /** Timestamp ms en que se recibió ese minuto. */
    syncedAt: number;
};

export type LiveClockInput = {
    matchDate: string;
    elapsed: number | null;
    lastSyncAt: number | null;
    statusShort?: string | null;
    now?: number;
    anchor?: LiveClockAnchor | null;
};

export type LiveClockState = {
    anchor: LiveClockAnchor | null;
    totalSeconds: number;
    displayMinute: number;
    displaySecond: number;
    periodBase: number;
    stoppageMinutes: number;
    isStoppage: boolean;
    halfLabel: string | null;
    phase: 'pre' | 'playing' | 'ht' | 'ft' | 'pen';
};

const MAX_STOPPAGE_MINUTES = 15;

export function resolvePeriodBase(statusShort?: string | null): number {
    const normalized = statusShort ?? null;
    if (normalized === 'HT') return 45;
    if (normalized === '2H' || normalized === 'ET') return 90;
    if (normalized === '1H') return 45;
    return 45;
}

export function isPenaltyShootoutStatus(statusShort?: string | null): boolean {
    const normalized = statusShort ?? null;
    return normalized === 'P' || normalized === 'BT' || normalized === 'PEN';
}

export function resolveHalfLabel(statusShort?: string | null): string | null {
    const normalized = statusShort ?? null;
    if (normalized === '1H') return '1T';
    if (normalized === 'HT') return 'ET';
    if (normalized === '2H') return '2T';
    if (normalized === 'ET') return 'Prórroga';
    if (isPenaltyShootoutStatus(normalized)) return 'Penales';
    return null;
}

/** Segundos transcurridos desde el ancla (extrapolación local entre syncs). */
export function extrapolateTotalSeconds(anchor: LiveClockAnchor, now: number): number {
    const deltaSec = Math.max(0, Math.floor((now - anchor.syncedAt) / 1000));
    return anchor.minute * 60 + deltaSec;
}

/** Minuto entero extrapolado desde ancla (sin segundos). */
export function extrapolateDisplayMinute(anchor: LiveClockAnchor, now: number): number {
    return Math.floor(extrapolateTotalSeconds(anchor, now) / 60);
}

/**
 * Decide si re-anclar al minuto del servidor.
 * - Si el sync trae un minuto mayor, salta (ej. local 1:50 → sync 2' → 2:00).
 * - Si el sync trae el mismo minuto, no reinicia los segundos (sigue contando).
 * - Si es la primera vez, ancla con elapsed + lastSyncAt.
 */
export function resolveClockAnchor(
    elapsed: number | null,
    lastSyncAt: number | null,
    previous: LiveClockAnchor | null,
    now: number,
): LiveClockAnchor | null {
    if (elapsed == null) return previous;

    const syncAt = lastSyncAt ?? now;

    if (!previous) {
        return { minute: elapsed, syncedAt: syncAt };
    }

    const localMinute = extrapolateDisplayMinute(previous, now);

    if (elapsed > localMinute || elapsed > previous.minute) {
        return { minute: elapsed, syncedAt: syncAt };
    }

    return previous;
}

function kickoffFallbackSeconds(matchDate: string, now: number, periodBase: number): number {
    const kickoff = new Date(matchDate).getTime();
    if (now < kickoff) return 0;
    const rawMinutes = Math.floor((now - kickoff) / 60000);
    return Math.min(rawMinutes, periodBase + MAX_STOPPAGE_MINUTES) * 60;
}

export function computeLiveClockState(input: LiveClockInput): LiveClockState {
    const now = input.now ?? Date.now();
    const statusShort = effectiveStatusShort(input.statusShort, input.elapsed);

    if (statusShort === 'HT') {
        return {
            anchor: input.anchor ?? null,
            totalSeconds: 45 * 60,
            displayMinute: 45,
            displaySecond: 0,
            periodBase: 45,
            stoppageMinutes: 0,
            isStoppage: false,
            halfLabel: 'ET',
            phase: 'ht',
        };
    }

    if (statusShort === 'FT' || statusShort === 'AET') {
        return {
            anchor: input.anchor ?? null,
            totalSeconds: 90 * 60,
            displayMinute: 90,
            displaySecond: 0,
            periodBase: 90,
            stoppageMinutes: 0,
            isStoppage: false,
            halfLabel: null,
            phase: 'ft',
        };
    }

    if (isPenaltyShootoutStatus(statusShort)) {
        return {
            anchor: input.anchor ?? null,
            totalSeconds: 120 * 60,
            displayMinute: 120,
            displaySecond: 0,
            periodBase: 120,
            stoppageMinutes: 0,
            isStoppage: false,
            halfLabel: 'Penales',
            phase: 'pen',
        };
    }

    let totalSeconds: number;
    if (input.anchor) {
        totalSeconds = extrapolateTotalSeconds(input.anchor, now);
    } else if (input.elapsed != null && input.lastSyncAt != null) {
        totalSeconds = extrapolateTotalSeconds(
            { minute: input.elapsed, syncedAt: input.lastSyncAt },
            now,
        );
    } else {
        const base = resolvePeriodBase(statusShort);
        totalSeconds = kickoffFallbackSeconds(input.matchDate, now, base);
    }

    const rawMinute = Math.floor(totalSeconds / 60);
    const displaySecond = totalSeconds % 60;
    const periodBase = resolvePeriodBase(statusShort);
    const maxSeconds = (periodBase + MAX_STOPPAGE_MINUTES) * 60;
    totalSeconds = Math.min(totalSeconds, maxSeconds);

    const displayMinute = Math.floor(totalSeconds / 60);
    const stoppageMinutes = Math.max(0, displayMinute - periodBase);
    const isStoppage = stoppageMinutes > 0;

    const kickoff = new Date(input.matchDate).getTime();
    const phase = now < kickoff ? 'pre' : 'playing';

    return {
        anchor: input.anchor ?? null,
        totalSeconds,
        displayMinute,
        displaySecond,
        periodBase,
        stoppageMinutes,
        isStoppage,
        halfLabel: resolveHalfLabel(statusShort),
        phase,
    };
}

export function formatLiveClockMinute(state: LiveClockState): string {
    if (state.isStoppage) {
        return `${state.periodBase}+${state.stoppageMinutes}'`;
    }
    return `${state.displayMinute}'`;
}

export function formatLiveClockSeconds(state: LiveClockState): string {
    const mm = state.displayMinute;
    const ss = state.displaySecond.toString().padStart(2, '0');
    return `${mm}:${ss}`;
}

export function liveClockProgressPercent(state: LiveClockState): number {
    return Math.min(100, Math.round((state.totalSeconds / (90 * 60)) * 100));
}
