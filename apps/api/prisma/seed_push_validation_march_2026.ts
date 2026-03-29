import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

type MatchSeed = {
  key: string;
  homeCode: string;
  awayCode: string;
  matchDate: string;
  venue: string;
  round: string;
  label: string;
};

const MATCHES: MatchSeed[] = [
  {
    key: 'push-val-2026-03-29-col-arg',
    homeCode: 'COL',
    awayCode: 'ARG',
    matchDate: '2026-03-29T15:00:00-05:00',
    venue: 'El Campín, Bogotá',
    round: 'Push Validation',
    label: 'Colombia vs Argentina',
  },
  {
    key: 'push-val-2026-03-30-bra-esp',
    homeCode: 'BRA',
    awayCode: 'ESP',
    matchDate: '2026-03-30T17:00:00-05:00',
    venue: 'Maracanã, Río de Janeiro',
    round: 'Push Validation',
    label: 'Brasil vs España',
  },
  {
    key: 'push-val-2026-03-31-fra-ger',
    homeCode: 'FRA',
    awayCode: 'GER',
    matchDate: '2026-03-31T18:30:00-05:00',
    venue: 'Stade de France, París',
    round: 'Push Validation',
    label: 'Francia vs Alemania',
  },
];

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('DATABASE_URL no encontrado en .env');
  }

  const connectionUrl = rawUrl.startsWith('mysql://')
    ? `mariadb://${rawUrl.slice('mysql://'.length)}`
    : rawUrl;

  const adapter = new PrismaMariaDb(connectionUrl);
  return new PrismaClient({ adapter: adapter as never });
}

function stableHash(input: string): number {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function buildPrediction(userId: string, leagueId: string, matchKey: string) {
  const homeScore = stableHash(`${userId}:${leagueId}:${matchKey}:home`) % 5;
  const awayScore = stableHash(`${userId}:${leagueId}:${matchKey}:away`) % 5;

  return { homeScore, awayScore };
}

async function main() {
  const prisma = createPrismaClient();
  await prisma.$connect();

  try {
    console.log('🧪 Preparando carga de validación push para 29, 30 y 31/03/2026...');

    const tournament = await prisma.tournament.findFirst({
      where: {
        season: 2026,
        OR: [{ name: { contains: 'Friendlies' } }, { name: { contains: 'Friendly' } }],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!tournament) {
      throw new Error('No encontré un torneo de amistosos 2026 para asociar estos partidos.');
    }

    const teams = await prisma.team.findMany({
      where: {
        code: {
          in: [...new Set(MATCHES.flatMap((match) => [match.homeCode, match.awayCode]))],
        },
      },
      select: { id: true, code: true, name: true },
    });

    const teamMap = new Map(teams.map((team) => [team.code, team]));

    for (const match of MATCHES) {
      if (!teamMap.has(match.homeCode) || !teamMap.has(match.awayCode)) {
        throw new Error(`Faltan equipos requeridos para ${match.label}: ${match.homeCode}/${match.awayCode}`);
      }
    }

    const leagues = await prisma.league.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { primaryTournamentId: tournament.id },
          { leagueTournaments: { some: { tournamentId: tournament.id } } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        members: {
          where: { status: 'ACTIVE' },
          select: {
            userId: true,
          },
        },
      },
    });

    if (leagues.length === 0) {
      throw new Error('No encontré ligas activas asociadas al torneo Friendlies 2026.');
    }

    const matchIds = new Map<string, string>();
    let createdMatches = 0;
    let reusedMatches = 0;

    for (const matchSeed of MATCHES) {
      const homeTeam = teamMap.get(matchSeed.homeCode)!;
      const awayTeam = teamMap.get(matchSeed.awayCode)!;
      const matchDate = new Date(matchSeed.matchDate);

      const existingMatch = await prisma.match.findFirst({
        where: {
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          matchDate,
          round: matchSeed.round,
          tournamentId: tournament.id,
        },
        select: { id: true },
      });

      const match = existingMatch
        ? await prisma.match.update({
            where: { id: existingMatch.id },
            data: {
              phase: 'GROUP',
              group: null,
              matchDate,
              venue: matchSeed.venue,
              status: 'SCHEDULED',
              tournamentId: tournament.id,
              round: matchSeed.round,
            },
            select: { id: true },
          })
        : await prisma.match.create({
            data: {
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              phase: 'GROUP',
              group: null,
              matchDate,
              venue: matchSeed.venue,
              status: 'SCHEDULED',
              tournamentId: tournament.id,
              round: matchSeed.round,
            },
            select: { id: true },
          });

      if (existingMatch) {
        reusedMatches++;
      } else {
        createdMatches++;
      }

      matchIds.set(matchSeed.key, match.id);
      console.log(`  ✓ ${matchSeed.label} — ${existingMatch ? 'ya existía' : 'creado'}`);
    }

    const matchIdList = [...matchIds.values()];
    const leagueIds = leagues.map((league) => league.id);
    const predictionRows: Array<{
      userId: string;
      matchId: string;
      leagueId: string;
      homeScore: number;
      awayScore: number;
    }> = [];

    for (const league of leagues) {
      const uniqueUserIds = [...new Set(league.members.map((member) => member.userId))];

      console.log(`\n🎯 ${league.name} (${league.code}) — ${uniqueUserIds.length} miembros activos`);

      for (const userId of uniqueUserIds) {
        for (const matchSeed of MATCHES) {
          const matchId = matchIds.get(matchSeed.key);

          if (!matchId) {
            continue;
          }

          const prediction = buildPrediction(userId, league.id, matchSeed.key);
          predictionRows.push({
            userId,
            matchId,
            leagueId: league.id,
            homeScore: prediction.homeScore,
            awayScore: prediction.awayScore,
          });
        }
      }
    }

    const deletedPredictions = await prisma.prediction.deleteMany({
      where: {
        leagueId: { in: leagueIds },
        matchId: { in: matchIdList },
      },
    });

    if (predictionRows.length > 0) {
      await prisma.prediction.createMany({
        data: predictionRows,
      });
    }

    console.log('\n✅ Carga completada');
    console.log(`   - Torneo: ${tournament.name} ${tournament.season}`);
    console.log(`   - Partidos creados: ${createdMatches}`);
    console.log(`   - Partidos reutilizados: ${reusedMatches}`);
    console.log(`   - Pronósticos limpiados: ${deletedPredictions.count}`);
    console.log(`   - Pronósticos insertados: ${predictionRows.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\n❌ Error cargando validación push:', error);
  process.exit(1);
});
