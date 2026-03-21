import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import Predictions from './Predictions';

const fetchMyLeaguesMock = vi.fn();
const setActiveLeagueMock = vi.fn();
const fetchLeagueMatchesMock = vi.fn();
const savePredictionMock = vi.fn();
const resetLeagueDataMock = vi.fn();
const requestMock = vi.fn();

let leagueState: any;
let predictionState: any;

vi.mock('../stores/league.store', () => ({
    useLeagueStore: (selector: any) => (selector ? selector(leagueState) : leagueState),
}));

vi.mock('../stores/prediction.store', () => ({
    usePredictionStore: (selector: any) => (selector ? selector(predictionState) : predictionState),
}));

vi.mock('../stores/auth.store', () => ({
    useAuthStore: () => ({ user: { plan: 'FREE' } }),
}));

vi.mock('../api', () => ({
    request: (...args: any[]) => requestMock(...args),
}));

const configState = {
    getSiCredits: () => 3,
    creditsResetAt: null,
};

vi.mock('../stores/config.store', () => ({
    useConfigStore: (selector: any) => (selector ? selector(configState) : configState),
}));

describe('Predictions view', () => {
    const renderWithRouter = () =>
        render(
            <RouterProvider
                router={createMemoryRouter([{ path: '/', element: <Predictions /> }], {
                    initialEntries: ['/'],
                })}
            />,
        );

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        leagueState = {
            activeLeague: { id: 'league-1', name: 'Liga Uno' },
            myLeagues: [{ id: 'league-1', name: 'Liga Uno' }],
            fetchMyLeagues: fetchMyLeaguesMock,
            setActiveLeague: setActiveLeagueMock,
        };
        predictionState = {
            matches: [
                {
                    id: 'match-1',
                    homeTeam: 'Colombia',
                    awayTeam: 'México',
                    homeTeamCode: 'COL',
                    awayTeamCode: 'MEX',
                    homeFlag: 'co.png',
                    awayFlag: 'mx.png',
                    date: '2026-06-11T18:00:00.000Z',
                    displayDate: '2026-06-11',
                    status: 'open',
                    phase: 'GROUP',
                    group: 'A',
                    venue: 'Bogotá',
                    prediction: { home: '', away: '' },
                    saved: false,
                },
            ],
            isLoading: false,
            fetchLeagueMatches: fetchLeagueMatchesMock,
            savePrediction: savePredictionMock,
            resetLeagueData: resetLeagueDataMock,
        };
        fetchMyLeaguesMock.mockResolvedValue(undefined);
        fetchLeagueMatchesMock.mockResolvedValue(predictionState.matches);
        savePredictionMock.mockResolvedValue(undefined);
        requestMock.mockImplementation(async (url: string) => {
            if (url.startsWith('/participation/summary')) {
                return {
                    totalPending: 15000,
                    currency: 'COP',
                    itemCount: 1,
                    hasPrincipalPending: true,
                    items: [
                        {
                            id: 'obl-1',
                            category: 'PRINCIPAL',
                            categoryLabel: 'Polla principal',
                            referenceId: 'league-1',
                            referenceLabel: 'Liga Uno',
                            status: 'PENDING_PAYMENT',
                            unitAmount: 15000,
                            multiplier: 1,
                            subtotal: 15000,
                            currency: 'COP',
                            deadlineAt: '2026-06-11T17:45:00.000Z',
                        },
                    ],
                };
            }

            if (url.startsWith('/participation/options')) {
                return [
                    {
                        category: 'PRINCIPAL',
                        categoryLabel: 'Polla principal',
                        referenceId: 'league-1',
                        referenceLabel: 'Liga Uno',
                        unitAmount: 15000,
                        currency: 'COP',
                        deadlineAt: '2026-06-11T17:45:00.000Z',
                        enabled: true,
                        status: 'UNSELECTED',
                        multiplier: 1,
                    },
                    {
                        category: 'MATCH',
                        categoryLabel: 'Por partido',
                        referenceId: 'match-1',
                        referenceLabel: 'Colombia vs México',
                        unitAmount: 5000,
                        currency: 'COP',
                        deadlineAt: '2026-06-11T17:45:00.000Z',
                        enabled: true,
                        status: 'UNSELECTED',
                        multiplier: 1,
                    },
                    {
                        category: 'PHASE',
                        categoryLabel: 'Por fase',
                        referenceId: 'GROUP',
                        referenceLabel: 'Grupos',
                        unitAmount: 7000,
                        currency: 'COP',
                        deadlineAt: '2026-06-11T17:45:00.000Z',
                        enabled: true,
                        status: 'UNSELECTED',
                        multiplier: 1,
                    },
                ];
            }

            if (url === '/participation/selections') {
                return {
                    totalPending: 30000,
                    currency: 'COP',
                    itemCount: 1,
                    hasPrincipalPending: true,
                    items: [],
                };
            }

            if (url === '/participation/checkout/prepare') {
                return {
                    leagueId: 'league-1',
                    currency: 'COP',
                    totalAmount: 15000,
                    items: [
                        {
                            type: 'PARTICIPATION',
                            id: 'league-1',
                            quantity: 1,
                            price: 15000,
                            name: 'Polla principal · Liga Uno',
                            category: 'PRINCIPAL',
                            obligationId: 'obl-1',
                            leagueId: 'league-1',
                            referenceId: 'league-1',
                        },
                    ],
                };
            }

            if (url === '/payments/checkout-session') {
                return {
                    redirectUrl: 'https://checkout.stripe.test/session-1',
                };
            }

            if (url === '/ai-credits/summary') {
                return {
                    totalCredits: 3,
                    usedCredits: 0,
                    remainingCredits: 3,
                    plan: 'FREE',
                    lastResetAt: '2026-03-19T00:00:00.000Z',
                };
            }

            if (url === '/ai-credits/consume') {
                return {
                    success: true,
                    remainingCredits: 2,
                };
            }

            return {
                homeWin: 52,
                draw: 23,
                awayWin: 25,
                homeForm: ['W', 'W', 'D', 'L', 'W'],
                awayForm: ['L', 'D', 'L', 'W', 'L'],
                scores: ['2-0', '1-1', '2-1'],
                smartPick: 'Colombia',
                insight: 'Colombia se hace fuerte en casa y llega con mejor forma reciente.',
                personalInsight: 'La presión alta favorece al local en el primer tiempo.',
            };
        });
    });

    it('loads league matches for the active league and renders the current mode controls', async () => {
        renderWithRouter();

        await waitFor(() => expect(fetchLeagueMatchesMock).toHaveBeenCalledWith('league-1'));
        expect(screen.getByRole('button', { name: /Partidos/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Simulador/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Buscar equipo/i)).toBeInTheDocument();
    }, 15000);

    it('renders compact team codes and accessible compact actions for predictions', async () => {
        renderWithRouter();

        await waitFor(() => expect(fetchLeagueMatchesMock).toHaveBeenCalled());
        expect(screen.getAllByText('COL').length).toBeGreaterThan(0);
        expect(screen.getAllByText('MEX').length).toBeGreaterThan(0);
        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: /Ver participaciones de Colombia vs México/i }),
            ).toBeInTheDocument(),
        );
        expect(screen.getByRole('button', { name: /Ver Smart Insights para Colombia vs/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Guardar pronóstico de Colombia vs/i })).toBeInTheDocument();
    });

    it('opens the participation selector from the match card and shows configured categories', async () => {
        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => expect(fetchLeagueMatchesMock).toHaveBeenCalled());
        const participationButton = await screen.findByRole('button', {
            name: /Ver participaciones de Colombia vs México/i,
        });
        await user.click(participationButton);

        await waitFor(() => expect(requestMock).toHaveBeenCalledWith('/participation/options?leagueId=league-1&matchId=match-1'));
        expect(screen.getAllByText(/Participaciones/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Liga Uno/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Colombia vs México/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Grupos/i).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Por ronda/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Por grupo/i)).not.toBeInTheDocument();
        expect(screen.getAllByText(/Cierra/i).length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /Agregar Colombia vs México/i })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'x2' }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button', { name: 'x1' }).every((button) => button.getAttribute('aria-pressed') === 'true')).toBe(true);
        expect(screen.getByRole('button', { name: /Guardar participación/i })).toBeInTheDocument();
    });

    it('lets the user opt into optional participation categories before saving', async () => {
        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => expect(fetchLeagueMatchesMock).toHaveBeenCalled());
        await user.click(
            await screen.findByRole('button', { name: /Ver participaciones de Colombia vs México/i }),
        );

        await user.click(screen.getByRole('button', { name: /Agregar Colombia vs México/i }));

        expect(screen.getByRole('button', { name: /Quitar Colombia vs México/i })).toBeInTheDocument();
        expect(screen.getByText(/20.000/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Guardar participación/i }));

        const selectionCall = requestMock.mock.calls.find(
            ([url]) => url === '/participation/selections',
        );
        const body = JSON.parse(selectionCall?.[1]?.body ?? '{}');

        expect(body.selections).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ category: 'PRINCIPAL' }),
                expect.objectContaining({ category: 'MATCH', referenceId: 'match-1' }),
            ]),
        );
        expect(body.selections).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ category: 'PHASE' })]),
        );
    });

    it('hides the participation entry point when no payable categories apply', async () => {
        requestMock.mockImplementation(async (url: string) => {
            if (url.startsWith('/participation/summary')) {
                return {
                    totalPending: 0,
                    currency: 'COP',
                    itemCount: 0,
                    hasPrincipalPending: false,
                    items: [],
                };
            }

            if (url.startsWith('/participation/options')) {
                return [];
            }

            if (url === '/ai-credits/summary') {
                return {
                    totalCredits: 3,
                    usedCredits: 0,
                    remainingCredits: 3,
                    plan: 'FREE',
                    lastResetAt: '2026-03-19T00:00:00.000Z',
                };
            }

            if (url === '/ai-credits/consume') {
                return { success: true, remainingCredits: 2 };
            }

            return {
                homeWin: 52,
                draw: 23,
                awayWin: 25,
                homeForm: ['W', 'W', 'D', 'L', 'W'],
                awayForm: ['L', 'D', 'L', 'W', 'L'],
                scores: ['2-0', '1-1', '2-1'],
                smartPick: 'Colombia',
                insight: 'Colombia se hace fuerte en casa y llega con mejor forma reciente.',
                personalInsight: 'La presión alta favorece al local en el primer tiempo.',
            };
        });

        renderWithRouter();

        await waitFor(() => expect(fetchLeagueMatchesMock).toHaveBeenCalled());
        await waitFor(() =>
            expect(
                screen.queryByRole('button', { name: /Ver participaciones de Colombia vs México/i }),
            ).not.toBeInTheDocument(),
        );
    });

    it('starts checkout for pending participations from the summary banner', async () => {
        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => expect(fetchLeagueMatchesMock).toHaveBeenCalled());
        const payNowButton = await screen.findByRole('button', { name: /Pagar ahora/i });
        await user.click(payNowButton);

        await waitFor(() =>
            expect(requestMock).toHaveBeenCalledWith(
                '/participation/checkout/prepare',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"obligationIds":["obl-1"]'),
                }),
            ),
        );

        expect(requestMock).toHaveBeenCalledWith(
            '/payments/checkout-session',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"type":"PARTICIPATION"'),
            }),
        );
    });

    it('allows editing scores through labeled numeric inputs before saving', async () => {
        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => expect(fetchLeagueMatchesMock).toHaveBeenCalled());

        const homeScore = screen.getByRole('spinbutton', { name: /Marcador local para Colombia/i });
        const awayScore = screen.getByRole('spinbutton', { name: /Marcador visitante para México/i });

        await user.clear(homeScore);
        await user.type(homeScore, '2');
        await user.clear(awayScore);
        await user.type(awayScore, '1');
        await user.click(screen.getByRole('button', { name: /Guardar pronóstico de Colombia vs/i }));

        expect(savePredictionMock).toHaveBeenCalledWith('league-1', 'match-1', 2, 1);
    });

    it('shows compact smart insights summary first and expands details on demand', async () => {
        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => expect(fetchLeagueMatchesMock).toHaveBeenCalled());
        await user.click(screen.getByRole('button', { name: /Ver Smart Insights para Colombia vs/i }));

        await waitFor(() => expect(requestMock).toHaveBeenCalled());
        expect(screen.getByText(/Favorito Colombia/i)).toBeInTheDocument();
        expect(screen.getByText(/Ver detalle/i)).toBeInTheDocument();
        expect(screen.getByText(/La presión alta favorece al local/i)).toBeInTheDocument();
        expect(screen.queryByText(/Sugerencias automáticas/i)).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Ver detalle de Smart Insights para Colombia vs México/i }));
        expect(screen.getByText(/Sugerencias automáticas/i)).toBeInTheDocument();
    });

    it('registers and consumes an AI credit when fetching match insights', async () => {
        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => expect(fetchLeagueMatchesMock).toHaveBeenCalled());
        await user.click(screen.getByRole('button', { name: /Ver Smart Insights para Colombia vs/i }));

        await waitFor(() =>
            expect(requestMock).toHaveBeenCalledWith(
                '/ai-credits/consume',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"feature":"match_insights"'),
                }),
            ),
        );
    });
});
