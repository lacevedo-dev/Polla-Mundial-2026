import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMyLeaguesMock = vi.fn();
const fetchLeagueDetailsMock = vi.fn();
const setActiveLeagueMock = vi.fn();
const fetchLeaderboardMock = vi.fn();

let leagueState: any;
let predictionState: any;

vi.mock('../stores/league.store', () => ({
    useLeagueStore: (selector: any) => (selector ? selector(leagueState) : leagueState),
}));

vi.mock('../stores/prediction.store', () => ({
    usePredictionStore: (selector: any) => (selector ? selector(predictionState) : predictionState),
}));

vi.mock('../stores/auth.store', () => ({
    useAuthStore: (selector: any) =>
        selector
            ? selector({
                  user: { id: 'user-1', username: 'juan' },
              })
            : {
                  user: { id: 'user-1', username: 'juan' },
              },
}));

import Ranking from './Ranking';

afterEach(() => {
    cleanup();
});

describe('Ranking view', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leagueState = {
            activeLeague: {
                id: 'league-1',
                settings: { includeBaseFee: true },
                stageFees: [
                    { type: 'MATCH', label: 'Partido', amount: 5000, active: true },
                    { type: 'ROUND', label: 'Ronda', amount: 10000, active: true },
                ],
            },
            myLeagues: [
                { id: 'league-1', name: 'Liga Uno' },
                { id: 'league-2', name: 'Liga Dos' },
            ],
            fetchMyLeagues: fetchMyLeaguesMock,
            fetchLeagueDetails: fetchLeagueDetailsMock,
            setActiveLeague: setActiveLeagueMock,
        };
        predictionState = {
            leaderboard: [
                { id: 'user-1', rank: 1, name: 'Juan P?rez', username: 'juan', avatar: '', points: 15, trend: 'same' },
                { id: 'user-2', rank: 2, name: 'Mar?a L?pez', username: 'maria', avatar: '', points: 10, trend: 'same' },
            ],
            isLoading: false,
            fetchLeaderboard: fetchLeaderboardMock,
        };
        fetchLeaderboardMock.mockResolvedValue(undefined);
        fetchLeagueDetailsMock.mockResolvedValue(undefined);
        fetchMyLeaguesMock.mockResolvedValue(undefined);
    });

    it('loads leaderboard data for the active league and renders ranked content', async () => {
        render(<Ranking />);

        await waitFor(() => expect(fetchLeaderboardMock).toHaveBeenCalledWith('league-1', 'GENERAL'));
        expect(screen.getByText('@maria')).toBeTruthy();
        expect(screen.getByRole('button', { name: /General/i })).toBeTruthy();
    }, 20000);

    it('switches the active league through the implemented store action', async () => {
        const user = userEvent.setup();
        render(<Ranking />);

        await user.selectOptions(screen.getAllByLabelText(/Liga activa/i)[0], 'league-2');

        expect(setActiveLeagueMock).toHaveBeenCalledWith('league-2');
    });

    it('shows only the league title in the selector and lets the user switch ranking scope', async () => {
        const user = userEvent.setup();
        render(<Ranking />);

        expect(screen.getAllByRole('option', { name: 'Liga Uno' }).length).toBeGreaterThan(0);
        expect(screen.queryByRole('option', { name: /C?digo/i })).toBeNull();

        await user.click(screen.getByRole('button', { name: /Por partido/i }));

        await waitFor(() => expect(fetchLeaderboardMock).toHaveBeenLastCalledWith('league-1', 'MATCH'));
    });
});
