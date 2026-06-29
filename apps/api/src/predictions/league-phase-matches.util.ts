import { Phase } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export type LeaguePhaseMatchRow = {
    id: string;
    status: string;
    homeTeamId?: string;
    awayTeamId?: string;
    advancingTeamId: string | null;
    matchDate: Date;
};

const MATCH_SELECT = {
    id: true,
    status: true,
    homeTeamId: true,
    awayTeamId: true,
    advancingTeamId: true,
    matchDate: true,
} as const;

/** Une partidos de liga y torneo sin duplicar, ordenados por fecha. */
export function mergeLeaguePhaseMatchSets(
    viaLeagueMatch: LeaguePhaseMatchRow[],
    viaTournament: LeaguePhaseMatchRow[],
): LeaguePhaseMatchRow[] {
    const byId = new Map<string, LeaguePhaseMatchRow>();
    for (const match of viaTournament) byId.set(match.id, match);
    for (const match of viaLeagueMatch) byId.set(match.id, match);
    return [...byId.values()].sort(
        (a, b) => a.matchDate.getTime() - b.matchDate.getTime(),
    );
}

/**
 * Partidos de una fase eliminatoria para una polla.
 * Usa LeagueMatch y, si la liga tiene torneo(s) vinculado(s), también el cuadro del torneo
 * (evita denominadores 0/1 o 0/7 cuando solo hay LeagueMatch por predicciones).
 */
export async function loadLeaguePhaseMatches(
    prisma: Pick<PrismaClient, 'match' | 'league'>,
    leagueId: string,
    phase: Phase,
): Promise<LeaguePhaseMatchRow[]> {
    const [viaLeagueMatch, league] = await Promise.all([
        prisma.match.findMany({
            where: { phase, leagueMatches: { some: { leagueId } } },
            select: MATCH_SELECT,
            orderBy: { matchDate: 'asc' },
        }),
        prisma.league.findUnique({
            where: { id: leagueId },
            select: {
                primaryTournamentId: true,
                leagueTournaments: { select: { tournamentId: true } },
            },
        }),
    ]);

    const tournamentIds = new Set<string>();
    if (league?.primaryTournamentId) tournamentIds.add(league.primaryTournamentId);
    for (const lt of league?.leagueTournaments ?? []) {
        if (lt.tournamentId) tournamentIds.add(lt.tournamentId);
    }

    if (tournamentIds.size === 0) {
        return viaLeagueMatch;
    }

    const viaTournament = await prisma.match.findMany({
        where: { phase, tournamentId: { in: [...tournamentIds] } },
        select: MATCH_SELECT,
        orderBy: { matchDate: 'asc' },
    });

    return mergeLeaguePhaseMatchSets(viaLeagueMatch, viaTournament);
}
