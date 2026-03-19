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
        fetchLeagueMatchesMock.mockResolvedValue(undefined);
        savePredictionMock.mockResolvedValue(undefined);
        requestMock.mockResolvedValue({
            homeWin: 52,
            draw: 23,
            awayWin: 25,
            homeForm: ['W', 'W', 'D', 'L', 'W'],
            awayForm: ['L', 'D', 'L', 'W', 'L'],
            scores: ['2-0', '1-1', '2-1'],
            smartPick: 'Colombia',
            insight: 'Colombia se hace fuerte en casa y llega con mejor forma reciente.',
            personalInsight: 'La presión alta favorece al local en el primer tiempo.',
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
        expect(screen.getByRole('button', { name: /Ver Smart Insights para Colombia vs/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Guardar pronóstico de Colombia vs/i })).toBeInTheDocument();
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
});
