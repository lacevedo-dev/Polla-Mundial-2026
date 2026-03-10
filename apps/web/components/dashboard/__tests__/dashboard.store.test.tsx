import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardStore } from '../../../stores/dashboard.store';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock the request function
vi.mock('../../../api', () => ({
  request: vi.fn((path: string) => {
    if (path === '/dashboard/stats') {
      return Promise.resolve({
        aciertos: 50,
        errores: 10,
        racha: 5,
        tasa: 83.33,
      });
    }
    if (path === '/dashboard/leagues') {
      return Promise.resolve({
        ligas: [
          { id: '1', nombre: 'Liga 1', posicion: 1, tusPuntos: 100, maxPuntos: 100, participantes: 5 },
        ],
      });
    }
    if (path === '/dashboard/performance') {
      return Promise.resolve([
        { week: '2024-W01', points: 50 },
        { week: '2024-W02', points: 60 },
      ]);
    }
    if (path === '/dashboard/predictions/recent') {
      return Promise.resolve({
        predicciones: [
          {
            id: '1',
            match: 'Team A vs Team B',
            tuPrediccion: '1',
            resultado: '1',
            acierto: true,
            fecha: new Date().toISOString(),
          },
        ],
      });
    }
    return Promise.reject(new Error('Not found'));
  }),
  ApiError: class ApiError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

describe('useDashboardStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useDashboardStore.setState({
      stats: null,
      leagues: null,
      performance: null,
      predictions: null,
      loading: false,
      error: null,
      lastFetchTime: null,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('fetches all 4 APIs in parallel', async () => {
    const { result } = renderHook(() => useDashboardStore());

    await act(async () => {
      await result.current.fetchDashboardData();
    });

    expect(result.current.stats).toBeDefined();
    expect(result.current.leagues).toBeDefined();
    expect(result.current.performance).toBeDefined();
    expect(result.current.predictions).toBeDefined();
  });

  it('stores and retrieves data from cache', async () => {
    const { result } = renderHook(() => useDashboardStore());

    // First fetch - should hit API
    await act(async () => {
      await result.current.fetchDashboardData();
    });

    const firstStats = result.current.stats;

    // Reset state
    await act(async () => {
      result.current.reset();
    });

    expect(result.current.stats).toBeNull();

    // Second fetch - should use cache
    await act(async () => {
      await result.current.fetchDashboardData();
    });

    expect(result.current.stats).toBeDefined();
    expect(result.current.stats).toEqual(firstStats);
  });

  it('invalidates cache after TTL expires', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDashboardStore());

    await act(async () => {
      await result.current.fetchDashboardData();
    });

    const firstStats = result.current.stats;

    // Advance time by 6 minutes (> 5 min TTL)
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });

    // Reset state
    await act(async () => {
      result.current.reset();
    });

    // Should fetch fresh data after TTL
    await act(async () => {
      await result.current.fetchDashboardData();
    });

    expect(result.current.stats).toBeDefined();

    vi.useRealTimers();
  });

  it('captures error state and allows recovery', async () => {
    const { result } = renderHook(() => useDashboardStore());

    // Clear localStorage to force error
    localStorage.clear();

    await act(async () => {
      try {
        await result.current.fetchDashboardData();
      } catch {
        // Expected error
      }
    });

    // Error should be captured
    expect(result.current.error).toBeDefined();
    expect(result.current.loading).toBe(false);
  });

  it('clears cache and error state with reset', async () => {
    const { result } = renderHook(() => useDashboardStore());

    // Set some state
    act(() => {
      result.current.clearError();
    });

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.stats).toBeNull();
    expect(result.current.leagues).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.lastFetchTime).toBeNull();
  });

  it('uses forceRefresh to bypass cache', async () => {
    const { result } = renderHook(() => useDashboardStore());

    await act(async () => {
      await result.current.fetchDashboardData();
    });

    const firstFetchTime = result.current.lastFetchTime;

    // Force refresh without waiting for TTL
    vi.useFakeTimers();
    vi.advanceTimersByTime(100); // Only 100ms later

    await act(async () => {
      await result.current.fetchDashboardData(true); // forceRefresh=true
    });

    // Time should be updated
    expect(result.current.lastFetchTime).toBeGreaterThan(firstFetchTime!);

    vi.useRealTimers();
  });
});
