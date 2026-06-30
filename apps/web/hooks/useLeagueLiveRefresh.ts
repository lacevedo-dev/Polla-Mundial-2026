import React from 'react';
import { usePredictionStore } from '../stores/prediction.store';
import { useLeagueStore } from '../stores/league.store';
import type { LiveSyncState } from './useLiveSyncEvents';

/**
 * Refresca partidos de la liga activa al completar sync en vivo (SSE) y en intervalos
 * adaptativos para que el panel EN VIVO aparezca sin recargar la página.
 */
export function useLeagueLiveRefresh(liveSync: LiveSyncState): void {
    const activeLeagueId = useLeagueStore((s) => s.activeLeague?.id);
    const fetchLeagueMatches = usePredictionStore((s) => s.fetchLeagueMatches);
    const matches = usePredictionStore((s) => s.matches);

    const hasLiveMatches = React.useMemo(
        () => matches.some((m) => m.status === 'live'),
        [matches],
    );

    const hasImminentKickoff = React.useMemo(
        () => matches.some((m) => {
            if (m.status !== 'open' && m.status !== 'closed') return false;
            const delta = new Date(m.date).getTime() - Date.now();
            return delta < 3 * 60 * 60_000 && delta > -2 * 60 * 60_000;
        }),
        [matches],
    );

    React.useEffect(() => {
        if (!activeLeagueId || liveSync.syncCompletedCount === 0) return;
        void fetchLeagueMatches(activeLeagueId, { background: true });
    }, [activeLeagueId, liveSync.syncCompletedCount, fetchLeagueMatches]);

    React.useEffect(() => {
        if (!activeLeagueId) return;

        let cancelled = false;
        let timeoutId: number | null = null;

        const schedule = () => {
            if (cancelled) return;
            const delay = hasLiveMatches
                ? Math.max(60_000, liveSync.syncIntervalMinutes * 60_000)
                : hasImminentKickoff
                    ? 90_000
                    : 300_000;

            timeoutId = window.setTimeout(async () => {
                if (cancelled) {
                    return;
                }
                if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                    schedule();
                    return;
                }
                try {
                    await fetchLeagueMatches(activeLeagueId, { background: true });
                } catch {
                    // silent background refresh
                }
                schedule();
            }, delay);
        };

        schedule();

        return () => {
            cancelled = true;
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [
        activeLeagueId,
        fetchLeagueMatches,
        hasLiveMatches,
        hasImminentKickoff,
        liveSync.syncIntervalMinutes,
    ]);
}
