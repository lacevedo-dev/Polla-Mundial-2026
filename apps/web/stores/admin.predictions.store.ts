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

export interface AdminFormMember {
    id: string;
    name: string;
    username: string;
}

export interface AdminFormMatch {
    id: string;
    matchDate: string;
    phase?: string | null;
    group?: string | null;
    round?: string | null;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam: { id: string; name: string; flagUrl?: string | null; code?: string | null };
    awayTeam: { id: string; name: string; flagUrl?: string | null; code?: string | null };
}

export interface AdminFormOptionsResponse {
    leagues: AdminPredictionFilterOption[];
    members: AdminFormMember[];
    matches: AdminFormMatch[];
}

export interface AdminSubmitForUserPayload {
    userId: string;
    matchId: string;
    leagueId: string;
    homeScore: number;
    awayScore: number;
    advanceTeamId?: string;
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
    formOptions: AdminFormOptionsResponse;
    isLoading: boolean;
    isLoadingFilters: boolean;
    isLoadingFormOptions: boolean;
    isSubmittingForUser: boolean;
    error: string | null;

    fetchPredictions: () => Promise<void>;
    fetchFilterOptions: () => Promise<void>;
    fetchFormOptions: (leagueId?: string) => Promise<void>;
    submitForUser: (payload: AdminSubmitForUserPayload) => Promise<void>;
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

const EMPTY_FORM_OPTIONS: AdminFormOptionsResponse = {
    leagues: [],
    members: [],
    matches: [],
};

export const useAdminPredictionsStore = create<AdminPredictionsState>((set, get) => ({
    predictions: [],
    total: 0,
    filters: { page: 1, limit: 20 },
    filterOptions: EMPTY_FILTER_OPTIONS,
    formOptions: EMPTY_FORM_OPTIONS,
    isLoading: false,
    isLoadingFilters: false,
    isLoadingFormOptions: false,
    isSubmittingForUser: false,
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

    fetchFormOptions: async (leagueId?: string) => {
        const params = new URLSearchParams({
            ...(leagueId && { leagueId }),
        });
        set({ isLoadingFormOptions: true });
        try {
            const response = await request<AdminFormOptionsResponse>(`/admin/predictions/form-options?${params}`);
            set({ formOptions: response, isLoadingFormOptions: false });
        } catch {
            set({ isLoadingFormOptions: false });
        }
    },

    submitForUser: async (payload) => {
        set({ isSubmittingForUser: true });
        try {
            await request('/admin/predictions/for-user', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            set({ isSubmittingForUser: false });
            await get().fetchPredictions();
        } catch (error) {
            set({ isSubmittingForUser: false });
            throw error;
        }
    },

    setFilters: (filters) => {
        set((state) => ({ filters: { ...state.filters, ...filters } }));
    },
}));
