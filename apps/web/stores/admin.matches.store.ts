import { create } from 'zustand';
import { request, BASE_URL } from '../api';
import type { FootballMatchLinkCandidate } from '../types/football-sync';

export interface AdminTeam {
    id: string;
    name: string;
    code: string;
    group?: string;
    flagUrl?: string;
}

export interface AdminTournament {
    id: string;
    name: string;
    country?: string;
    season: number;
    logoUrl?: string;
    type: string;
    active: boolean;
}

export interface AdminMatch {
    id: string;
    phase: string;
    round?: string | null;
    group?: string;
    matchNumber?: number;
    matchDate: string;
    venue?: string;
    status: string;
    homeScore?: number;
    awayScore?: number;
    externalId?: string | null;
    tournamentId?: string | null;
    tournamentName?: string | null;
    tournamentLogo?: string | null;
    lastSyncAt?: string | null;
    syncCount?: number;
    lastSyncStatus?: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED' | null;
    lastSyncMessage?: string | null;
    lastSyncError?: string | null;
    lastSyncTriggeredBy?: string | null;
    currentLinkSource?: 'manual' | 'suggested' | null;
    homeTeam: AdminTeam;
    awayTeam: AdminTeam;
}

export interface AdminMatchesSummary {
    blocked: number;
    failing: number;
    healthy: number;
    pending: number;
}

export interface AdminMatchSyncLog {
    id: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
    type: string;
    message: string;
    details?: string | null;
    requestsUsed?: number;
    matchesUpdated?: number;
    duration?: number | null;
    externalId?: string | null;
    error?: string | null;
    triggeredBy?: string | null;
    createdAt: string;
}

export interface ApiCallLog {
    id: string;
    date: string;
    endpoint: string;
    params?: string | null;
    responseStatus: number;
    matchesFetched: number;
    externalId?: string | null;
    responseBody?: string | null;
    createdAt: string;
}

export interface AdminMatchLinkAudit {
    id: string;
    action: string;
    detail?: string | null;
    detailData?: {
        matchId?: string;
        previousExternalId?: string | null;
        externalId?: string | null;
        linkSource?: 'manual' | 'suggested';
    } | null;
    createdAt: string;
    user?: {
        id: string;
        name: string;
        email: string;
    } | null;
}

interface MatchesFilters {
    page: number;
    limit: number;
    phase?: string;
    status?: string;
    linked?: 'true' | 'false';
    risk?: 'blocked' | 'failing' | 'healthy';
    linkSource?: 'manual' | 'suggested';
    tournamentId?: string;
    startDate?: string;
    endDate?: string;
}

interface AdminMatchesState {
    matches: AdminMatch[];
    teams: AdminTeam[];
    tournaments: AdminTournament[];
    total: number;
    summary: AdminMatchesSummary;
    filters: MatchesFilters;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    fetchMatches: () => Promise<void>;
    fetchTeams: () => Promise<void>;
    fetchTournaments: () => Promise<void>;
    createMatch: (data: Partial<AdminMatch>) => Promise<void>;
    updateMatch: (id: string, data: Partial<AdminMatch>) => Promise<void>;
    updateScore: (id: string, homeScore: number, awayScore: number) => Promise<void>;
    resendPredictionReport: (id: string) => Promise<{ message: string; leagues: number; recipients: number }>;
    resendResultsReport: (id: string) => Promise<{ message: string; leagues: number; recipients: number }>;
    getMatchPreviewLeagues: (id: string) => Promise<{ id: string; name: string; code: string }[]>;
    getMatchLeagueRecipients: (matchId: string, leagueId: string) => Promise<{ emails: string[]; count: number }>;
    getEmailPreviewHtml: (id: string, type: 'start' | 'results', leagueId: string) => Promise<string>;
    syncMatch: (id: string) => Promise<void>;
    fetchLinkCandidates: (id: string) => Promise<FootballMatchLinkCandidate[]>;
    fetchMatchHistory: (id: string) => Promise<{ syncLogs: AdminMatchSyncLog[]; linkAudit: AdminMatchLinkAudit[] }>;
    autoLinkAndSync: (id: string) => Promise<{ wasLinked: boolean; candidate?: any; synced: boolean; message: string }>;
    bulkAutoLink: () => Promise<{ attempted: number; linked: number; skipped: number; failed: number; results: Array<{ matchId: string; label: string; status: string; message: string }> }>;
    getMatchApiHistory: (id: string) => Promise<ApiCallLog[]>;
    deleteMatch: (id: string) => Promise<void>;
    createTeam: (data: Partial<AdminTeam>) => Promise<void>;
    updateTeam: (id: string, data: Partial<AdminTeam>) => Promise<void>;
    setFilters: (filters: Partial<MatchesFilters>) => void;
}

export const useAdminMatchesStore = create<AdminMatchesState>((set, get) => ({
    matches: [],
    teams: [],
    tournaments: [],
    total: 0,
    summary: { blocked: 0, failing: 0, healthy: 0, pending: 0 },
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
            ...(filters.linked && { linked: filters.linked }),
            ...(filters.risk && { risk: filters.risk }),
            ...(filters.linkSource && { linkSource: filters.linkSource }),
            ...(filters.tournamentId && { tournamentId: filters.tournamentId }),
            ...(filters.startDate && { startDate: filters.startDate }),
            ...(filters.endDate && { endDate: filters.endDate }),
        });
        set({ isLoading: true, error: null });
        try {
            const response = await request<{ data: AdminMatch[]; total: number; summary: AdminMatchesSummary }>(`/admin/matches?${params}`);
            set({ matches: response.data, total: response.total, summary: response.summary, isLoading: false });
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

    fetchTournaments: async () => {
        try {
            const tournaments = await request<AdminTournament[]>('/admin/football/tournaments');
            set({ tournaments });
        } catch {
            // non-critical, silently ignore
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

    resendPredictionReport: async (id) => {
        set({ isSaving: true, error: null });
        try {
            const result = await request<{ message: string; leagues: number; recipients: number }>(
                `/admin/prediction-report/resend-start/${id}`,
                { method: 'POST' },
            );
            set({ isSaving: false });
            return result;
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    resendResultsReport: async (id) => {
        set({ isSaving: true, error: null });
        try {
            const result = await request<{ message: string; leagues: number; recipients: number }>(
                `/admin/prediction-report/resend-results/${id}`,
                { method: 'POST' },
            );
            set({ isSaving: false });
            return result;
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    getMatchPreviewLeagues: async (id) => {
        return request<{ id: string; name: string; code: string }[]>(
            `/admin/prediction-report/leagues/${id}`,
        );
    },

    getMatchLeagueRecipients: async (matchId, leagueId) => {
        return request<{ emails: string[]; count: number }>(
            `/admin/prediction-report/recipients/${matchId}/${leagueId}`,
        );
    },

    getEmailPreviewHtml: async (id, type, leagueId) => {
        const token = localStorage.getItem('token');
        const path = type === 'start'
            ? `/admin/prediction-report/preview/${id}/${leagueId}`
            : `/admin/prediction-report/preview-results/${id}/${leagueId}`;
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error('Error al cargar preview del correo');
        return response.text();
    },

    syncMatch: async (id) => {
        set({ isSaving: true });
        try {
            await request(`/admin/football/sync-match/${id}`, {
                method: 'POST',
            });
            await get().fetchMatches();
            set({ isSaving: false });
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    fetchLinkCandidates: async (id) => {
        set({ isSaving: true, error: null });
        try {
            const candidates = await request<FootballMatchLinkCandidate[]>(`/admin/football/match/${id}/candidates`);
            set({ isSaving: false });
            return candidates;
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    fetchMatchHistory: async (id) => {
        set({ isSaving: true, error: null });
        try {
            const history = await request<{ syncLogs: AdminMatchSyncLog[]; linkAudit: AdminMatchLinkAudit[] }>(`/admin/matches/${id}/sync-history`);
            set({ isSaving: false });
            return history;
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    autoLinkAndSync: async (id) => {
        return request<{ wasLinked: boolean; candidate?: any; synced: boolean; message: string }>(
            `/admin/football/auto-link-and-sync/${id}`,
            { method: 'POST' },
        );
    },

    bulkAutoLink: async () => {
        return request<{ attempted: number; linked: number; skipped: number; failed: number; results: Array<{ matchId: string; label: string; status: string; message: string }> }>(
            `/admin/football/bulk-auto-link`,
            { method: 'POST' },
        );
    },

    getMatchApiHistory: async (id) => {
        return request<ApiCallLog[]>(`/admin/football/match/${id}/api-history`);
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
