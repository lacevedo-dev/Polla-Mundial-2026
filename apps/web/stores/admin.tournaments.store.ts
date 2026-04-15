import { create } from 'zustand';
import { request } from '../api';

export interface AdminTournament {
    id: string;
    name: string;
    country?: string;
    season: number;
    logoUrl?: string;
    type: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface TournamentFilters {
    page: number;
    limit: number;
    active?: boolean;
    type?: string;
    search?: string;
}

interface AdminTournamentsState {
    tournaments: AdminTournament[];
    total: number;
    filters: TournamentFilters;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    fetchTournaments: () => Promise<void>;
    createTournament: (data: Partial<AdminTournament>) => Promise<void>;
    updateTournament: (id: string, data: Partial<AdminTournament>) => Promise<void>;
    deleteTournament: (id: string) => Promise<void>;
    setFilters: (filters: Partial<TournamentFilters>) => void;
}

export const useAdminTournamentsStore = create<AdminTournamentsState>((set, get) => ({
    tournaments: [],
    total: 0,
    filters: { page: 1, limit: 20 },
    isLoading: false,
    isSaving: false,
    error: null,

    fetchTournaments: async () => {
        const { filters } = get();
        const params = new URLSearchParams({
            page: String(filters.page),
            limit: String(filters.limit),
        });
        if (filters.active !== undefined) params.append('active', String(filters.active));
        if (filters.type) params.append('type', filters.type);
        if (filters.search) params.append('search', filters.search);

        set({ isLoading: true, error: null });
        try {
            const response = await request<{ data: AdminTournament[]; total: number }>(`/admin/tournaments?${params}`);
            set({ tournaments: response.data, total: response.total, isLoading: false });
        } catch (error) {
            set({ isLoading: false, error: error instanceof Error ? error.message : 'Error al cargar torneos' });
        }
    },

    createTournament: async (data) => {
        set({ isSaving: true, error: null });
        try {
            await request('/admin/tournaments', { method: 'POST', body: JSON.stringify(data) });
            set({ isSaving: false });
            await get().fetchTournaments();
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error al crear torneo' });
            throw error;
        }
    },

    updateTournament: async (id, data) => {
        set({ isSaving: true, error: null });
        try {
            await request(`/admin/tournaments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
            set({ isSaving: false });
            await get().fetchTournaments();
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error al actualizar torneo' });
            throw error;
        }
    },

    deleteTournament: async (id) => {
        set({ isSaving: true, error: null });
        try {
            await request(`/admin/tournaments/${id}`, { method: 'DELETE' });
            set({ isSaving: false });
            await get().fetchTournaments();
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error al eliminar torneo' });
            throw error;
        }
    },

    setFilters: (newFilters) => {
        set((state) => ({
            filters: { ...state.filters, ...newFilters },
        }));
        get().fetchTournaments();
    },
}));
