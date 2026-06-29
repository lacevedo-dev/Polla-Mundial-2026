import {
    countPhaseBonusCorrect,
    resolveEffectiveAdvanceTeamId,
} from '@polla-2026/shared';

describe('phase-bonus-count', () => {
    const match = {
        id: 'm1',
        status: 'FINISHED',
        homeTeamId: 'rsa',
        awayTeamId: 'can',
        advancingTeamId: 'can',
    };

    it('infiere clasificado desde marcador cuando advanceTeamId es null', () => {
        const advance = resolveEffectiveAdvanceTeamId(
            { matchId: 'm1', homeScore: 1, awayScore: 2, advanceTeamId: null },
            match,
        );
        expect(advance).toBe('can');
    });

    it('cuenta acierto de dieciseisavos con ganador inferido (1-2 vs 0-1)', () => {
        const correct = countPhaseBonusCorrect(
            [match],
            [{ matchId: 'm1', homeScore: 1, awayScore: 2, advanceTeamId: null }],
        );
        expect(correct).toBe(1);
    });

    it('no cuenta si el ganador inferido no coincide', () => {
        const correct = countPhaseBonusCorrect(
            [match],
            [{ matchId: 'm1', homeScore: 2, awayScore: 0, advanceTeamId: null }],
        );
        expect(correct).toBe(0);
    });
});
