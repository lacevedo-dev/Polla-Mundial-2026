import React from 'react';
import { request } from '../api';

interface CreditSummary {
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
    plan: string;
    lastResetAt: string;
}

interface ConsumeResult {
    success: boolean;
    remainingCredits: number;
    error?: string;
}

export function useAiCredits() {
    const [summary, setSummary] = React.useState<CreditSummary | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const fetchSummary = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await request<CreditSummary>('/ai-credits/summary');
            setSummary(response);
            return response;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al cargar créditos';
            setError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const consumeCredits = React.useCallback(async (params: {
        leagueId?: string;
        matchId?: string;
        feature: string;
        creditsUsed?: number;
        requestData?: any;
        responseData?: any;
        insightGenerated?: boolean;
        clientInfo?: string;
    }) => {
        try {
            const response = await request<ConsumeResult>('/ai-credits/consume', {
                method: 'POST',
                body: JSON.stringify(params),
                headers: { 'Content-Type': 'application/json' },
            });

            // Actualizar el resumen local
            if (response.success && summary) {
                setSummary({
                    ...summary,
                    usedCredits: summary.totalCredits - response.remainingCredits,
                    remainingCredits: response.remainingCredits,
                });
            }

            return response;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al consumir créditos';
            setError(message);
            return {
                success: false,
                remainingCredits: summary?.remainingCredits ?? 0,
                error: message,
            };
        }
    }, [summary]);

    const resetCredits = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await request<CreditSummary>('/ai-credits/reset', { method: 'POST' });
            setSummary(response);
            return response;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al resetear créditos';
            setError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const getHistory = React.useCallback(async (limit = 50, offset = 0) => {
        try {
            const response = await request(`/ai-credits/history?limit=${limit}&offset=${offset}`);
            return response;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al cargar historial';
            setError(message);
            return null;
        }
    }, []);

    // Cargar summary automáticamente al montar
    React.useEffect(() => {
        void fetchSummary();
    }, [fetchSummary]);

    return {
        summary,
        loading,
        error,
        fetchSummary,
        consumeCredits,
        resetCredits,
        getHistory,
        // Helpers
        remainingCredits: summary?.remainingCredits ?? 0,
        totalCredits: summary?.totalCredits ?? 0,
        usedCredits: summary?.usedCredits ?? 0,
        hasCredits: (summary?.remainingCredits ?? 0) > 0,
    };
}
