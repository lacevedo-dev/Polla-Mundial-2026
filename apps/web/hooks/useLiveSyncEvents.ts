import React from 'react';
import { BASE_URL } from '../api';
import { usePredictionStore, type LiveScoreUpdate } from '../stores/prediction.store';

export interface LiveSyncState {
    isConnected: boolean;
    lastSyncAt: number | null;        // timestamp ms del último sync_completed
    syncIntervalMinutes: number;       // del plan (default 5)
    matchesUpdatedCount: number;       // cuántos match_updated recibidos en la sesión
}

export function useLiveSyncEvents(): LiveSyncState {
    const batchUpdateLiveScores = usePredictionStore((s) => s.batchUpdateLiveScores);
    const [state, setState] = React.useState<LiveSyncState>({
        isConnected: false,
        lastSyncAt: null,
        syncIntervalMinutes: 5,
        matchesUpdatedCount: 0,
    });

    // Fetch initial sync info
    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        fetch(`${BASE_URL}/matches/live/sync-info`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((data: { intervalMinutes: number; lastSync: string | null }) => {
                setState((prev) => ({
                    ...prev,
                    syncIntervalMinutes: data.intervalMinutes ?? 5,
                    lastSyncAt: data.lastSync ? new Date(data.lastSync).getTime() : null,
                }));
            })
            .catch(() => { /* silent */ });
    }, []);

    // SSE connection
    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const url = `${BASE_URL}/matches/live/events?token=${encodeURIComponent(token)}`;
        const es = new EventSource(url);

        // Pending updates buffer — keyed by matchId so rapid duplicates collapse into one
        const pending = new Map<string, LiveScoreUpdate>();
        let flushTimer: ReturnType<typeof setTimeout> | null = null;

        const flush = () => {
            flushTimer = null;
            if (pending.size === 0) return;
            const updates = Array.from(pending.values());
            pending.clear();
            batchUpdateLiveScores(updates);
            setState((prev) => ({ ...prev, matchesUpdatedCount: prev.matchesUpdatedCount + updates.length }));
        };

        es.onopen = () => setState((prev) => ({ ...prev, isConnected: true }));
        es.onerror = () => setState((prev) => ({ ...prev, isConnected: false }));

        es.addEventListener('match_updated', (e: MessageEvent) => {
            try {
                const data = JSON.parse(e.data as string) as LiveScoreUpdate;
                // Accumulate in map — same matchId overwrites, keeping only latest
                pending.set(data.matchId, data);
                // Schedule a single deferred flush so the message handler returns immediately
                if (!flushTimer) {
                    flushTimer = setTimeout(flush, 0);
                }
            } catch { /* silent */ }
        });

        es.addEventListener('sync_completed', (e: MessageEvent) => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const _data = JSON.parse(e.data as string) as { requestsUsed?: number };
                setState((prev) => ({ ...prev, lastSyncAt: Date.now() }));
                // Also fetch updated interval
                fetch(`${BASE_URL}/matches/live/sync-info`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                    .then((r) => r.json())
                    .then((info: { intervalMinutes: number }) => {
                        setState((p) => ({ ...p, syncIntervalMinutes: info.intervalMinutes ?? 5 }));
                    })
                    .catch(() => { /* silent */ });
            } catch { /* silent */ }
        });

        return () => {
            if (flushTimer) clearTimeout(flushTimer);
            es.close();
            setState((prev) => ({ ...prev, isConnected: false }));
        };
    }, [batchUpdateLiveScores]);

    return state;
}
