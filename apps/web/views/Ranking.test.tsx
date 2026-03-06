import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Ranking from './Ranking';

const fetchMyLeaguesMock = vi.fn();
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

describe('Ranking view', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leagueState = {
            activeLeague: { id: 'league-1' },
            myLeagues: [
                { id: 'league-1', name: 'Liga Uno' },
                { id: 'league-2', name: 'Liga Dos' },
            ],
            fetchMyLeagues: fetchMyLeaguesMock,
            setActiveLeague: setActiveLeagueMock,
        };
        predictionState = {
            leaderboard: [
                { id: 'user-1', rank: 1, name: 'Juan Pérez', username: 'juan', avatar: '', points: 15, trend: 'same' },
                { id: 'user-2', rank: 2, name: 'María López', username: 'maria', avatar: '', points: 10, trend: 'same' },
            ],
            isLoading: false,
            fetchLeaderboard: fetchLeaderboardMock,
        };
        fetchLeaderboardMock.mockResolvedValue(undefined);
        fetchMyLeaguesMock.mockResolvedValue(undefined);
    });

    it('loads leaderboard data for the active league and renders the ranked players', async () => {
        render(<Ranking />);

        await waitFor(() => expect(fetchLeaderboardMock).toHaveBeenCalledWith('league-1'));
        expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        expect(screen.getByText('@maria')).toBeInTheDocument();
    });

    it('switches the active league through the implemented store action', async () => {
        const user = userEvent.setup();
        render(<Ranking />);

        await user.selectOptions(screen.getByLabelText(/Liga activa/i), 'league-2');

        expect(setActiveLeagueMock).toHaveBeenCalledWith('league-2');
    });
});
