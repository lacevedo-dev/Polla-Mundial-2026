import { create } from 'zustand';
import { request, ApiError } from '../api';

export interface DashboardStats {
  aciertos: number;
  errores: number;
  racha: number;
  tasa: number;
}

export interface DashboardLeague {
  id: string;
  nombre: string;
  posicion: number;
  tusPuntos: number;
  maxPuntos: number;
  participantes: number;
}

export interface PerformanceWeek {
  week: string;
  points: number;
}

export interface RecentPrediction {
  id: string;
  match: string;
  tuPrediccion: string;
  resultado: string;
  acierto: boolean;
  fecha: string;
}

export interface DashboardState {
  // Data
  stats: DashboardStats | null;
  leagues: DashboardLeague[] | null;
  performance: PerformanceWeek[] | null;
  predictions: RecentPrediction[] | null;

  // UI State
  loading: boolean;
  error: string | null;
  lastFetchTime: number | null;

  // Actions
  fetchDashboardData: (forceRefresh?: boolean) => Promise<void>;
  refetch: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'dashboard_cache';

interface CachedData {
  stats: DashboardStats | null;
  leagues: DashboardLeague[] | null;
  performance: PerformanceWeek[] | null;
  predictions: RecentPrediction[] | null;
  timestamp: number;
}

function getCachedData(): CachedData | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached) as CachedData;
    const isExpired = Date.now() - data.timestamp > CACHE_TTL;

    return isExpired ? null : data;
  } catch {
    return null;
  }
}

function setCachedData(data: Omit<CachedData, 'timestamp'>) {
  try {
    const cacheData: CachedData = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
  } catch {
    // Silently fail on localStorage errors
  }
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Initial state
  stats: null,
  leagues: null,
  performance: null,
  predictions: null,
  loading: false,
  error: null,
  lastFetchTime: null,

  // Actions
  fetchDashboardData: async (forceRefresh = false) => {
    const state = get();

    // Check cache
    if (!forceRefresh && state.lastFetchTime) {
      const timeSinceLastFetch = Date.now() - state.lastFetchTime;
      if (timeSinceLastFetch < CACHE_TTL) {
        return; // Use existing data
      }
    }

    // Check localStorage cache
    if (!forceRefresh) {
      const cached = getCachedData();
      if (cached) {
        set({
          stats: cached.stats,
          leagues: cached.leagues,
          performance: cached.performance,
          predictions: cached.predictions,
          lastFetchTime: cached.timestamp,
          loading: false,
          error: null,
        });
        return;
      }
    }

    set({ loading: true, error: null });

    try {
      // Fetch all endpoints in parallel
      const [statsResponse, leaguesResponse, performanceResponse, predictionsResponse] =
        await Promise.all([
          request<DashboardStats>('/dashboard/stats'),
          request<{ ligas: DashboardLeague[] }>('/dashboard/leagues'),
          request<PerformanceWeek[]>('/dashboard/performance'),
          request<{ predicciones: RecentPrediction[] }>('/dashboard/predictions/recent'),
        ]);

      const newState = {
        stats: statsResponse,
        leagues: leaguesResponse.ligas,
        performance: performanceResponse,
        predictions: predictionsResponse.predicciones,
        lastFetchTime: Date.now(),
        loading: false,
        error: null,
      };

      // Update state and cache
      set(newState);
      setCachedData({
        stats: newState.stats,
        leagues: newState.leagues,
        performance: newState.performance,
        predictions: newState.predictions,
      });
    } catch (error) {
      const errorMessage =
        error instanceof ApiError ? error.message : 'Error fetching dashboard data';
      set({
        loading: false,
        error: errorMessage,
      });
      throw error;
    }
  },

  refetch: async () => {
    await get().fetchDashboardData(true);
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      stats: null,
      leagues: null,
      performance: null,
      predictions: null,
      loading: false,
      error: null,
      lastFetchTime: null,
    });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently fail
    }
  },
}));
