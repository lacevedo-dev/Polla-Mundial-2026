import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminSyncPlan from './AdminSyncPlan';

const requestMock = vi.fn();

vi.mock('../../api', () => ({
  BASE_URL: 'http://localhost',
  request: (...args: unknown[]) => requestMock(...args),
}));

describe('AdminSyncPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestMock.mockResolvedValue({
      date: '2026-03-28',
      strategy: 'BALANCED',
      intervalMinutes: 15,
      requestsUsed: 12,
      requestsBudget: 88,
      requestsLimit: 100,
      nextSyncAt: '2026-03-28T14:00:00.000Z',
      totalSlotsPlanned: 2,
      totalPlannedRequests: 2,
      requestLog: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        requests: 0,
        slots: [],
      })),
      matches: [
        {
          matchId: 'match-1',
          trackingScope: 'TODAY',
          homeTeam: 'Argentina',
          awayTeam: 'Brasil',
          homeFlag: null,
          awayFlag: null,
          matchDate: '2026-03-28T16:00:00.000Z',
          status: 'SCHEDULED',
          externalId: '123',
          syncSlots: ['2026-03-28T15:55:00.000Z'],
          notificationSchedule: [],
          plannedRequests: [
            {
              id: 'status-1',
              type: 'STATUS_BATCH',
              label: 'Estados del dia',
              scheduledAt: '2026-03-28T15:55:00.000Z',
              requestCost: 1,
              matchIds: ['match-1'],
              executionState: 'enabled',
            },
            {
              id: 'events-1',
              type: 'EVENTS_FINAL',
              label: 'Eventos final',
              scheduledAt: '2026-03-28T18:10:00.000Z',
              requestCost: 1,
              matchIds: ['match-1'],
              optional: true,
              executionState: 'disabled_by_config',
              disabledReason: 'event_sync_disabled',
              notes: 'Consulta final de eventos',
            },
          ],
          lastSyncAt: null,
          lastSyncStatus: null,
          requestsAssigned: 2,
        },
      ],
    });
  });

  it('shows optional event requests and marks them disabled by configuration', async () => {
    const user = userEvent.setup();
    render(<AdminSyncPlan />);

    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith('/admin/football/plan/timeline');
    });

    await user.click(screen.getByRole('button', { name: /Argentina.*Brasil/i }));

    expect(screen.getByText(/^1 req activo$/i)).toBeInTheDocument();
    expect(screen.getByText(/^2 planeados$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Opcional$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Desactivado por configur/i)).toBeInTheDocument();
    expect(screen.getByTitle('Consulta final de eventos')).toBeInTheDocument();
  });
});

