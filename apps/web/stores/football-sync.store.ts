import { create } from 'zustand';
import { request } from '../api';
import type {
  MonitoringDashboard,
  SyncHistoryResponse,
  SyncHistoryFilter,
  AlertsResponse,
  AlertsFilter,
  FootballSyncConfig,
  UpdateConfig,
  SyncStats,
} from '../types/football-sync';

interface FootballSyncStore {
  // State
  dashboard: MonitoringDashboard | null;
  history: SyncHistoryResponse | null;
  alerts: AlertsResponse | null;
  config: FootballSyncConfig | null;
  stats: SyncStats | null;

  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDashboard: () => Promise<void>;
  fetchHistory: (filter: SyncHistoryFilter) => Promise<void>;
  fetchAlerts: (filter: AlertsFilter) => Promise<void>;
  fetchConfig: () => Promise<void>;
  fetchStats: (period: 'today' | 'week' | 'month') => Promise<void>;

  updateConfig: (data: UpdateConfig) => Promise<void>;
  resetConfig: () => Promise<void>;

  resolveAlert: (alertId: string) => Promise<void>;
  resolveAllAlerts: () => Promise<void>;

  pauseSync: () => Promise<void>;
  resumeSync: () => Promise<void>;
  forceSync: () => Promise<void>;

  clearError: () => void;
}

export const useFootballSyncStore = create<FootballSyncStore>((set, get) => ({
  // Initial state
  dashboard: null,
  history: null,
  alerts: null,
  config: null,
  stats: null,
  isLoading: false,
  error: null,

  // Dashboard
  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const dashboard = await request<MonitoringDashboard>(
        '/admin/football/monitoring/dashboard'
      );
      set({ dashboard, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar dashboard',
        isLoading: false
      });
    }
  },

  // History
  fetchHistory: async (filter: SyncHistoryFilter) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filter.page) params.append('page', filter.page.toString());
      if (filter.limit) params.append('limit', filter.limit.toString());
      if (filter.type) params.append('type', filter.type);
      if (filter.status) params.append('status', filter.status);
      if (filter.matchId) params.append('matchId', filter.matchId);
      if (filter.startDate) params.append('startDate', filter.startDate);
      if (filter.endDate) params.append('endDate', filter.endDate);

      const history = await request<SyncHistoryResponse>(
        `/admin/football/monitoring/logs?${params.toString()}`
      );
      set({ history, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar historial',
        isLoading: false
      });
    }
  },

  // Alerts
  fetchAlerts: async (filter: AlertsFilter) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filter.page) params.append('page', filter.page.toString());
      if (filter.limit) params.append('limit', filter.limit.toString());
      if (filter.type) params.append('type', filter.type);
      if (filter.severity) params.append('severity', filter.severity);
      if (filter.resolved !== undefined) {
        params.append('resolved', filter.resolved.toString());
      }
      if (filter.startDate) params.append('startDate', filter.startDate);
      if (filter.endDate) params.append('endDate', filter.endDate);

      const alerts = await request<AlertsResponse>(
        `/admin/football/monitoring/alerts?${params.toString()}`
      );
      set({ alerts, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar alertas',
        isLoading: false
      });
    }
  },

  // Config
  fetchConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await request<FootballSyncConfig>(
        '/admin/football/monitoring/config'
      );
      set({ config, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar configuración',
        isLoading: false
      });
    }
  },

  updateConfig: async (data: UpdateConfig) => {
    set({ isLoading: true, error: null });
    try {
      const config = await request<FootballSyncConfig>(
        '/admin/football/monitoring/config',
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      );
      set({ config, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al actualizar configuración',
        isLoading: false
      });
      throw error;
    }
  },

  resetConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await request<FootballSyncConfig>(
        '/admin/football/monitoring/config/reset',
        { method: 'POST' }
      );
      set({ config, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al resetear configuración',
        isLoading: false
      });
      throw error;
    }
  },

  // Stats
  fetchStats: async (period: 'today' | 'week' | 'month') => {
    set({ isLoading: true, error: null });
    try {
      const stats = await request<SyncStats>(
        `/admin/football/monitoring/stats?period=${period}`
      );
      set({ stats, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar estadísticas',
        isLoading: false
      });
    }
  },

  // Alert actions
  resolveAlert: async (alertId: string) => {
    set({ isLoading: true, error: null });
    try {
      await request(`/admin/football/monitoring/alerts/${alertId}/resolve`, {
        method: 'PATCH',
      });

      // Refresh alerts
      const currentFilter = { page: 1, limit: 20 };
      await get().fetchAlerts(currentFilter);

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al resolver alerta',
        isLoading: false
      });
      throw error;
    }
  },

  resolveAllAlerts: async () => {
    set({ isLoading: true, error: null });
    try {
      await request('/admin/football/monitoring/alerts/resolve-all', {
        method: 'POST',
      });

      // Refresh alerts
      const currentFilter = { page: 1, limit: 20 };
      await get().fetchAlerts(currentFilter);

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al resolver alertas',
        isLoading: false
      });
      throw error;
    }
  },

  // Sync control
  pauseSync: async () => {
    set({ isLoading: true, error: null });
    try {
      await request('/admin/football/monitoring/sync/pause', {
        method: 'POST',
      });

      // Refresh config and dashboard
      await Promise.all([
        get().fetchConfig(),
        get().fetchDashboard(),
      ]);

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al pausar sincronización',
        isLoading: false
      });
      throw error;
    }
  },

  resumeSync: async () => {
    set({ isLoading: true, error: null });
    try {
      await request('/admin/football/monitoring/sync/resume', {
        method: 'POST',
      });

      // Refresh config and dashboard
      await Promise.all([
        get().fetchConfig(),
        get().fetchDashboard(),
      ]);

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al reanudar sincronización',
        isLoading: false
      });
      throw error;
    }
  },

  forceSync: async () => {
    set({ isLoading: true, error: null });
    try {
      await request('/admin/football/monitoring/sync/force', {
        method: 'POST',
      });

      // Refresh dashboard after a short delay to show updated stats
      setTimeout(() => {
        get().fetchDashboard();
      }, 2000);

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Error al forzar sincronización',
        isLoading: false
      });
      throw error;
    }
  },

  // Utility
  clearError: () => set({ error: null }),
}));
