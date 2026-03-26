import { create } from 'zustand';
import { request } from '../api';

export interface AdminPrediction {
    id: string;
    homeScore: number;
    awayScore: number;
    points?: number;
    pointDetail?: string | null;
    advanceTeamId?: string | null;
    submittedAt: string;
    user: { id: string; name: string; username: string; avatar?: string };
    match: {
        id: string;
        matchDate: string;
        phase?: string | null;
        group?: string | null;
        round?: string | null;
        status?: string | null;
        homeScore?: number;
        awayScore?: number;
        homeTeam: { id: string; name: string; flagUrl?: string; code?: string | null };
        awayTeam: { id: string; name: string; flagUrl?: string; code?: string | null };
    };
    league: { id: string; name: string };
}

export interface AdminPredictionFilterOption {
    id: string;
    name: string;
}

export interface AdminPredictionFiltersResponse {
    leagues: AdminPredictionFilterOption[];
    teams: AdminPredictionFilterOption[];
    players: AdminPredictionFilterOption[];
    groups: string[];
    phases: string[];
    rounds: string[];
}

interface PredictionsFilters {
    page: number;
    limit: number;
    matchId?: string;
    leagueId?: string;
    userId?: string;
    search?: string;
    team?: string;
    phase?: string;
    group?: string;
    round?: string;
}

interface AdminPredictionsState {
    predictions: AdminPrediction[];
    total: number;
    filters: PredictionsFilters;
    filterOptions: AdminPredictionFiltersResponse;
    isLoading: boolean;
    isLoadingFilters: boolean;
    error: string | null;

    fetchPredictions: () => Promise<void>;
    fetchFilterOptions: () => Promise<void>;
    setFilters: (filters: Partial<PredictionsFilters>) => void;
}

const EMPTY_FILTER_OPTIONS: AdminPredictionFiltersResponse = {
    leagues: [],
    teams: [],
    players: [],
    groups: [],
    phases: [],
    rounds: [],
};

export const useAdminPredictionsStore = create<AdminPredictionsState>((set, get) => ({
    predictions: [],
    total: 0,
    filters: { page: 1, limit: 20 },
    filterOptions: EMPTY_FILTER_OPTIONS,
    isLoading: false,
    isLoadingFilters: false,
    error: null,

    fetchPredictions: async () => {
        const { filters } = get();
        const params = new URLSearchParams({
            page: String(filters.page),
            limit: String(filters.limit),
            ...(filters.matchId && { matchId: filters.matchId }),
            ...(filters.leagueId && { leagueId: filters.leagueId }),
            ...(filters.userId && { userId: filters.userId }),
            ...(filters.search && { search: filters.search }),
            ...(filters.team && { team: filters.team }),
            ...(filters.phase && { phase: filters.phase }),
            ...(filters.group && { group: filters.group }),
            ...(filters.round && { round: filters.round }),
        });
        set({ isLoading: true, error: null });
        try {
            const response = await request<{ data: AdminPrediction[]; total: number }>(`/admin/predictions?${params}`);
            set({ predictions: response.data, total: response.total, isLoading: false });
        } catch (error) {
            set({ isLoading: false, error: error instanceof Error ? error.message : 'Error' });
        }
    },

    fetchFilterOptions: async () => {
        const { filters } = get();
        const params = new URLSearchParams({
            ...(filters.leagueId && { leagueId: filters.leagueId }),
        });
        set({ isLoadingFilters: true });
        try {
            const response = await request<AdminPredictionFiltersResponse>(`/admin/predictions/filters?${params}`);
            set({ filterOptions: response, isLoadingFilters: false });
        } catch {
            set({ isLoadingFilters: false });
        }
    },

    setFilters: (filters) => {
        set((state) => ({ filters: { ...state.filters, ...filters } }));
    },
}));
