import { create } from 'zustand';
import { request } from '../api';

export interface AdminLeagueTournament {
    id: string;
    name: string;
    logoUrl?: string;
    season: number;
    country?: string;
    active: boolean;
    addedAt: string;
    isPrimary: boolean;
}

export interface AdminLeague {
    id: string;
    name: string;
    description?: string;
    code: string;
    status: string;
    plan: string;
    privacy: string;
    currency: string;
    createdAt: string;
    primaryTournamentId?: string | null;
    _count?: { members: number; predictions: number };
}

export interface AdminLeagueMember {
    id: string;
    role: string;
    status: string;
    joinedAt: string;
    user: { id: string; name: string; email: string; avatar?: string; plan: string };
}

export interface AdminLeagueMatch {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number | null;
    awayScore: number | null;
    phase: string;
    matchDate: string;
    status: string;
    tournamentId: string | null;
    homeTeam: { name: string; shortCode: string | null; flagUrl: string | null };
    awayTeam: { name: string; shortCode: string | null; flagUrl: string | null };
    activeInLeague: boolean;
    addedAt?: string;
}

interface LeaguesFilters {
    page: number;
    limit: number;
    search: string;
    status?: string;
    plan?: string;
}

interface AdminLeaguesState {
    leagues: AdminLeague[];
    selectedLeague: AdminLeague | null;
    members: AdminLeagueMember[];
    leagueTournaments: AdminLeagueTournament[];
    leagueMatches: AdminLeagueMatch[];
    total: number;
    filters: LeaguesFilters;
    isLoading: boolean;
    isLoadingMatches: boolean;
    isSaving: boolean;
    error: string | null;

    fetchLeagues: () => Promise<void>;
    fetchLeague: (id: string) => Promise<void>;
    fetchLeagueMembers: (id: string) => Promise<void>;
    fetchLeagueTournaments: (id: string) => Promise<void>;
    fetchLeagueMatches: (leagueId: string, filters?: { tournamentId?: string; phase?: string }) => Promise<void>;
    createLeague: (data: { name: string; description?: string; plan?: string; privacy?: string }) => Promise<AdminLeague>;
    updateLeague: (id: string, data: Partial<{ status: string; plan: string; name: string; description: string }>) => Promise<void>;
    addLeagueTournament: (leagueId: string, tournamentId: string) => Promise<void>;
    removeLeagueTournament: (leagueId: string, tournamentId: string) => Promise<void>;
    setPrimaryTournament: (leagueId: string, tournamentId: string) => Promise<void>;
    activateMatch: (leagueId: string, matchId: string) => Promise<void>;
    deactivateMatch: (leagueId: string, matchId: string) => Promise<void>;
    activateAllTournamentMatches: (leagueId: string, tournamentId: string) => Promise<void>;
    banMember: (leagueId: string, userId: string) => Promise<void>;
    setFilters: (filters: Partial<LeaguesFilters>) => void;
}

export const useAdminLeaguesStore = create<AdminLeaguesState>((set, get) => ({
    leagues: [],
    selectedLeague: null,
    members: [],
    leagueTournaments: [],
    leagueMatches: [],
    total: 0,
    filters: { page: 1, limit: 20, search: '' },
    isLoading: false,
    isLoadingMatches: false,
    isSaving: false,
    error: null,

    fetchLeagues: async () => {
        const { filters } = get();
        const params = new URLSearchParams({
            page: String(filters.page),
            limit: String(filters.limit),
            ...(filters.search && { search: filters.search }),
            ...(filters.status && { status: filters.status }),
            ...(filters.plan && { plan: filters.plan }),
        });
        set({ isLoading: true, error: null });
        try {
            const response = await request<{ data: AdminLeague[]; total: number; page: number; limit: number }>(`/admin/leagues?${params}`);
            set({ leagues: response.data, total: response.total, isLoading: false });
        } catch (error) {
            set({ isLoading: false, error: error instanceof Error ? error.message : 'Error al cargar pollas' });
        }
    },

    fetchLeague: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const league = await request<AdminLeague>(`/admin/leagues/${id}`);
            set({ selectedLeague: league, isLoading: false });
        } catch (error) {
            set({ isLoading: false, error: error instanceof Error ? error.message : 'Error' });
        }
    },

    fetchLeagueMembers: async (id) => {
        set({ isLoading: true });
        try {
            const members = await request<AdminLeagueMember[]>(`/admin/leagues/${id}/members`);
            set({ members, isLoading: false });
        } catch (error) {
            set({ isLoading: false, error: error instanceof Error ? error.message : 'Error' });
        }
    },

    createLeague: async (data) => {
        set({ isSaving: true });
        try {
            const league = await request<AdminLeague>('/admin/leagues', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            set((s) => ({ leagues: [league, ...s.leagues], total: s.total + 1, isSaving: false }));
            return league;
        } catch (error) {
            set({ isSaving: false });
            throw error;
        }
    },

    updateLeague: async (id, data) => {
        set({ isSaving: true });
        try {
            const updated = await request<AdminLeague>(`/admin/leagues/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            set((state) => ({
                leagues: state.leagues.map((l) => (l.id === id ? { ...l, ...updated } : l)),
                selectedLeague: state.selectedLeague?.id === id ? { ...state.selectedLeague, ...updated } : state.selectedLeague,
                isSaving: false,
            }));
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    fetchLeagueTournaments: async (id) => {
        try {
            const data = await request<{ primaryTournamentId: string | null; tournaments: AdminLeagueTournament[] }>(`/admin/leagues/${id}/tournaments`);
            set({ leagueTournaments: data.tournaments });
            // Sync primaryTournamentId back to selectedLeague
            set((state) => ({
                selectedLeague: state.selectedLeague?.id === id
                    ? { ...state.selectedLeague, primaryTournamentId: data.primaryTournamentId }
                    : state.selectedLeague,
            }));
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Error al cargar torneos' });
            throw error;
        }
    },

    addLeagueTournament: async (leagueId, tournamentId) => {
        set({ isSaving: true });
        try {
            await request(`/admin/leagues/${leagueId}/tournaments/${tournamentId}`, { method: 'POST' });
            await get().fetchLeagueTournaments(leagueId);
            set({ isSaving: false });
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    removeLeagueTournament: async (leagueId, tournamentId) => {
        set({ isSaving: true });
        try {
            await request(`/admin/leagues/${leagueId}/tournaments/${tournamentId}`, { method: 'DELETE' });
            await get().fetchLeagueTournaments(leagueId);
            set({ isSaving: false });
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    setPrimaryTournament: async (leagueId, tournamentId) => {
        set({ isSaving: true });
        try {
            await request(`/admin/leagues/${leagueId}/tournaments/${tournamentId}/set-primary`, { method: 'PATCH' });
            await get().fetchLeagueTournaments(leagueId);
            set({ isSaving: false });
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    fetchLeagueMatches: async (leagueId, filters = {}) => {
        set({ isLoadingMatches: true });
        try {
            const params = new URLSearchParams();
            if (filters.tournamentId) params.set('tournamentId', filters.tournamentId);
            if (filters.phase) params.set('phase', filters.phase);

            const res = await request(`/admin/leagues/${leagueId}/matches?${params}`);
            set({ leagueMatches: res, isLoadingMatches: false });
        } catch (error) {
            set({ isLoadingMatches: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    activateMatch: async (leagueId, matchId) => {
        try {
            await request(`/admin/leagues/${leagueId}/matches/${matchId}/activate`, { method: 'POST' });
            // Actualizar localmente
            set((state) => ({
                leagueMatches: state.leagueMatches.map((m) =>
                    m.id === matchId ? { ...m, activeInLeague: true, addedAt: new Date().toISOString() } : m
                ),
            }));
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    deactivateMatch: async (leagueId, matchId) => {
        try {
            await request(`/admin/leagues/${leagueId}/matches/${matchId}`, { method: 'DELETE' });
            // Actualizar localmente
            set((state) => ({
                leagueMatches: state.leagueMatches.map((m) =>
                    m.id === matchId ? { ...m, activeInLeague: false } : m
                ),
            }));
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    activateAllTournamentMatches: async (leagueId, tournamentId) => {
        set({ isSaving: true });
        try {
            await request(`/admin/leagues/${leagueId}/tournaments/${tournamentId}/activate-all-matches`, { method: 'POST' });
            // Refrescar lista de partidos
            await get().fetchLeagueMatches(leagueId, { tournamentId });
            set({ isSaving: false });
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    banMember: async (leagueId, userId) => {
        set({ isSaving: true });
        try {
            await request(`/admin/leagues/${leagueId}/members/${userId}/ban`, { method: 'PATCH' });
            set((state) => ({
                members: state.members.map((m) =>
                    m.user.id === userId ? { ...m, status: 'BANNED' } : m
                ),
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
