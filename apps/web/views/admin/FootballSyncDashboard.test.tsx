import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FootballSyncDashboard from './FootballSyncDashboard';

const navigateMock = vi.fn();
const fetchDashboardMock = vi.fn();
const fetchConfigMock = vi.fn();
const forceSyncMock = vi.fn().mockResolvedValue(undefined);
const pauseSyncMock = vi.fn().mockResolvedValue(undefined);
const resumeSyncMock = vi.fn().mockResolvedValue(undefined);
const backfillTeamsMock = vi.fn().mockResolvedValue(undefined);
const fetchLinkCandidatesMock = vi.fn().mockResolvedValue([
  {
    fixtureId: '555',
    kickoff: '2026-03-19T18:15:00.000Z',
    status: 'Not Started',
    leagueName: 'World Cup',
    round: 'Group Stage',
    venue: 'Metropolitano',
    homeTeam: 'Nacional',
    awayTeam: 'Millonarios',
    confidence: 'high',
    score: 140,
    reasons: ['Equipo local coincide', 'Equipo visitante coincide'],
  },
]);
const linkMatchMock = vi.fn().mockResolvedValue(undefined);
const syncMatchMock = vi.fn().mockResolvedValue(undefined);

let storeState: any;

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../stores/football-sync.store', () => ({
  useFootballSyncStore: (selector: any) => (selector ? selector(storeState) : storeState),
}));

describe('FootballSyncDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      dashboard: {
        status: {
          isEnabled: true,
          isEmergencyMode: false,
          lastSyncAt: '2026-03-19T16:00:00.000Z',
          nextSyncIn: 90,
        },
        readiness: {
          apiKeyConfigured: true,
          autoSyncEnabled: true,
          requestsRemaining: 88,
          todayMatchesTotal: 3,
          linkedMatchesToday: 2,
          unlinkedMatchesToday: 1,
          blockers: ['1 partido de hoy sigue sin vincular a fixture externo.'],
          unlinkedMatchesPreview: [
            {
              id: 'match-1',
              homeTeam: 'Nacional',
              awayTeam: 'Millonarios',
              matchDate: '2026-03-19T18:00:00.000Z',
            },
          ],
        },
        todayStats: {
          requestsUsed: 12,
          requestsLimit: 100,
          requestsPercentage: 12,
          matchesSynced: 4,
          successfulSyncs: 4,
          failedSyncs: 1,
          averageDuration: 1800,
        },
        recentLogs: [
          {
            id: 'log-1',
            type: 'MANUAL_SYNC',
            status: 'SUCCESS',
            message: 'Sincronización manual ejecutada',
            requestsUsed: 2,
            matchesUpdated: 3,
            createdAt: '2026-03-19T16:00:00.000Z',
          },
        ],
        activeAlerts: [
          {
            id: 'alert-1',
            severity: 'WARNING',
            message: 'Quedan menos de 20 requests',
            createdAt: '2026-03-19T15:50:00.000Z',
          },
        ],
        syncChart: {
          labels: [],
          requestsUsed: [],
          matchesUpdated: [],
        },
      },
      config: {
        enabled: true,
        autoSyncEnabled: true,
      },
      isLoading: false,
      error: null,
      fetchDashboard: fetchDashboardMock,
      fetchConfig: fetchConfigMock,
      forceSync: forceSyncMock,
      pauseSync: pauseSyncMock,
      resumeSync: resumeSyncMock,
      backfillTeams: backfillTeamsMock,
      fetchLinkCandidates: fetchLinkCandidatesMock,
      linkMatch: linkMatchMock,
      syncMatch: syncMatchMock,
    };
  });

  it('renders overview content with explanatory copy and operational checklist', () => {
    render(<FootballSyncDashboard />);

    expect(screen.getByText(/qué hace este módulo/i)).toBeInTheDocument();
    expect(screen.getByText(/Checklist operativo/i)).toBeInTheDocument();
    expect(screen.getByText(/Sistema habilitado/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sincronización automática/i).length).toBeGreaterThan(0);
  }, 15000);

  it('completes the link flow from pending match to sync action', async () => {
    const user = userEvent.setup();
    render(<FootballSyncDashboard />);

    await user.click(screen.getByRole('tab', { name: /Acciones/i }));
    expect(screen.getByText(/Partidos pendientes por vincular/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Buscar fixture/i }));

    await waitFor(() => {
      expect(fetchLinkCandidatesMock).toHaveBeenCalledWith('match-1');
    });

    expect(screen.getByText(/Vincular partido con API-Football/i)).toBeInTheDocument();
    expect(screen.getByText(/World Cup/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Vincular y sincronizar/i }));

    await waitFor(() => {
      expect(linkMatchMock).toHaveBeenCalledWith('match-1', '555');
      expect(syncMatchMock).toHaveBeenCalledWith('match-1');
    });

    await user.click(screen.getByRole('tab', { name: /Actividad/i }));
    expect(screen.getAllByText(/Alertas activas/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Últimas sincronizaciones/i)).toBeInTheDocument();
  }, 15000);
});
