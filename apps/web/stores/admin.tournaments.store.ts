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
    updateTournament: (id: string, data: Partial<AdminTournament>) => Promise<void>;
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
        set({ isLoading: true, error: null });
        try {
            const tournaments = await request<AdminTournament[]>('/admin/football/tournaments');
            const { filters } = get();
            
            // Aplicar filtros en el cliente
            let filtered = tournaments;
            
            if (filters.active !== undefined) {
                filtered = filtered.filter(t => t.active === filters.active);
            }
            
            if (filters.type) {
                filtered = filtered.filter(t => t.type === filters.type);
            }
            
            if (filters.search) {
                const q = filters.search.toLowerCase();
                filtered = filtered.filter(t => 
                    t.name.toLowerCase().includes(q) ||
                    t.country?.toLowerCase().includes(q) ||
                    String(t.season).includes(q)
                );
            }
            
            // Aplicar paginación
            const total = filtered.length;
            const start = (filters.page - 1) * filters.limit;
            const end = start + filters.limit;
            const paginated = filtered.slice(start, end);
            
            set({ tournaments: paginated, total, isLoading: false });
        } catch (error) {
            set({ isLoading: false, error: error instanceof Error ? error.message : 'Error al cargar torneos' });
        }
    },

    updateTournament: async (id, data) => {
        set({ isSaving: true, error: null });
        try {
            await request(`/admin/football/tournaments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
            set({ isSaving: false });
            await get().fetchTournaments();
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error al actualizar torneo' });
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
