import React from 'react';
import { BASE_URL } from '../api';
import { usePredictionStore } from '../stores/prediction.store';

export interface LiveSyncState {
    isConnected: boolean;
    lastSyncAt: number | null;        // timestamp ms del último sync_completed
    syncIntervalMinutes: number;       // del plan (default 5)
    matchesUpdatedCount: number;       // cuántos match_updated recibidos en la sesión
}

export function useLiveSyncEvents(): LiveSyncState {
    const updateMatchLiveScore = usePredictionStore((s) => s.updateMatchLiveScore);
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

        es.onopen = () => setState((prev) => ({ ...prev, isConnected: true }));
        es.onerror = () => setState((prev) => ({ ...prev, isConnected: false }));

        es.addEventListener('match_updated', (e: MessageEvent) => {
            try {
                const data = JSON.parse(e.data as string) as {
                    matchId: string;
                    homeScore: number | null;
                    awayScore: number | null;
                    status: string;
                    elapsed?: number | null;
                    statusShort?: string | null;
                };
                updateMatchLiveScore(data.matchId, data.homeScore, data.awayScore, data.status, data.elapsed, data.statusShort);
                setState((prev) => ({ ...prev, matchesUpdatedCount: prev.matchesUpdatedCount + 1 }));
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
            es.close();
            setState((prev) => ({ ...prev, isConnected: false }));
        };
    }, [updateMatchLiveScore]);

    return state;
}
