import { describe, expect, it } from 'vitest';
import { mergeLeaguePredictions, toLeaderboardRows, toMatchViewModel } from './prediction.adapters';

describe('prediction.adapters', () => {
    it('normalizes backend match fields for the UI, including compact codes and flag fallback by country code', () => {
        const viewModel = toMatchViewModel({
            id: 'match-1',
            matchDate: '2026-06-11T14:00:00.000Z',
            status: 'SCHEDULED',
            phase: 'GROUP',
            group: 'A',
            venue: 'Estadio Azteca',
            homeTeam: { name: 'Colombia', code: 'CO', shortCode: 'COL' },
            awayTeam: { name: 'México', code: 'MX', shortCode: 'MEX' },
        });

        expect(viewModel).toMatchObject({
            id: 'match-1',
            date: '2026-06-11T14:00:00.000Z',
            displayDate: '2026-06-11',
            status: 'open',
            venue: 'Estadio Azteca',
            homeTeamCode: 'COL',
            awayTeamCode: 'MEX',
            prediction: { home: '', away: '' },
            saved: false,
        });
        expect(viewModel.homeFlag).toContain('/co.png');
        expect(viewModel.awayFlag).toContain('/mx.png');
    });

    it('keeps matches without predictions in a clean unsaved state', () => {
        const [viewModel] = mergeLeaguePredictions(
            [
                {
                    id: 'match-2',
                    matchDate: '2026-06-12T18:00:00.000Z',
                    status: 'SCHEDULED',
                    phase: 'GROUP',
                    homeTeam: { name: 'USA', shortCode: 'USA', flagUrl: 'https://example.com/us.png' },
                    awayTeam: { name: 'Canadá', shortCode: 'CAN', flagUrl: 'https://example.com/ca.png' },
                },
            ],
            [],
        );

        expect(viewModel.saved).toBe(false);
        expect(viewModel.prediction).toEqual({ home: '', away: '' });
        expect(viewModel.pointsEarned).toBeUndefined();
        expect(viewModel.homeTeamCode).toBe('USA');
        expect(viewModel.awayTeamCode).toBe('CAN');
    });

    it('merges predictions by matchId and preserves earned points', () => {
        const [viewModel] = mergeLeaguePredictions(
            [
                {
                    id: 'match-3',
                    matchDate: '2026-06-15T20:00:00.000Z',
                    status: 'FINISHED',
                    phase: 'ROUND_OF_16',
                    homeScore: 2,
                    awayScore: 1,
                    homeTeam: { name: 'Brasil', shortCode: 'BRA', flagUrl: 'https://example.com/br.png' },
                    awayTeam: { name: 'Japón', shortCode: 'JPN', flagUrl: 'https://example.com/jp.png' },
                },
            ],
            [
                {
                    id: 'prediction-1',
                    matchId: 'match-3',
                    homeScore: 2,
                    awayScore: 0,
                    points: 3,
                },
            ],
        );

        expect(viewModel.saved).toBe(true);
        expect(viewModel.prediction).toEqual({ home: '2', away: '0' });
        expect(viewModel.result).toEqual({ home: 2, away: 1 });
        expect(viewModel.pointsEarned).toBe(3);
        expect(viewModel.status).toBe('finished');
        expect(viewModel.homeTeamCode).toBe('BRA');
        expect(viewModel.awayTeamCode).toBe('JPN');
    });

    it('falls back to backend code when shortCode is not available', () => {
        const viewModel = toMatchViewModel({
            id: 'match-4',
            matchDate: '2026-06-16T12:00:00.000Z',
            status: 'SCHEDULED',
            phase: 'GROUP',
            homeTeam: { name: 'England', code: 'ENG' },
            awayTeam: { name: 'France', code: 'FRA' },
        });

        expect(viewModel.homeTeamCode).toBe('ENG');
        expect(viewModel.awayTeamCode).toBe('FRA');
    });

    it('maps and ranks leaderboard rows from the backend response', () => {
        const rows = toLeaderboardRows([
            { id: 'user-2', username: 'maria', name: 'María', points: 8 },
            { id: 'user-1', username: 'juan', name: 'Juan', points: 15, avatar: '/uploads/avatars/juan.png' },
        ]);

        expect(rows).toEqual([
            {
                id: 'user-1',
                rank: 1,
                username: 'juan',
                name: 'Juan',
                avatar: 'http://localhost:3004/uploads/avatars/juan.png',
                points: 15,
                trend: 'same',
            },
            {
                id: 'user-2',
                rank: 2,
                username: 'maria',
                name: 'María',
                avatar: expect.stringContaining('ui-avatars.com'),
                points: 8,
                trend: 'same',
            },
        ]);
    });
});
