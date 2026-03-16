import { create } from 'zustand';
import { request } from '../api';

export interface AdminPrediction {
    id: string;
    homeScore: number;
    awayScore: number;
    points?: number;
    submittedAt: string;
    user: { id: string; name: string; username: string; avatar?: string };
    match: {
        id: string;
        homeScore?: number;
        awayScore?: number;
        homeTeam: { name: string; flagUrl?: string };
        awayTeam: { name: string; flagUrl?: string };
    };
    league: { id: string; name: string };
}

interface PredictionsFilters {
    page: number;
    limit: number;
    matchId?: string;
    leagueId?: string;
    userId?: string;
}

interface AdminPredictionsState {
    predictions: AdminPrediction[];
    total: number;
    filters: PredictionsFilters;
    isLoading: boolean;
    error: string | null;

    fetchPredictions: () => Promise<void>;
    setFilters: (filters: Partial<PredictionsFilters>) => void;
}

export const useAdminPredictionsStore = create<AdminPredictionsState>((set, get) => ({
    predictions: [],
    total: 0,
    filters: { page: 1, limit: 20 },
    isLoading: false,
    error: null,

    fetchPredictions: async () => {
        const { filters } = get();
        const params = new URLSearchParams({
            page: String(filters.page),
            limit: String(filters.limit),
            ...(filters.matchId && { matchId: filters.matchId }),
            ...(filters.leagueId && { leagueId: filters.leagueId }),
            ...(filters.userId && { userId: filters.userId }),
        });
        set({ isLoading: true, error: null });
        try {
            const response = await request<{ data: AdminPrediction[]; total: number }>(`/admin/predictions?${params}`);
            set({ predictions: response.data, total: response.total, isLoading: false });
        } catch (error) {
            set({ isLoading: false, error: error instanceof Error ? error.message : 'Error' });
        }
    },

    setFilters: (filters) => {
        set((state) => ({ filters: { ...state.filters, ...filters } }));
    },
}));
