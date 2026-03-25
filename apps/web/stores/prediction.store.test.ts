import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { usePredictionStore } from './prediction.store';

vi.mock('../api', async () => {
    const actual = await vi.importActual<typeof import('../api')>('../api');
    return {
        ...actual,
        request: vi.fn(),
    };
});

const requestMock = vi.mocked(request);

describe('usePredictionStore', () => {
    beforeEach(() => {
        requestMock.mockReset();
        usePredictionStore.setState({
            matches: [],
            leaderboard: [],
            isLoading: false,
        });
    });

    it('merges matches and predictions from the real backend endpoints', async () => {
        requestMock
            .mockResolvedValueOnce([
                {
                    id: 'match-1',
                    matchDate: '2026-06-11T18:00:00.000Z',
                    status: 'SCHEDULED',
                    phase: 'GROUP',
                    homeTeam: { name: 'Colombia', code: 'CO', shortCode: 'COL' },
                    awayTeam: { name: 'Argentina', code: 'AR', shortCode: 'ARG' },
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: 'prediction-1',
                    matchId: 'match-1',
                    homeScore: 2,
                    awayScore: 1,
                    points: 5,
                },
            ]);

        await usePredictionStore.getState().fetchLeagueMatches('league-1');

        expect(requestMock).toHaveBeenNthCalledWith(1, '/matches?leagueId=league-1');
        expect(requestMock).toHaveBeenNthCalledWith(2, '/predictions/league/league-1');
        expect(usePredictionStore.getState().matches).toEqual([
            expect.objectContaining({
                id: 'match-1',
                homeTeamCode: 'COL',
                awayTeamCode: 'ARG',
                prediction: { home: '2', away: '1' },
                pointsEarned: 5,
                saved: true,
            }),
        ]);
    });

    it('loads and ranks leaderboard rows for the selected league', async () => {
        requestMock.mockResolvedValueOnce([
            { id: 'user-2', username: 'maria', name: 'María', points: 8 },
            { id: 'user-1', username: 'juan', name: 'Juan', points: 13 },
        ]);

        await usePredictionStore.getState().fetchLeaderboard('league-1');

        expect(requestMock).toHaveBeenCalledWith('/predictions/leaderboard/league-1');
        expect(usePredictionStore.getState().leaderboard[0]).toMatchObject({
            id: 'user-1',
            rank: 1,
            points: 13,
        });
    });

    it('requests leaderboard filtered by category when provided', async () => {
        requestMock.mockResolvedValueOnce([
            { id: 'user-1', username: 'ana', name: 'Ana', points: 4 },
        ]);

        await usePredictionStore.getState().fetchLeaderboard('league-1', 'MATCH');

        expect(requestMock).toHaveBeenCalledWith('/predictions/leaderboard/league-1?category=MATCH');
    });

    it('keeps loading state untouched during background match refreshes', async () => {
        requestMock
            .mockResolvedValueOnce([
                {
                    id: 'match-1',
                    matchDate: '2026-06-11T18:00:00.000Z',
                    status: 'SCHEDULED',
                    phase: 'GROUP',
                    homeTeam: { name: 'Colombia', code: 'CO', shortCode: 'COL' },
                    awayTeam: { name: 'Argentina', code: 'AR', shortCode: 'ARG' },
                },
            ])
            .mockResolvedValueOnce([]);

        usePredictionStore.setState({
            matches: [],
            leaderboard: [],
            isLoading: false,
        });

        await usePredictionStore.getState().fetchLeagueMatches('league-1', { background: true });

        expect(usePredictionStore.getState().isLoading).toBe(false);
    });

    it('persists predictions using the backend DTO and marks them as saved on success', async () => {
        usePredictionStore.setState({
            matches: [
                {
                    id: 'match-1',
                    homeTeam: 'Colombia',
                    awayTeam: 'Perú',
                    homeTeamCode: 'COL',
                    awayTeamCode: 'PER',
                    homeFlag: 'co.png',
                    awayFlag: 'pe.png',
                    date: '2026-06-11T18:00:00.000Z',
                    displayDate: '2026-06-11',
                    status: 'open',
                    phase: 'GROUP',
                    venue: 'Bogotá',
                    homeTeamId: 'team-co',
                    awayTeamId: 'team-pe',
                    isKnockout: false,
                    prediction: { home: '', away: '' },
                    saved: false,
                },
            ],
            leaderboard: [],
            isLoading: false,
        });
        requestMock.mockResolvedValueOnce({});

        await usePredictionStore.getState().savePrediction('league-1', 'match-1', 3, 1);

        expect(requestMock).toHaveBeenCalledWith('/predictions', {
            method: 'POST',
            body: JSON.stringify({
                leagueId: 'league-1',
                matchId: 'match-1',
                homeScore: 3,
                awayScore: 1,
            }),
        });
        expect(usePredictionStore.getState().matches[0]).toMatchObject({
            prediction: { home: '3', away: '1' },
            saved: true,
        });
    });

    it('does not fake a saved prediction when the backend rejects the save', async () => {
        usePredictionStore.setState({
            matches: [
                {
                    id: 'match-2',
                    homeTeam: 'México',
                    awayTeam: 'USA',
                    homeTeamCode: 'MEX',
                    awayTeamCode: 'USA',
                    homeFlag: 'mx.png',
                    awayFlag: 'us.png',
                    date: '2026-06-15T22:00:00.000Z',
                    displayDate: '2026-06-15',
                    status: 'open',
                    phase: 'GROUP',
                    venue: 'CDMX',
                    homeTeamId: 'team-mx',
                    awayTeamId: 'team-us',
                    isKnockout: false,
                    prediction: { home: '', away: '' },
                    saved: false,
                },
            ],
            leaderboard: [],
            isLoading: false,
        });
        requestMock.mockRejectedValueOnce(new Error('Tiempo expirado'));

        await expect(
            usePredictionStore.getState().savePrediction('league-1', 'match-2', 1, 0),
        ).rejects.toThrow('Tiempo expirado');

        expect(usePredictionStore.getState().matches[0]).toMatchObject({
            prediction: { home: '', away: '' },
            saved: false,
        });
    });
});
