import { LeagueStatus, Prisma } from '@prisma/client';

export type AutomationExcludedLeague = {
  id: string;
  code: string;
  name: string;
  status: LeagueStatus;
};

type LeagueReader = {
  league: {
    findMany: (
      args: Prisma.LeagueFindManyArgs,
    ) => Promise<Array<{ id: string } & AutomationExcludedLeague>>;
  };
  leagueMatch: {
    findMany: (
      args: Prisma.LeagueMatchFindManyArgs,
    ) => Promise<Array<{ leagueId: string }>>;
  };
};

/** Pollas que aplicarían al partido pero están excluidas porque status !== ACTIVE. */
export async function findLeaguesExcludedFromAutomation(
  prisma: LeagueReader,
  params: {
    matchId: string;
    tournamentId: string | null;
    predictionLeagueIds: string[];
    restrictToLeagueId?: string;
  },
): Promise<AutomationExcludedLeague[]> {
  const candidateIds = new Set<string>(params.predictionLeagueIds);

  const leagueMatches = await prisma.leagueMatch.findMany({
    where: { matchId: params.matchId, active: true },
    select: { leagueId: true },
  });
  for (const row of leagueMatches) {
    candidateIds.add(row.leagueId);
  }

  const leagueIdSelect = { id: true } as const;

  if (params.tournamentId) {
    const [tournamentLeagues, leaguesWithoutTournament] = await Promise.all([
      prisma.league.findMany({
        where: {
          leagueTournaments: { some: { tournamentId: params.tournamentId } },
        },
        select: leagueIdSelect,
      }),
      prisma.league.findMany({
        where: { leagueTournaments: { none: {} } },
        select: leagueIdSelect,
      }),
    ]);
    for (const league of [...tournamentLeagues, ...leaguesWithoutTournament]) {
      candidateIds.add(league.id);
    }
  } else {
    const leaguesWithoutTournament = await prisma.league.findMany({
      select: leagueIdSelect,
    });
    for (const league of leaguesWithoutTournament) {
      candidateIds.add(league.id);
    }
  }

  if (params.restrictToLeagueId) {
    const restricted = candidateIds.has(params.restrictToLeagueId)
      ? params.restrictToLeagueId
      : params.restrictToLeagueId;
    candidateIds.clear();
    candidateIds.add(restricted);
  }

  if (candidateIds.size === 0) {
    return [];
  }

  return prisma.league.findMany({
    where: {
      id: { in: [...candidateIds] },
      status: { not: LeagueStatus.ACTIVE },
    },
    select: { id: true, code: true, name: true, status: true },
    orderBy: { code: 'asc' },
  });
}

export function formatAutomationExcludedLeaguesMessage(
  leagues: AutomationExcludedLeague[],
): string | null {
  if (leagues.length === 0) {
    return null;
  }

  const list = leagues.map((league) => `${league.code} (${league.status})`).join(', ');
  return (
    `La automatización (T-60, escaladas, WA grupo, etc.) solo corre en pollas ACTIVE. ` +
    `Cambia el estado en Admin → Pollas: ${list}.`
  );
}
