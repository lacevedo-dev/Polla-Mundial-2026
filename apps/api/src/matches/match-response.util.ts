import { Prisma } from '@prisma/client';

export const matchTeamSelect = Prisma.validator<Prisma.TeamSelect>()({
  id: true,
  name: true,
  code: true,
  shortCode: true,
  flagUrl: true,
});

export const matchWithTeamsSelect = Prisma.validator<Prisma.MatchSelect>()({
  id: true,
  matchDate: true,
  status: true,
  phase: true,
  group: true,
  venue: true,
  homeScore: true,
  awayScore: true,
  externalId: true,
  homeTeam: {
    select: matchTeamSelect,
  },
  awayTeam: {
    select: matchTeamSelect,
  },
});

type MatchWithTeams = Prisma.MatchGetPayload<{
  select: typeof matchWithTeamsSelect;
}>;

export function toMatchResponse(match: MatchWithTeams) {
  return {
    id: match.id,
    matchDate: match.matchDate,
    status: match.status,
    phase: match.phase,
    group: match.group,
    venue: match.venue,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    externalId: match.externalId,
    homeTeam: {
      id: match.homeTeam.id,
      name: match.homeTeam.name,
      code: match.homeTeam.code,
      shortCode: match.homeTeam.shortCode,
      flagUrl: match.homeTeam.flagUrl,
    },
    awayTeam: {
      id: match.awayTeam.id,
      name: match.awayTeam.name,
      code: match.awayTeam.code,
      shortCode: match.awayTeam.shortCode,
      flagUrl: match.awayTeam.flagUrl,
    },
  };
}
