import React from 'react';
import { request } from '../api';
import { dedupeMatchEvents } from '../utils/matchEvents';
import type { MatchEventItem } from './useLiveSyncEvents';

const EVENTS_REFRESH_DEBOUNCE_MS = 400;

async function fetchEventsForMatches(
    matchIds: string[],
): Promise<Map<string, MatchEventItem[]>> {
    if (matchIds.length === 0) return new Map();

    const results = await Promise.all(
        matchIds.map((id) =>
            request<MatchEventItem[]>(`/matches/${id}/events`)
                .then((events) => ({ id, events }))
                .catch(() => ({ id, events: [] as MatchEventItem[] })),
        ),
    );

    const next = new Map<string, MatchEventItem[]>();
    for (const { id, events } of results) {
        next.set(id, dedupeMatchEvents(events));
    }
    return next;
}

/**
 * Carga y refresca eventos (goles, tarjetas) de partidos en vivo.
 * Se dispara al cambiar la lista LIVE, tras SSE match_updated/sync_completed y en polling.
 */
export function useLiveMatchEvents(
    liveMatchIds: string[],
    refreshSignals: {
        matchesUpdatedCount: number;
        syncCompletedCount: number;
        syncIntervalMinutes: number;
    },
): Map<string, MatchEventItem[]> {
    const [matchEvents, setMatchEvents] = React.useState<Map<string, MatchEventItem[]>>(
        () => new Map(),
    );
    const liveMatchIdsKey = liveMatchIds.join('|');

    const mergeEvents = React.useCallback((incoming: Map<string, MatchEventItem[]>) => {
        setMatchEvents((prev) => {
            const next = new Map(prev);
            for (const [id, events] of incoming) {
                next.set(id, events);
            }
            for (const id of next.keys()) {
                if (!liveMatchIds.includes(id)) next.delete(id);
            }
            return next;
        });
    }, [liveMatchIds]);

    React.useEffect(() => {
        if (liveMatchIds.length === 0) {
            setMatchEvents(new Map());
            return;
        }

        let cancelled = false;
        void fetchEventsForMatches(liveMatchIds).then((events) => {
            if (!cancelled) mergeEvents(events);
        });

        return () => {
            cancelled = true;
        };
    }, [liveMatchIdsKey, mergeEvents, liveMatchIds]);

    React.useEffect(() => {
        if (liveMatchIds.length === 0) return;
        if (
            refreshSignals.matchesUpdatedCount === 0 &&
            refreshSignals.syncCompletedCount === 0
        ) {
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(() => {
            void fetchEventsForMatches(liveMatchIds).then((events) => {
                if (!cancelled) mergeEvents(events);
            });
        }, EVENTS_REFRESH_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [
        liveMatchIdsKey,
        liveMatchIds,
        refreshSignals.matchesUpdatedCount,
        refreshSignals.syncCompletedCount,
        mergeEvents,
    ]);

    React.useEffect(() => {
        if (liveMatchIds.length === 0) return;

        const intervalMs = Math.max(30_000, refreshSignals.syncIntervalMinutes * 30_000);
        let cancelled = false;

        const tick = () => {
            if (cancelled || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
                return;
            }
            void fetchEventsForMatches(liveMatchIds).then((events) => {
                if (!cancelled) mergeEvents(events);
            });
        };

        const intervalId = window.setInterval(tick, intervalMs);
        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [liveMatchIdsKey, liveMatchIds, refreshSignals.syncIntervalMinutes, mergeEvents]);

    return matchEvents;
}
