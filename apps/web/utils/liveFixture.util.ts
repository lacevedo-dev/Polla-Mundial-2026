import type { MatchEventItem } from '../hooks/useLiveSyncEvents';
import type { MatchViewModel } from '../stores/prediction.adapters';

export type LiveFixtureFields = {
    elapsed?: number | null;
    statusShort?: string | null;
    result?: { home: number; away: number };
    lastSyncAt?: string | null;
};

export function parseSyncTimestamp(value?: string | null): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/** Corrige statusShort obsoleto (ej. 1H con elapsed 48 → 2H). */
export function effectiveStatusShort(
    statusShort?: string | null,
    elapsed?: number | null,
): string | null {
    if (statusShort === '1H' && elapsed != null && elapsed > 45) {
        return '2H';
    }
    return statusShort ?? null;
}

export function buildLiveFixtureFingerprint(
    fields: LiveFixtureFields,
    eventsRevision?: string | null,
): string {
    const status = effectiveStatusShort(fields.statusShort, fields.elapsed);
    return [
        fields.result?.home ?? '-',
        fields.result?.away ?? '-',
        fields.elapsed ?? '-',
        status ?? '-',
        fields.lastSyncAt ?? '-',
        eventsRevision ?? '-',
    ].join('|');
}

function pickElapsed(
    prev?: number | null,
    incoming?: number | null,
    prevStatus?: string | null,
    incomingStatus?: string | null,
): number | null | undefined {
    const prevEff = effectiveStatusShort(prevStatus, prev);
    const incomingEff = effectiveStatusShort(incomingStatus, incoming);

    if (incoming == null) return prev;
    if (prev == null) return incoming;

    if (prevEff === 'HT' && incomingEff !== 'HT') return incoming;
    if (incomingEff === 'HT') return incoming;

    if (incoming >= prev) return incoming;
    if (incomingEff === '2H' && prevEff === '1H') return incoming;
    return prev;
}

function pickStatusShort(
    prev: LiveFixtureFields,
    incoming: LiveFixtureFields,
): string | null | undefined {
    const prevElapsed = prev.elapsed ?? null;
    const incomingElapsed = incoming.elapsed ?? null;
    const prevEff = effectiveStatusShort(prev.statusShort, prevElapsed);
    const incomingEff = effectiveStatusShort(incoming.statusShort, incomingElapsed);

    if (incomingEff === 'HT' || incomingEff === 'FT' || incomingEff === '2H') {
        return incoming.statusShort ?? incomingEff;
    }
    if (prevEff === '2H' && incomingEff === '1H') {
        return prev.statusShort ?? prevEff;
    }
    return incoming.statusShort ?? prev.statusShort;
}

/** Fusiona telemetría LIVE sin regresar elapsed/status por fetches en segundo plano stale. */
export function mergeLiveMatchViewModel(
    prev: MatchViewModel,
    incoming: MatchViewModel,
): MatchViewModel {
    if (prev.status !== 'live' && incoming.status !== 'live') {
        return incoming;
    }

    const prevSync = parseSyncTimestamp(prev.lastSyncAt);
    const incomingSync = parseSyncTimestamp(incoming.lastSyncAt);
    const incomingIsStale = incomingSync > 0 && prevSync > incomingSync + 5_000;

    if (!incomingIsStale) {
        return {
            ...incoming,
            statusShort: effectiveStatusShort(incoming.statusShort, incoming.elapsed) ?? incoming.statusShort,
        };
    }

    return {
        ...incoming,
        elapsed: pickElapsed(
            prev.elapsed,
            incoming.elapsed,
            prev.statusShort,
            incoming.statusShort,
        ),
        statusShort: pickStatusShort(prev, incoming) ?? incoming.statusShort,
        result: incoming.result ?? prev.result,
        lastSyncAt: prev.lastSyncAt ?? incoming.lastSyncAt,
    };
}

export function mergeMatchViewModels(
    prev: MatchViewModel[],
    incoming: MatchViewModel[],
): MatchViewModel[] {
    const prevById = new Map(prev.map((match) => [match.id, match]));
    return incoming.map((match) => {
        const previous = prevById.get(match.id);
        if (!previous) return match;
        return mergeLiveMatchViewModel(previous, match);
    });
}

export function normalizeMatchEventType(type: string): string {
    return type.trim().toUpperCase();
}

export function normalizeMatchEvents(events: MatchEventItem[]): MatchEventItem[] {
    return events.map((event) => ({
        ...event,
        type: normalizeMatchEventType(event.type),
    }));
}

export function eventsPayloadChanged(
    prevRevision: string | undefined,
    nextRevision: string | undefined,
    prevEvents: MatchEventItem[],
    nextEvents: MatchEventItem[],
): boolean {
    if (nextRevision && nextRevision !== prevRevision) return true;
    if (nextEvents.length === 0) return false;
    if (prevEvents.length !== nextEvents.length) return true;
    return buildLiveFixtureFingerprint({}, nextRevision) !== buildLiveFixtureFingerprint({}, prevRevision);
}
