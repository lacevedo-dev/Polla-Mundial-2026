import { create } from 'zustand';
import { request } from '../api';

interface AiUsageRecord {
    id: string;
    userId: string;
    leagueId: string | null;
    matchId: string | null;
    feature: string;
    creditsUsed: number;
    insightGenerated: boolean;
    createdAt: string;
    user: {
        id: string;
        name: string;
        email: string;
        username: string;
        plan: string;
    };
}

interface UsageStats {
    totalRecords: number;
    totalCreditsUsed: number;
    byFeature: Array<{
        feature: string;
        _sum: { creditsUsed: number };
        _count: number;
    }>;
    byPlan: Array<{
        plan: string;
        _sum: {
            usedCredits: number;
            totalCredits: number;
        };
        _count: number;
    }>;
}

interface Filters {
    userId?: string;
    leagueId?: string;
    feature?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
}

interface AdminAiUsageStore {
    records: AiUsageRecord[];
    stats: UsageStats | null;
    total: number;
    filters: Filters;
    isLoading: boolean;
    error: string | null;

    fetchRecords: () => Promise<void>;
    fetchStats: () => Promise<void>;
    setFilters: (filters: Partial<Filters>) => void;
    resetUserCredits: (userId: string) => Promise<void>;
}

export const useAdminAiUsageStore = create<AdminAiUsageStore>((set, get) => ({
    records: [],
    stats: null,
    total: 0,
    filters: {
        page: 1,
        limit: 50,
    },
    isLoading: false,
    error: null,

    fetchRecords: async () => {
        set({ isLoading: true, error: null });
        try {
            const { userId, leagueId, feature, startDate, endDate, page, limit } = get().filters;
            const offset = (page - 1) * limit;

            const params = new URLSearchParams();
            if (userId) params.append('userId', userId);
            if (leagueId) params.append('leagueId', leagueId);
            if (feature) params.append('feature', feature);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            params.append('limit', limit.toString());
            params.append('offset', offset.toString());

            const response = await request<{ records: AiUsageRecord[]; total: number }>(`/ai-credits/admin/records?${params.toString()}`);

            set({
                records: response.records,
                total: response.total,
                isLoading: false,
            });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Error al cargar registros',
                isLoading: false,
            });
        }
    },

    fetchStats: async () => {
        try {
            const { startDate, endDate } = get().filters;

            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const response = await request<UsageStats>(`/ai-credits/admin/stats?${params.toString()}`);

            set({ stats: response });
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
        }
    },

    setFilters: (newFilters) => {
        set((state) => ({
            filters: { ...state.filters, ...newFilters },
        }));
    },

    resetUserCredits: async (userId: string) => {
        try {
            await request(`/ai-credits/admin/user/${userId}/reset`, { method: 'POST' });
            // Recargar datos
            await get().fetchRecords();
            await get().fetchStats();
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Error al resetear créditos',
            });
        }
    },
}));
