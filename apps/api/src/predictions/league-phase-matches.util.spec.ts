import { mergeLeaguePhaseMatchSets, type LeaguePhaseMatchRow } from './league-phase-matches.util';
import { Phase } from '@prisma/client';
import { loadLeaguePhaseMatches } from './league-phase-matches.util';

function row(id: string, day: number): LeaguePhaseMatchRow {
    return {
        id,
        status: 'SCHEDULED',
        advancingTeamId: null,
        homeScore: null,
        awayScore: null,
        penaltyHomeScore: null,
        penaltyAwayScore: null,
        matchDate: new Date(`2026-07-0${day}T12:00:00Z`),
    };
}

describe('mergeLeaguePhaseMatchSets', () => {
    it('devuelve la unión sin duplicados', () => {
        const league = [row('m1', 1), row('m2', 2)];
        const tournament = [row('m2', 2), row('m3', 3), row('m4', 4)];
        const merged = mergeLeaguePhaseMatchSets(league, tournament);
        expect(merged.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    });

    it('ordena por fecha de partido', () => {
        const merged = mergeLeaguePhaseMatchSets([row('late', 8)], [row('early', 1)]);
        expect(merged.map((m) => m.id)).toEqual(['early', 'late']);
    });
});

describe('loadLeaguePhaseMatches', () => {
    it('usa torneo vinculado cuando LeagueMatch está incompleto', async () => {
        const tournamentMatches = Array.from({ length: 8 }, (_, i) => row(`r16-${i}`, i + 1));
        const prisma = {
            match: {
                findMany: jest.fn(async (args: { where: { tournamentId?: { in: string[] } } }) => {
                    if (args.where.tournamentId) return tournamentMatches;
                    return [tournamentMatches[0]];
                }),
            },
            league: {
                findUnique: jest.fn(async () => ({
                    primaryTournamentId: 'tour-1',
                    leagueTournaments: [{ tournamentId: 'tour-1' }],
                })),
            },
        };

        const result = await loadLeaguePhaseMatches(prisma as any, 'league-1', Phase.ROUND_OF_16);
        expect(result).toHaveLength(8);
    });

    it('sin torneo vinculado solo usa LeagueMatch', async () => {
        const leagueOnly = [row('lm-1', 1), row('lm-2', 2)];
        const prisma = {
            match: {
                findMany: jest.fn(async () => leagueOnly),
            },
            league: {
                findUnique: jest.fn(async () => ({
                    primaryTournamentId: null,
                    leagueTournaments: [],
                })),
            },
        };

        const result = await loadLeaguePhaseMatches(prisma as any, 'league-1', Phase.QUARTER);
        expect(result).toHaveLength(2);
        expect(prisma.match.findMany).toHaveBeenCalledTimes(1);
    });
});
