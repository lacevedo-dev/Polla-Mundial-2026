import React from 'react';
import { request } from '../api';
import { usePredictionStore } from '../stores/prediction.store';
import { dedupeMatchEvents } from '../utils/matchEvents';
import { normalizeMatchEvents } from '../utils/liveFixture.util';
import type { MatchEventItem } from './useLiveSyncEvents';

export type LiveMatchEventsState = {
    eventsByMatchId: Map<string, MatchEventItem[]>;
    loadingMatchIds: Set<string>;
};

async function fetchEventsForMatch(matchId: string): Promise<MatchEventItem[]> {
    try {
        const events = await request<MatchEventItem[]>(`/matches/${matchId}/events`);
        return dedupeMatchEvents(normalizeMatchEvents(events));
    } catch {
        return [];
    }
}

function countActiveGoals(events: MatchEventItem[]): number {
    return events.filter((e) => e.type === 'GOAL' && !e.annulled).length;
}

function needsEventsFetch(
    revision: string | undefined,
    cached: MatchEventItem[],
    expectedGoals: number,
    lastFetchedRevision: string | undefined,
): boolean {
    const hasEnoughGoals = expectedGoals === 0 || countActiveGoals(cached) >= expectedGoals;

    if (revision) {
        if (revision !== lastFetchedRevision) return true;
        return !hasEnoughGoals;
    }

    if (lastFetchedRevision === 'loaded' && cached.length > 0) return false;
    if (expectedGoals === 0 && cached.length === 0) return false;
    return cached.length === 0 || !hasEnoughGoals;
}

/**
 * Eventos LIVE: primero los embebidos en SSE (fixture/events), fetch HTTP solo si cambia eventsRevision
 * o si el marcador indica goles pero aún no hay eventos en caché.
 */
export function useLiveMatchEvents(liveMatchIds: string[]): LiveMatchEventsState {
    const cachedEvents = usePredictionStore((state) => state.liveEventsByMatchId);
    const revisions = usePredictionStore((state) => state.liveEventsRevisionByMatchId);
    const matches = usePredictionStore((state) => state.matches);

    const [fetchedEvents, setFetchedEvents] = React.useState<Map<string, MatchEventItem[]>>(
        () => new Map(),
    );
    const [loadingMatchIds, setLoadingMatchIds] = React.useState<Set<string>>(() => new Set());
    const fetchedRevisionRef = React.useRef<Record<string, string>>({});

    const liveMatchIdsKey = liveMatchIds.join('|');
    const fetchPlanKey = JSON.stringify(
        liveMatchIds.map((id) => {
            const match = matches.find((m) => m.id === id);
            const home = match?.result?.home ?? 0;
            const away = match?.result?.away ?? 0;
            return `${id}:${revisions[id] ?? ''}:${home + away}:${(cachedEvents[id] ?? []).length}`;
        }),
    );

    React.useEffect(() => {
        if (liveMatchIds.length === 0) {
            setFetchedEvents(new Map());
            setLoadingMatchIds(new Set());
            fetchedRevisionRef.current = {};
            return;
        }

        let cancelled = false;

        void (async () => {
            for (const matchId of liveMatchIds) {
                const revision = revisions[matchId];
                const cached = cachedEvents[matchId] ?? [];
                const match = matches.find((m) => m.id === matchId);
                const expectedGoals = (match?.result?.home ?? 0) + (match?.result?.away ?? 0);
                const lastFetched = fetchedRevisionRef.current[matchId];

                if (!needsEventsFetch(revision, cached, expectedGoals, lastFetched)) {
                    continue;
                }

                setLoadingMatchIds((prev) => new Set(prev).add(matchId));

                const events = await fetchEventsForMatch(matchId);
                if (cancelled) return;

                fetchedRevisionRef.current[matchId] = revision ?? 'loaded';
                setFetchedEvents((prev) => {
                    const next = new Map(prev);
                    next.set(matchId, events);
                    return next;
                });
                setLoadingMatchIds((prev) => {
                    const next = new Set(prev);
                    next.delete(matchId);
                    return next;
                });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [liveMatchIdsKey, fetchPlanKey, liveMatchIds, revisions, cachedEvents, matches]);

    const eventsByMatchId = React.useMemo(() => {
        const merged = new Map<string, MatchEventItem[]>();
        for (const matchId of liveMatchIds) {
            const fromSse = cachedEvents[matchId];
            const fromFetch = fetchedEvents.get(matchId);
            if (fromSse && fromSse.length > 0) {
                merged.set(matchId, dedupeMatchEvents(fromSse));
            } else if (fromFetch && fromFetch.length > 0) {
                merged.set(matchId, fromFetch);
            } else {
                merged.set(matchId, []);
            }
        }
        return merged;
    }, [liveMatchIds, cachedEvents, fetchedEvents]);

    return { eventsByMatchId, loadingMatchIds };
}
