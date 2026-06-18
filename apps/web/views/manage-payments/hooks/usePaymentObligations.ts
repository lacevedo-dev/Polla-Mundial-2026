import { useCallback, useEffect, useState } from 'react';
import { request } from '../../../api';
import { useLeagueStore } from '../../../stores/league.store';
import type { ObligationRecord } from '../types';

export function usePaymentObligations(leagueId: string) {
    const myLeagues = useLeagueStore((s) => s.myLeagues);
    const leaguesLoading = useLeagueStore((s) => s.isLoading);
    const fetchMyLeagues = useLeagueStore((s) => s.fetchMyLeagues);

    const [obligations, setObligations] = useState<ObligationRecord[]>([]);
    const [obligationsLoading, setObligationsLoading] = useState(false);
    const [leaguesBootstrapped, setLeaguesBootstrapped] = useState(myLeagues.length > 0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (myLeagues.length > 0) {
                if (!cancelled) setLeaguesBootstrapped(true);
                return;
            }

            try {
                await fetchMyLeagues();
            } catch {
                if (!cancelled) {
                    setError('No se pudo cargar tu polla activa. Intenta de nuevo.');
                }
            } finally {
                if (!cancelled) setLeaguesBootstrapped(true);
            }
        })();

        return () => { cancelled = true; };
    }, [fetchMyLeagues, myLeagues.length]);

    const loadObligations = useCallback(async () => {
        if (!leagueId) return;
        setObligationsLoading(true);
        setError(null);
        try {
            const data = await request<ObligationRecord[]>(`/leagues/${leagueId}/payments`);
            setObligations(data);
        } catch {
            setError('No se pudieron cargar los pagos. Verifica que eres administrador de la polla.');
        } finally {
            setObligationsLoading(false);
        }
    }, [leagueId]);

    useEffect(() => {
        if (!leaguesBootstrapped || !leagueId) return;
        void loadObligations();
    }, [leaguesBootstrapped, leagueId, loadObligations]);

    const bootstrappingLeague = !leaguesBootstrapped || (leaguesLoading && !leagueId);
    const loading = bootstrappingLeague || obligationsLoading;
    const loadingMessage = bootstrappingLeague ? 'Preparando polla…' : 'Cargando pagos…';

    return {
        obligations,
        error,
        loading,
        loadingMessage,
        leaguesBootstrapped,
        loadObligations,
    };
}
