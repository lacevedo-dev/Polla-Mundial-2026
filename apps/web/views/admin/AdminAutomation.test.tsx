import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminAutomation from './AdminAutomation';

const requestMock = vi.fn();

vi.mock('../../api', () => ({
  request: (...args: any[]) => requestMock(...args),
}));

const mockStepCatalog = [
  { key: 'MATCH_REMINDER', phase: 'PRE_MATCH', label: 'Recordatorio T-60', shortLabel: 'T-60', description: '', schedulerId: 'match_reminder', channels: ['push', 'inApp'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'PREDICTION_CLOSING', phase: 'PRE_MATCH', label: 'Cierre predicciones', shortLabel: 'Cierre', description: '', schedulerId: 'prediction_closing', channels: ['push'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'RESULT_NOTIFICATION', phase: 'POST_MATCH', label: 'Resultado personal', shortLabel: 'Result.', description: '', schedulerId: 'match_result', channels: ['push'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'PREDICTION_REPORT', phase: 'POST_MATCH', label: 'Reporte predicciones', shortLabel: 'P.Rep', description: '', schedulerId: 'prediction_report', channels: ['email'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'RESULT_REPORT', phase: 'POST_MATCH', label: 'Reporte resultados', shortLabel: 'Rep.F', description: '', schedulerId: 'result_report', channels: ['email'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
];

describe('AdminAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestMock.mockImplementation((path: string) => {
      if (path === '/admin/automation/status') {
        return Promise.resolve({
          channels: {
            inApp: { enabled: true, description: 'Siempre activo' },
            push: { enabled: true, description: '12 suscripciones', subscriberCount: 12 },
            whatsapp: { enabled: false, description: 'Sin Twilio', usersWithPhone: 4 },
            sms: { enabled: false, description: 'Sin SMS' },
            email: { enabled: true, description: 'SMTP activo' },
          },
          schedulers: [],
          channelOverrides: {},
          stats: { notifLast24h: 10, pushSubscribers: 12, usersWithPhone: 4 },
          featureFlags: {
            preMatchV2: { enabled: false, source: 'default', locked: false },
            livePhaseV2: { enabled: false, source: 'default', locked: false },
            postMatchV2: { enabled: false, source: 'default', locked: false },
          },
          stepCatalog: mockStepCatalog,
          timingHints: {
            defaultCloseMinutes: 15,
            finalEscalationMinutesBeforeKickoff: 20,
            predictionReportMinutesAfterClose: 1,
            predictionReportMinutesBefore: 14,
            timezone: 'America/Bogota',
          },
          liveDisplay: {
            goals: true,
            yellowCards: true,
            redCards: true,
            substitutions: true,
          },
          goalSticker: {
            enabled: false,
            dashboard: false,
            whatsappGroup: false,
          },
        });
      }

      if (path === '/admin/automation/operations') {
        return Promise.resolve({
          date: '2026-03-29',
          generatedAt: '2026-03-29T12:00:00.000Z',
          matches: [
            {
              id: 'match-1',
              trackingScope: 'TODAY',
              displayName: 'Colombia vs Argentina',
              homeTeam: 'Colombia',
              awayTeam: 'Argentina',
              matchDate: '2026-03-29T20:00:00.000Z',
              status: 'SCHEDULED',
              tournament: 'Friendlies',
              overallStatus: 'FAILED',
              sync: {
                status: 'SUCCESS',
                lastStartedAt: '2026-03-29T18:00:00.000Z',
                lastFinishedAt: '2026-03-29T18:00:12.000Z',
                durationMs: 12000,
                summary: 'Sync OK',
                errorMessage: null,
                recentLogs: [
                  {
                    id: 'sync-1',
                    type: 'MATCH_SYNC',
                    status: 'SUCCESS',
                    message: 'Sync OK',
                    error: null,
                    details: null,
                    startedAt: '2026-03-29T18:00:00.000Z',
                    finishedAt: '2026-03-29T18:00:12.000Z',
                    durationMs: 12000,
                    requestsUsed: 2,
                  },
                ],
              },
              steps: [
                {
                  key: 'MATCH_REMINDER',
                  label: 'Recordatorio 60 min',
                  status: 'FAILED',
                  scheduledAt: '2026-03-29T19:00:00.000Z',
                  lastStartedAt: '2026-03-29T19:00:30.000Z',
                  lastFinishedAt: '2026-03-29T19:00:35.000Z',
                  summary: 'Falló el recordatorio',
                  errorMessage: 'VAPID rechazó la suscripción',
                  trigger: 'SCHEDULER',
                  latestDetails: null,
                  relevantLeagueCount: 1,
                  recentRuns: [],
                  leagues: [
                    {
                      runId: 'run-1',
                      leagueId: 'league-1',
                      leagueCode: 'PRUEBA-L1',
                      leagueName: 'Liga Test Mundial 2026 GOLD',
                      status: 'FAILED',
                      scheduledAt: '2026-03-29T19:00:00.000Z',
                      startedAt: '2026-03-29T19:00:30.000Z',
                      finishedAt: '2026-03-29T19:00:35.000Z',
                      summary: 'Push falló',
                      errorMessage: 'VAPID rechazó la suscripción',
                      trigger: 'SCHEDULER',
                      audienceCount: 21,
                      deliveredCount: 0,
                      failedCount: 3,
                      warningCount: 0,
                      details: {
                        channelBreakdown: {
                          pushSent: 0,
                          pushFailed: 3,
                          pushDevices: 3,
                          whatsappSentCount: 0,
                          emailQueued: 0,
                        },
                      },
                    },
                  ],
                },
                {
                  key: 'PREDICTION_CLOSING',
                  label: 'Cierre de predicciones',
                  status: 'SCHEDULED',
                  scheduledAt: '2026-03-29T19:45:00.000Z',
                  lastStartedAt: null,
                  lastFinishedAt: null,
                  summary: 'Programado',
                  errorMessage: null,
                  trigger: 'SCHEDULER',
                  latestDetails: null,
                  relevantLeagueCount: 1,
                  recentRuns: [],
                  leagues: [],
                },
                {
                  key: 'RESULT_NOTIFICATION',
                  label: 'Notificación de resultado',
                  status: 'NOT_APPLICABLE',
                  scheduledAt: '2026-03-29T22:10:00.000Z',
                  lastStartedAt: null,
                  lastFinishedAt: null,
                  summary: 'No aplica todavía para el estado actual del partido.',
                  errorMessage: null,
                  trigger: 'SCHEDULER',
                  latestDetails: null,
                  relevantLeagueCount: 0,
                  recentRuns: [],
                  leagues: [],
                },
                {
                  key: 'PREDICTION_REPORT',
                  label: 'Reporte de predicciones',
                  status: 'SCHEDULED',
                  scheduledAt: '2026-03-29T19:45:00.000Z',
                  lastStartedAt: null,
                  lastFinishedAt: null,
                  summary: 'Programado',
                  errorMessage: null,
                  trigger: 'SCHEDULER',
                  latestDetails: null,
                  relevantLeagueCount: 1,
                  recentRuns: [],
                  leagues: [],
                },
                {
                  key: 'RESULT_REPORT',
                  label: 'Reporte de resultados',
                  status: 'NOT_APPLICABLE',
                  scheduledAt: '2026-03-29T22:10:00.000Z',
                  lastStartedAt: null,
                  lastFinishedAt: null,
                  summary: 'No aplica todavía para el estado actual del partido.',
                  errorMessage: null,
                  trigger: 'SCHEDULER',
                  latestDetails: null,
                  relevantLeagueCount: 1,
                  recentRuns: [],
                  leagues: [],
                },
              ],
            },
          ],
        });
      }

      if (path.startsWith('/admin/automation/history')) {
        return Promise.resolve({
          countByType: {},
          recent: [],
          total: 0,
          page: 1,
          limit: 20,
        });
      }

      if (path === '/admin/automation/test-push') {
        return Promise.resolve({ ok: true, message: 'Push enviado' });
      }

      throw new Error(`Unhandled request: ${path}`);
    });
  });

  it('renders the new observability columns and expands failed league details', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminAutomation />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith('/admin/automation/operations');
    });

    expect(screen.getByText(/Sync/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Post-partido/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Feature flags v2/i)).toBeInTheDocument();
    expect(screen.getByText(/Colombia vs Argentina/i)).toBeInTheDocument();

    await user.click(screen.getByText(/Colombia vs Argentina/i));

    expect(await screen.findByText(/Liga Test Mundial 2026 GOLD/i)).toBeInTheDocument();
    expect(screen.getByText(/VAPID rechazó la suscripción/i)).toBeInTheDocument();
    expect(screen.getByText(/Sync partido/i)).toBeInTheDocument();
  });
});
