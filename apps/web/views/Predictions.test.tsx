import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Predictions from './Predictions';

const fetchMyLeaguesMock = vi.fn();
const setActiveLeagueMock = vi.fn();
const fetchLeagueMatchesMock = vi.fn();
const savePredictionMock = vi.fn();
const resetLeagueDataMock = vi.fn();

let leagueState: any;
let predictionState: any;

vi.mock('../stores/league.store', () => ({
    useLeagueStore: (selector: any) => (selector ? selector(leagueState) : leagueState),
}));

vi.mock('../stores/prediction.store', () => ({
    usePredictionStore: (selector: any) => (selector ? selector(predictionState) : predictionState),
}));

describe('Predictions view', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leagueState = {
            activeLeague: { id: 'league-1' },
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
                    homeFlag: 'co.png',
                    awayFlag: 'mx.png',
                    date: '2026-06-11T18:00:00.000Z',
                    displayDate: '2026-06-11',
                    status: 'open',
                    phase: 'GROUP',
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
    });

    it('loads real matches for the active league and shows disabled placeholder sections for deferred features', async () => {
        render(<Predictions />);

        await waitFor(() => expect(fetchLeagueMatchesMock).toHaveBeenCalledWith('league-1'));
        expect(screen.getByRole('heading', { name: /Simulador/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Ligas públicas/i })).toBeInTheDocument();
    });

    it('saves predictions using the implemented store action', async () => {
        const user = userEvent.setup();
        render(<Predictions />);

        await user.type(screen.getByLabelText(/Marcador Colombia/i), '2');
        await user.type(screen.getByLabelText(/Marcador México/i), '1');
        await user.click(screen.getByRole('button', { name: /Guardar/i }));

        await waitFor(() =>
            expect(savePredictionMock).toHaveBeenCalledWith('league-1', 'match-1', 2, 1),
        );
    });
});
