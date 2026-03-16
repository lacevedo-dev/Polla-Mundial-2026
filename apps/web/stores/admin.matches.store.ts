import { create } from 'zustand';
import { request } from '../api';

export interface AdminTeam {
    id: string;
    name: string;
    code: string;
    group?: string;
    flagUrl?: string;
}

export interface AdminMatch {
    id: string;
    phase: string;
    group?: string;
    matchNumber?: number;
    matchDate: string;
    venue?: string;
    status: string;
    homeScore?: number;
    awayScore?: number;
    homeTeam: AdminTeam;
    awayTeam: AdminTeam;
}

interface MatchesFilters {
    page: number;
    limit: number;
    phase?: string;
    status?: string;
}

interface AdminMatchesState {
    matches: AdminMatch[];
    teams: AdminTeam[];
    total: number;
    filters: MatchesFilters;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    fetchMatches: () => Promise<void>;
    fetchTeams: () => Promise<void>;
    createMatch: (data: Partial<AdminMatch>) => Promise<void>;
    updateMatch: (id: string, data: Partial<AdminMatch>) => Promise<void>;
    updateScore: (id: string, homeScore: number, awayScore: number) => Promise<void>;
    deleteMatch: (id: string) => Promise<void>;
    createTeam: (data: Partial<AdminTeam>) => Promise<void>;
    updateTeam: (id: string, data: Partial<AdminTeam>) => Promise<void>;
    setFilters: (filters: Partial<MatchesFilters>) => void;
}

export const useAdminMatchesStore = create<AdminMatchesState>((set, get) => ({
    matches: [],
    teams: [],
    total: 0,
    filters: { page: 1, limit: 50 },
    isLoading: false,
    isSaving: false,
    error: null,

    fetchMatches: async () => {
        const { filters } = get();
        const params = new URLSearchParams({
            page: String(filters.page),
            limit: String(filters.limit),
            ...(filters.phase && { phase: filters.phase }),
            ...(filters.status && { status: filters.status }),
        });
        set({ isLoading: true, error: null });
        try {
            const response = await request<{ data: AdminMatch[]; total: number }>(`/admin/matches?${params}`);
            set({ matches: response.data, total: response.total, isLoading: false });
        } catch (error) {
            set({ isLoading: false, error: error instanceof Error ? error.message : 'Error' });
        }
    },

    fetchTeams: async () => {
        try {
            const teams = await request<AdminTeam[]>('/admin/teams');
            set({ teams });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Error al cargar equipos' });
        }
    },

    createMatch: async (data) => {
        set({ isSaving: true });
        try {
            const match = await request<AdminMatch>('/admin/matches', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            set((state) => ({ matches: [match, ...state.matches], total: state.total + 1, isSaving: false }));
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    updateMatch: async (id, data) => {
        set({ isSaving: true });
        try {
            const updated = await request<AdminMatch>(`/admin/matches/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            set((state) => ({
                matches: state.matches.map((m) => (m.id === id ? { ...m, ...updated } : m)),
                isSaving: false,
            }));
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    updateScore: async (id, homeScore, awayScore) => {
        set({ isSaving: true });
        try {
            const updated = await request<AdminMatch>(`/admin/matches/${id}/score`, {
                method: 'PATCH',
                body: JSON.stringify({ homeScore, awayScore }),
            });
            set((state) => ({
                matches: state.matches.map((m) => (m.id === id ? { ...m, ...updated, homeScore, awayScore, status: 'FINISHED' } : m)),
                isSaving: false,
            }));
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    deleteMatch: async (id) => {
        set({ isSaving: true });
        try {
            await request(`/admin/matches/${id}`, { method: 'DELETE' });
            set((state) => ({
                matches: state.matches.filter((m) => m.id !== id),
                total: state.total - 1,
                isSaving: false,
            }));
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    createTeam: async (data) => {
        set({ isSaving: true });
        try {
            const team = await request<AdminTeam>('/admin/teams', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            set((state) => ({ teams: [...state.teams, team], isSaving: false }));
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    updateTeam: async (id, data) => {
        set({ isSaving: true });
        try {
            const updated = await request<AdminTeam>(`/admin/teams/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            set((state) => ({
                teams: state.teams.map((t) => (t.id === id ? { ...t, ...updated } : t)),
                isSaving: false,
            }));
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    setFilters: (filters) => {
        set((state) => ({ filters: { ...state.filters, ...filters } }));
    },
}));
