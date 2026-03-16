import { create } from 'zustand';
import { request } from '../api';

export interface SystemStats {
    totalUsers: number;
    totalLeagues: number;
    totalPredictions: number;
    totalRevenue: number;
    planBreakdown: Array<{ plan: string; _count: { _all: number } }>;
    leagueStatusBreakdown: Array<{ status: string; _count: { _all: number } }>;
    recentUsers: Array<{ id: string; name: string; email: string; plan: string; createdAt: string }>;
}

interface AdminState {
    stats: SystemStats | null;
    isLoading: boolean;
    error: string | null;
    fetchStats: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
    stats: null,
    isLoading: false,
    error: null,

    fetchStats: async () => {
        set({ isLoading: true, error: null });
        try {
            const stats = await request<SystemStats>('/admin/stats');
            set({ stats, isLoading: false });
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Error al cargar estadísticas',
            });
        }
    },
}));
