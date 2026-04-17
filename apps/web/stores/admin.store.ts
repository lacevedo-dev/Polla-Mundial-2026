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

export interface ResetOptions {
    predictions?: boolean;
    participations?: boolean;
    leagues?: boolean;
    payments?: boolean;
    notifications?: boolean;
    matches?: boolean;
}

export interface TestModeConfig {
    enabled: boolean;
    updatedAt?: string;
}

interface AdminState {
    stats: SystemStats | null;
    isLoading: boolean;
    error: string | null;
    testMode: TestModeConfig | null;
    fetchStats: () => Promise<void>;
    resetTestData: (options?: ResetOptions) => Promise<{ success: boolean; message: string; deletedRecords: any }>;
    getTestMode: () => Promise<TestModeConfig>;
    updateTestMode: (enabled: boolean) => Promise<{ success: boolean; message: string }>;
}

export const useAdminStore = create<AdminState>((set) => ({
    stats: null,
    isLoading: false,
    error: null,
    testMode: null,

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

    resetTestData: async (options?: ResetOptions) => {
        set({ isLoading: true, error: null });
        try {
            const result = await request<{ success: boolean; message: string; deletedRecords: any }>('/admin/system/reset-test-data', {
                method: 'POST',
                body: JSON.stringify(options || {}),
            });
            set({ isLoading: false });
            return result;
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Error al reiniciar el sistema',
            });
            throw error;
        }
    },

    getTestMode: async () => {
        try {
            const testMode = await request<TestModeConfig>('/admin/system/test-mode');
            set({ testMode });
            return testMode;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Error al obtener modo prueba',
            });
            throw error;
        }
    },

    updateTestMode: async (enabled: boolean) => {
        set({ isLoading: true, error: null });
        try {
            const result = await request<{ success: boolean; message: string; enabled: boolean }>('/admin/system/test-mode', {
                method: 'PATCH',
                body: JSON.stringify({ enabled }),
            });
            set({ 
                isLoading: false,
                testMode: { enabled: result.enabled },
            });
            return result;
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Error al actualizar modo prueba',
            });
            throw error;
        }
    },
}));
