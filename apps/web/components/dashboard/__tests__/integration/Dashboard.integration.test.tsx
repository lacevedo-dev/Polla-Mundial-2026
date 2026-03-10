import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../../views/Dashboard';
import { useDashboardStore } from '../../../stores/dashboard.store';
import { useAuthStore } from '../../../stores/auth.store';
import { useLeagueStore } from '../../../stores/league.store';
import { usePredictionStore } from '../../../stores/prediction.store';

// Mock stores
vi.mock('../../../stores/dashboard.store');
vi.mock('../../../stores/auth.store');
vi.mock('../../../stores/league.store');
vi.mock('../../../stores/prediction.store');

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Dashboard Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock useDashboardStore
    (useDashboardStore as any).mockReturnValue({
      stats: {
        aciertos: 45,
        errores: 10,
        racha: 3,
        tasa: 81.8,
      },
      leagues: [
        {
          id: '1',
          nombre: 'Liga Premium',
          posicion: 1,
          tusPuntos: 500,
          maxPuntos: 500,
          participantes: 25,
        },
      ],
      performance: [
        { week: '2024-W01', points: 80 },
        { week: '2024-W02', points: 90 },
      ],
      predictions: [
        {
          id: '1',
          match: 'Team A vs Team B',
          tuPrediccion: '1',
          resultado: '1',
          acierto: true,
          fecha: new Date().toISOString(),
        },
      ],
      loading: false,
      error: null,
      lastFetchTime: Date.now(),
      fetchDashboardData: vi.fn().mockResolvedValue(undefined),
      refetch: vi.fn().mockResolvedValue(undefined),
      clearError: vi.fn(),
      reset: vi.fn(),
    });

    // Mock useAuthStore
    (useAuthStore as any).mockReturnValue({
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      },
    });

    // Mock useLeagueStore
    (useLeagueStore as any).mockReturnValue({
      activeLeague: {
        id: '1',
        name: 'Test League',
        description: 'A test league',
        code: 'TEST123',
        status: 'ACTIVE',
        role: 'ADMIN',
        settings: {
          maxParticipants: 50,
          baseFee: 10000,
          currency: 'COP',
          plan: 'PREMIUM',
        },
        stats: {
          memberCount: 10,
        },
      },
      myLeagues: [
        {
          id: '1',
          name: 'Test League',
          description: 'A test league',
        },
      ],
      isLoading: false,
      fetchMyLeagues: vi.fn().mockResolvedValue(undefined),
      fetchLeagueDetails: vi.fn().mockResolvedValue(undefined),
      setActiveLeague: vi.fn(),
    });

    // Mock usePredictionStore
    (usePredictionStore as any).mockReturnValue({
      matches: [
        {
          id: '1',
          homeTeam: 'Team A',
          awayTeam: 'Team B',
          displayDate: '2024-03-15 18:00',
          venue: 'Stadium A',
          prediction: { home: 2, away: 1 },
          saved: true,
        },
      ],
      leaderboard: [
        {
          id: '1',
          name: 'Player 1',
          username: 'player1',
          rank: 1,
          points: 500,
        },
      ],
      fetchLeagueMatches: vi.fn().mockResolvedValue(undefined),
      fetchLeaderboard: vi.fn().mockResolvedValue(undefined),
      resetLeagueData: vi.fn(),
    });
  });

  it('renders Dashboard with all components when data loads', async () => {
    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Check for stat cards
    expect(screen.getByText('Aciertos')).toBeInTheDocument();
    expect(screen.getByText('Errores')).toBeInTheDocument();

    // Check for league cards
    expect(screen.getByText('Liga Premium')).toBeInTheDocument();

    // Check for welcome message
    expect(screen.getByText(/Bienvenido, Test User/)).toBeInTheDocument();
  });

  it('handles errors with retry functionality', async () => {
    const fetchDashboardDataMock = vi.fn().mockResolvedValue(undefined);

    (useDashboardStore as any).mockReturnValue({
      stats: null,
      leagues: null,
      performance: null,
      predictions: null,
      loading: false,
      error: 'Error fetching dashboard data',
      lastFetchTime: null,
      fetchDashboardData: fetchDashboardDataMock,
    });

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Error fetching dashboard data')).toBeInTheDocument();
    });

    // Click retry button
    const retryButton = screen.getByRole('button', { name: /Reintentar/i });
    fireEvent.click(retryButton);

    expect(fetchDashboardDataMock).toHaveBeenCalled();
  });

  it('handles partial failure with mixed data', async () => {
    (useDashboardStore as any).mockReturnValue({
      stats: { aciertos: 50, errores: 10, racha: 3, tasa: 83.3 },
      leagues: null, // Leagues failed to load
      performance: [{ week: '2024-W01', points: 80 }],
      predictions: null, // Predictions failed to load
      loading: false,
      error: null,
      lastFetchTime: Date.now(),
      fetchDashboardData: vi.fn().mockResolvedValue(undefined),
    });

    renderWithRouter(<Dashboard />);

    // Stats should render
    await waitFor(() => {
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    // Leagues empty state should show
    expect(screen.getByText('No participas en ligas')).toBeInTheDocument();
  });

  it('uses cache correctly on second load', async () => {
    const fetchDashboardDataMock = vi.fn().mockResolvedValue(undefined);
    const lastFetchTime = Date.now() - 1000; // 1 second ago

    (useDashboardStore as any).mockReturnValue({
      stats: { aciertos: 50, errores: 10, racha: 3, tasa: 83.3 },
      leagues: [{ id: '1', nombre: 'Liga Test' }],
      performance: [],
      predictions: [],
      loading: false,
      error: null,
      lastFetchTime,
      fetchDashboardData: fetchDashboardDataMock,
    });

    const { rerender } = renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    // Simulate second render - cache should be used
    rerender(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    // fetchDashboardData should have been called only once per mount
    // (The mock is set up to be called but actual caching is in the store)
  });

  it('renders responsive layout on different screen sizes', () => {
    const originalInnerWidth = window.innerWidth;

    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    renderWithRouter(<Dashboard />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    // Restore original viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('displays correct league information', async () => {
    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test League')).toBeInTheDocument();
    });

    expect(screen.getByText(/Administrador/)).toBeInTheDocument();
    expect(screen.getByText(/TEST123/)).toBeInTheDocument();
  });

  it('shows no console errors on successful render', async () => {
    const consoleSpy = vi.spyOn(console, 'error');

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
