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
  puntos: number;
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
  lastLeagueId: string | null;

  // Actions
  fetchDashboardData: (forceRefresh?: boolean, leagueId?: string | null) => Promise<void>;
  refetch: (leagueId?: string | null) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'dashboard_cache';
const CACHE_VERSION = 2; // Increment when data shape changes to bust stale caches

interface CachedData {
  version?: number;
  leagueId?: string | null;
  stats: DashboardStats | null;
  leagues: DashboardLeague[] | null;
  performance: PerformanceWeek[] | null;
  predictions: RecentPrediction[] | null;
  timestamp: number;
}

/**
 * Validates that cached stats have the expected primitive types.
 * Returns null if the shape is invalid to prevent React #185 (object-as-child).
 */
function isValidStats(stats: unknown): stats is DashboardStats {
  if (!stats || typeof stats !== 'object') return false;
  const s = stats as Record<string, unknown>;
  return (
    typeof s['aciertos'] === 'number' &&
    typeof s['errores'] === 'number' &&
    typeof s['racha'] === 'number' &&
    typeof s['tasa'] === 'number'
  );
}

function isValidLeagueArray(leagues: unknown): leagues is DashboardLeague[] {
  if (!Array.isArray(leagues)) return false;
  return leagues.every(
    (l) =>
      l &&
      typeof l === 'object' &&
      typeof (l as Record<string, unknown>)['id'] === 'string' &&
      typeof (l as Record<string, unknown>)['nombre'] === 'string' &&
      typeof (l as Record<string, unknown>)['posicion'] === 'number' &&
      typeof (l as Record<string, unknown>)['tusPuntos'] === 'number' &&
      typeof (l as Record<string, unknown>)['maxPuntos'] === 'number' &&
      typeof (l as Record<string, unknown>)['participantes'] === 'number',
  );
}

function isValidPerformanceArray(perf: unknown): perf is PerformanceWeek[] {
  if (!Array.isArray(perf)) return false;
  return perf.every(
    (p) =>
      p &&
      typeof p === 'object' &&
      typeof (p as Record<string, unknown>)['week'] === 'string' &&
      typeof (p as Record<string, unknown>)['points'] === 'number',
  );
}

function isValidPredictionArray(preds: unknown): preds is RecentPrediction[] {
  if (!Array.isArray(preds)) return false;
  return preds.every(
    (p) =>
      p &&
      typeof p === 'object' &&
      typeof (p as Record<string, unknown>)['id'] === 'string' &&
      typeof (p as Record<string, unknown>)['match'] === 'string' &&
      typeof (p as Record<string, unknown>)['tuPrediccion'] === 'string' &&
      typeof (p as Record<string, unknown>)['resultado'] === 'string' &&
      typeof (p as Record<string, unknown>)['acierto'] === 'boolean' &&
      typeof (p as Record<string, unknown>)['puntos'] === 'number' &&
      typeof (p as Record<string, unknown>)['fecha'] === 'string',
  );
}

function getCachedData(): CachedData | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached) as CachedData;

    // Bust stale caches from older app versions with different data shapes
    if (!data.version || data.version < CACHE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const isExpired = Date.now() - data.timestamp > CACHE_TTL;
    if (isExpired) return null;

    // Validate shapes to prevent React #185 from stale/corrupt cached data
    const validatedData: CachedData = {
      version: data.version,
      leagueId: data.leagueId ?? null,
      timestamp: data.timestamp,
      stats: isValidStats(data.stats) ? data.stats : null,
      leagues: isValidLeagueArray(data.leagues) ? data.leagues : null,
      performance: isValidPerformanceArray(data.performance) ? data.performance : null,
      predictions: isValidPredictionArray(data.predictions) ? data.predictions : null,
    };

    return validatedData;
  } catch {
    return null;
  }
}

function setCachedData(data: Omit<CachedData, 'timestamp' | 'version'>) {
  try {
    const cacheData: CachedData = {
      ...data,
      version: CACHE_VERSION,
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
  lastLeagueId: null,

  // Actions
  fetchDashboardData: async (forceRefresh = false, leagueId = null) => {
    const state = get();

    // Check cache
    if (!forceRefresh && state.lastFetchTime && state.lastLeagueId === leagueId) {
      const timeSinceLastFetch = Date.now() - state.lastFetchTime;
      if (timeSinceLastFetch < CACHE_TTL) {
        return; // Use existing data
      }
    }

    // Check localStorage cache
    if (!forceRefresh) {
      const cached = getCachedData();
      if (cached && (cached.leagueId ?? null) === leagueId) {
        set({
          stats: cached.stats,
          leagues: cached.leagues,
          performance: cached.performance,
          predictions: cached.predictions,
          lastFetchTime: cached.timestamp,
          lastLeagueId: cached.leagueId ?? null,
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
          request<{ predicciones: RecentPrediction[] }>(
            leagueId ? `/dashboard/predictions/recent?leagueId=${leagueId}` : '/dashboard/predictions/recent',
          ),
        ]);

      const newState = {
        stats: isValidStats(statsResponse) ? statsResponse : null,
        leagues: isValidLeagueArray(leaguesResponse?.ligas) ? leaguesResponse.ligas : null,
        performance: isValidPerformanceArray(performanceResponse) ? performanceResponse : null,
        predictions: isValidPredictionArray(predictionsResponse?.predicciones) ? predictionsResponse.predicciones : null,
        lastFetchTime: Date.now(),
        lastLeagueId: leagueId,
        loading: false,
        error: null,
      };

      // Update state and cache
      set(newState);
      setCachedData({
        leagueId,
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

  refetch: async (leagueId = null) => {
    await get().fetchDashboardData(true, leagueId);
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
      lastLeagueId: null,
    });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently fail
    }
  },
}));
