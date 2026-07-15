import {
    countPhaseBonusCorrect,
    isKnockoutPhaseComplete,
    isPhaseBonusAdvanceCorrect,
    resolveEffectiveAdvanceTeamId,
    selectCountableKnockoutMatches,
} from '@polla-2026/shared';

describe('phase-bonus-count', () => {
    const match = {
        id: 'm1',
        status: 'FINISHED',
        homeTeamId: 'esp',
        awayTeamId: 'bel',
        advancingTeamId: 'esp',
        homeScore: 2,
        awayScore: 1,
        penaltyHomeScore: null,
        penaltyAwayScore: null,
    };

    it('infiere clasificado desde marcador decisivo (ignora advanceTeamId obsoleto)', () => {
        const advance = resolveEffectiveAdvanceTeamId(
            { matchId: 'm1', homeScore: 1, awayScore: 2, advanceTeamId: 'esp' },
            match,
        );
        expect(advance).toBe('bel');
    });

    it('cuenta acierto cuando el marcador predicho acierta al clasificado', () => {
        const correct = countPhaseBonusCorrect(
            [match],
            [{ matchId: 'm1', homeScore: 2, awayScore: 0, advanceTeamId: null }],
        );
        expect(correct).toBe(1);
    });

    it('no cuenta si el ganador del marcador no coincide', () => {
        const correct = countPhaseBonusCorrect(
            [match],
            [{ matchId: 'm1', homeScore: 0, awayScore: 2, advanceTeamId: null }],
        );
        expect(correct).toBe(0);
    });

    it('no cuenta empate predicho si el partido se resolvió en el marcador (2-1)', () => {
        const correct = isPhaseBonusAdvanceCorrect(
            { matchId: 'm1', homeScore: 1, awayScore: 1, advanceTeamId: 'esp' },
            match,
        );
        expect(correct).toBe(false);
        expect(
            countPhaseBonusCorrect(
                [match],
                [{ matchId: 'm1', homeScore: 1, awayScore: 1, advanceTeamId: 'esp' }],
            ),
        ).toBe(0);
    });

    it('sí cuenta empate predicho cuando el partido real se definió en penales', () => {
        const pensMatch = {
            ...match,
            homeScore: 1,
            awayScore: 1,
            penaltyHomeScore: 4,
            penaltyAwayScore: 3,
        };
        expect(
            isPhaseBonusAdvanceCorrect(
                { matchId: 'm1', homeScore: 1, awayScore: 1, advanceTeamId: 'esp' },
                pensMatch,
            ),
        ).toBe(true);
        expect(
            countPhaseBonusCorrect(
                [pensMatch],
                [{ matchId: 'm1', homeScore: 1, awayScore: 1, advanceTeamId: 'esp' }],
            ),
        ).toBe(1);
    });

    it('no trata como penales un 2-1 aunque existan penaltyHome/Away residuales', () => {
        const dirty = {
            ...match,
            homeScore: 2,
            awayScore: 1,
            penaltyHomeScore: 0,
            penaltyAwayScore: 0,
        };
        expect(
            isPhaseBonusAdvanceCorrect(
                { matchId: 'm1', homeScore: 1, awayScore: 1, advanceTeamId: 'esp' },
                dirty,
            ),
        ).toBe(false);
    });

    it('recorta partidos fantasma al cupo esperado de la fase', () => {
        const matches = [
            ...Array.from({ length: 4 }, (_, i) => ({
                id: `q${i}`,
                status: 'FINISHED' as const,
                homeTeamId: 'h',
                awayTeamId: 'a',
                advancingTeamId: 'h',
                homeScore: 1,
                awayScore: 0,
                penaltyHomeScore: null,
                penaltyAwayScore: null,
                matchDate: new Date(`2026-07-0${i + 1}`),
            })),
            {
                id: 'phantom',
                status: 'SCHEDULED' as const,
                homeTeamId: 'h',
                awayTeamId: 'a',
                advancingTeamId: null,
                homeScore: null,
                awayScore: null,
                penaltyHomeScore: null,
                penaltyAwayScore: null,
                matchDate: new Date('2026-07-20'),
            },
        ];

        const countable = selectCountableKnockoutMatches(matches, 'QUARTER');
        expect(countable).toHaveLength(4);
        expect(countable.map((row) => row.id)).not.toContain('phantom');
        expect(isKnockoutPhaseComplete(matches, 'QUARTER')).toBe(true);
    });
});
