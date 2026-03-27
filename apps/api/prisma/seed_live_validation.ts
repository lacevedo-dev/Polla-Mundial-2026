import 'dotenv/config';
import { PrismaClient, Phase } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';

type Fixture = {
  fixture: {
    id: number;
    date: string;
    venue?: { name?: string | null };
    status?: { short?: string | null; long?: string | null; elapsed?: number | null };
  };
  league: {
    id: number;
    name: string;
    round?: string | null;
    season?: number | null;
  };
  teams: {
    home: { id: number; name: string; code?: string | null; logo?: string | null };
    away: { id: number; name: string; code?: string | null; logo?: string | null };
  };
  goals: { home: number | null; away: number | null };
};

type CliOptions = {
  days: number;
  timezone: string;
  coverage: number;
  maxFixturesPerTournament: number;
  demoUsersPerLeague: number;
  simulateLifecycle: boolean;
  baseDate: Date;
};

const HELP = `
Uso:
  npx tsx -r dotenv/config prisma/seed_live_validation.ts [opciones]

Opciones:
  --days=3                      Próximos días a sincronizar
  --timezone=America/Bogota     Zona horaria de consulta a API-Football
  --coverage=0.85               Cobertura objetivo de pronósticos por liga
  --maxFixturesPerTournament=8  Máximo de fixtures por torneo
  --demoUsersPerLeague=0        Usuarios demo extra por liga para carga
  --simulateLifecycle=true      Crea 4 partidos sintéticos: apertura/cierre/en vivo/finalizado
  --baseDate=2026-03-26         Fecha base reproducible
  --help                        Muestra esta ayuda
`.trim();

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseOptions(): CliOptions {
  if (hasFlag('help')) {
    console.log(HELP);
    process.exit(0);
  }

  const baseDateRaw = getArg('baseDate');
  const baseDate = baseDateRaw ? new Date(`${baseDateRaw}T12:00:00Z`) : new Date();

  return {
    days: Number(getArg('days') ?? 3),
    timezone: getArg('timezone') ?? process.env.TIMEZONE ?? 'America/Bogota',
    coverage: Math.min(Math.max(Number(getArg('coverage') ?? 0.85), 0.05), 1),
    maxFixturesPerTournament: Math.max(Number(getArg('maxFixturesPerTournament') ?? 8), 1),
    demoUsersPerLeague: Math.max(Number(getArg('demoUsersPerLeague') ?? 0), 0),
    simulateLifecycle: (getArg('simulateLifecycle') ?? 'true') !== 'false',
    baseDate,
  };
}

function buildMariaConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL no está configurada.');
  }
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 4,
    minimumIdle: 1,
    acquireTimeout: 30000,
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildCode(name: string): string {
  const words = normalize(name).split(' ').filter(Boolean);
  const compact = words.slice(0, 3).map((w) => w.slice(0, 1)).join('').toUpperCase();
  return (compact || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3) || 'TMP').slice(0, 8);
}

function mapStatus(short?: string | null): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' {
  if (!short) return 'SCHEDULED';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'LIVE';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED';
  if (['PST', 'SUSP', 'INT'].includes(short)) return 'POSTPONED';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'CANCELLED';
  return 'SCHEDULED';
}

function mapPhase(round?: string | null): Phase {
  const text = normalize(round);
  if (text.includes('round of 32') || text.includes('1 16')) return 'ROUND_OF_32';
  if (text.includes('round of 16') || text.includes('octavos')) return 'ROUND_OF_16';
  if (text.includes('quarter') || text.includes('cuartos')) return 'QUARTER';
  if (text.includes('semi')) return 'SEMI';
  if (text.includes('third') || text.includes('tercer')) return 'THIRD_PLACE';
  if (text.includes('final')) return 'FINAL';
  return 'GROUP';
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomScore(maxGoals = 4): [number, number] {
  return [randomInt(0, maxGoals), randomInt(0, maxGoals)];
}

function mutatePredictionFromResult(home: number, away: number): [number, number] {
  const roll = Math.random();
  if (roll < 0.18) return [home, away];
  if (roll < 0.5) {
    if (home === away) return [Math.max(home - 1, 0), Math.max(away - 1, 0)];
    const winnerHome = home > away;
    const baseHome = winnerHome ? Math.max(home - 1, 1) : randomInt(0, 1);
    const baseAway = winnerHome ? randomInt(0, Math.max(baseHome - 1, 0)) : Math.max(away - 1, 1);
    return [baseHome, baseAway];
  }
  return randomScore();
}

async function apiGetFixtures(date: string, timezone: string): Promise<Fixture[]> {
  const apiKey = (process.env.API_FOOTBALL_KEY ?? '').replace(/^"|"$/g, '');
  if (!apiKey) throw new Error('API_FOOTBALL_KEY no está configurada.');

  const params = new URLSearchParams({
    date,
    timezone,
  });

  const response = await fetch(`https://v3.football.api-sports.io/fixtures?${params.toString()}`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football respondió ${response.status} para date=${date}`);
  }

  const payload = await response.json() as { response?: Fixture[] };
  return payload.response ?? [];
}

async function ensureTeam(
  prisma: PrismaClient,
  teamData: Fixture['teams']['home'],
): Promise<string> {
  const existing = await prisma.team.findFirst({
    where: {
      OR: [
        { apiFootballTeamId: teamData.id },
        { name: teamData.name },
      ],
    },
  });

  if (existing) {
    if (!existing.apiFootballTeamId || existing.flagUrl !== (teamData.logo ?? null)) {
      await prisma.team.update({
        where: { id: existing.id },
        data: {
          apiFootballTeamId: existing.apiFootballTeamId ?? teamData.id,
          flagUrl: teamData.logo ?? existing.flagUrl,
          shortCode: existing.shortCode ?? teamData.code ?? existing.shortCode,
        },
      });
    }
    return existing.id;
  }

  const codeBase = (teamData.code ?? buildCode(teamData.name)).toUpperCase();
  let code = codeBase.slice(0, 8);
  let suffix = 1;
  while (await prisma.team.findFirst({ where: { code } })) {
    code = `${codeBase.slice(0, 6)}${suffix}`.slice(0, 8);
    suffix++;
  }

  const created = await prisma.team.create({
    data: {
      name: teamData.name,
      code,
      shortCode: teamData.code ?? code,
      apiFootballTeamId: teamData.id,
      flagUrl: teamData.logo ?? null,
    },
  });

  return created.id;
}

async function ensureDemoUsers(
  prisma: PrismaClient,
  leagues: Array<{ id: string; code: string }>,
  demoUsersPerLeague: number,
): Promise<number> {
  if (demoUsersPerLeague <= 0) return 0;

  const passwordHash = await bcrypt.hash('Demo2026*', 10);
  let created = 0;

  for (const league of leagues) {
    for (let i = 1; i <= demoUsersPerLeague; i++) {
      const username = `stress_${league.code.toLowerCase()}_${String(i).padStart(2, '0')}`;
      const email = `${username}@seed.local`;

      const user = await prisma.user.upsert({
        where: { username },
        update: {
          name: `Stress ${league.code} ${i}`,
          email,
          passwordHash,
          emailVerified: true,
        },
        create: {
          username,
          email,
          name: `Stress ${league.code} ${i}`,
          passwordHash,
          emailVerified: true,
          plan: 'GOLD',
          systemRole: 'USER',
        },
      });

      await prisma.leagueMember.upsert({
        where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
        update: { status: 'ACTIVE', role: 'PLAYER' },
        create: { userId: user.id, leagueId: league.id, status: 'ACTIVE', role: 'PLAYER' },
      });

      created++;
    }
  }

  return created;
}

async function main() {
  const options = parseOptions();
  const adapter = new PrismaMariaDb(buildMariaConfig());
  const prisma = new PrismaClient({ adapter });

  const summary = {
    fixturesFetched: 0,
    matchesCreated: 0,
    matchesUpdated: 0,
    syntheticMatches: 0,
    predictionsUpserted: 0,
    demoUsersCreated: 0,
  };

  try {
    const activeLeagues = await prisma.league.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        closePredictionMinutes: true,
        primaryTournamentId: true,
        primaryTournament: {
          select: { id: true, name: true, apiFootballLeagueId: true, season: true },
        },
        leagueTournaments: {
          select: {
            tournament: {
              select: { id: true, name: true, apiFootballLeagueId: true, season: true },
            },
          },
        },
      },
    });

    const tournamentMap = new Map<string, { id: string; name: string; apiFootballLeagueId: number; season: number }>();
    const leagueTournamentMap = new Map<string, Array<{ id: string; code: string; name: string; closePredictionMinutes: number }>>();

    for (const league of activeLeagues) {
      const targets = [
        league.primaryTournament,
        ...league.leagueTournaments.map((lt) => lt.tournament),
      ].filter(Boolean) as Array<{ id: string; name: string; apiFootballLeagueId: number; season: number }>;

      for (const tournament of targets) {
        tournamentMap.set(tournament.id, tournament);
        const bucket = leagueTournamentMap.get(tournament.id) ?? [];
        bucket.push({
          id: league.id,
          code: league.code,
          name: league.name,
          closePredictionMinutes: league.closePredictionMinutes,
        });
        leagueTournamentMap.set(tournament.id, bucket);
      }
    }

    if (tournamentMap.size === 0) {
      throw new Error('No hay torneos activos enlazados a ligas activas. Primero asigna torneos a las ligas.');
    }

    const tournaments = [...tournamentMap.values()];
    console.log(`\n⚽ Torneos activos detectados: ${tournaments.length}`);
    tournaments.forEach((t) => console.log(`  - ${t.name} | apiLeague=${t.apiFootballLeagueId} | season=${t.season}`));

    if (options.demoUsersPerLeague > 0) {
      summary.demoUsersCreated = await ensureDemoUsers(
        prisma,
        activeLeagues.map((l) => ({ id: l.id, code: l.code })),
        options.demoUsersPerLeague,
      );
      console.log(`\n👥 Usuarios demo asegurados: ${summary.demoUsersCreated}`);
    }

    const importedMatches: Array<{ id: string; tournamentId: string | null; status: string; matchDate: Date; homeScore: number | null; awayScore: number | null }> = [];

    for (let offset = 0; offset < options.days; offset++) {
      const date = formatDate(addDays(options.baseDate, offset));
      console.log(`\n📅 Consultando fixtures para ${date}...`);
      const fixturesByDate = await apiGetFixtures(date, options.timezone);

      for (const tournament of tournaments) {
        const fixtures = fixturesByDate.filter(
          (fixture) =>
            fixture.league.id === tournament.apiFootballLeagueId &&
            Number(fixture.league.season ?? 0) === Number(tournament.season),
        );
        const selected = fixtures
          .filter((fixture) => fixture.teams.home?.id && fixture.teams.away?.id)
          .slice(0, options.maxFixturesPerTournament);

        if (selected.length === 0) continue;
        summary.fixturesFetched += selected.length;

        console.log(`  • ${tournament.name}: ${selected.length} fixture(s)`);

        for (const fixture of selected) {
          const homeTeamId = await ensureTeam(prisma, fixture.teams.home);
          const awayTeamId = await ensureTeam(prisma, fixture.teams.away);
          const status = mapStatus(fixture.fixture.status?.short);
          const matchDate = new Date(fixture.fixture.date);
          const existing = await prisma.match.findUnique({
            where: { externalId: String(fixture.fixture.id) },
            select: { id: true },
          });

          const payload = {
            homeTeamId,
            awayTeamId,
            phase: mapPhase(fixture.league.round),
            round: fixture.league.round ?? fixture.league.name,
            matchDate,
            status,
            homeScore: fixture.goals.home,
            awayScore: fixture.goals.away,
            venue: fixture.fixture.venue?.name ?? null,
            tournamentId: tournament.id,
            lastSyncAt: new Date(),
            syncCount: { increment: 1 },
          };

          const match = existing
            ? await prisma.match.update({
                where: { id: existing.id },
                data: payload,
                select: { id: true, tournamentId: true, status: true, matchDate: true, homeScore: true, awayScore: true },
              })
            : await prisma.match.create({
                data: {
                  ...payload,
                  externalId: String(fixture.fixture.id),
                  syncCount: 1,
                },
                select: { id: true, tournamentId: true, status: true, matchDate: true, homeScore: true, awayScore: true },
              });

          if (existing) summary.matchesUpdated++;
          else summary.matchesCreated++;

          importedMatches.push(match);
        }
      }
    }

    if (options.simulateLifecycle && importedMatches.length > 0) {
      console.log('\n🧪 Creando partidos sintéticos de validación inmediata...');
      const source = importedMatches[0];
      const sourceMatch = await prisma.match.findUnique({
        where: { id: source.id },
        select: { homeTeamId: true, awayTeamId: true, tournamentId: true, venue: true },
      });

      if (sourceMatch) {
        const now = new Date();
        const scenarios = [
          { label: 'APERTURA', status: 'SCHEDULED', minutes: 120, scores: [null, null] as [number | null, number | null] },
          { label: 'CIERRE', status: 'SCHEDULED', minutes: 10, scores: [null, null] as [number | null, number | null] },
          { label: 'EN_VIVO', status: 'LIVE', minutes: -35, scores: [1, 0] as [number | null, number | null] },
          { label: 'FINALIZADO', status: 'FINISHED', minutes: -150, scores: [2, 1] as [number | null, number | null] },
        ];

        for (const scenario of scenarios) {
          const match = await prisma.match.create({
            data: {
              homeTeamId: sourceMatch.homeTeamId,
              awayTeamId: sourceMatch.awayTeamId,
              tournamentId: sourceMatch.tournamentId!,
              phase: Phase.GROUP,
              round: `Validación automática ${scenario.label}`,
              venue: `${sourceMatch.venue ?? 'Sin sede'} [VALIDACIÓN]`,
              matchDate: new Date(now.getTime() + scenario.minutes * 60_000),
              status: scenario.status as 'SCHEDULED' | 'LIVE' | 'FINISHED',
              homeScore: scenario.scores[0],
              awayScore: scenario.scores[1],
            },
            select: { id: true, tournamentId: true, status: true, matchDate: true, homeScore: true, awayScore: true },
          });
          importedMatches.push(match);
          summary.syntheticMatches++;
        }
      }
    }

    const membersByLeague = new Map<string, Array<{ userId: string }>>();
    for (const league of activeLeagues) {
      const members = await prisma.leagueMember.findMany({
        where: { leagueId: league.id, status: 'ACTIVE' },
        select: { userId: true },
      });
      membersByLeague.set(league.id, members);
    }

    console.log('\n🎯 Generando pronósticos aleatorios...');
    for (const match of importedMatches) {
      if (!match.tournamentId) continue;
      const leagues = leagueTournamentMap.get(match.tournamentId) ?? [];
      if (leagues.length === 0) continue;

      for (const league of leagues) {
        const members = membersByLeague.get(league.id) ?? [];
        const limit = Math.ceil(members.length * options.coverage);
        const selectedMembers = [...members].sort(() => Math.random() - 0.5).slice(0, limit);
        const deadline = new Date(match.matchDate.getTime() - Math.max(league.closePredictionMinutes, 0) * 60_000);

        for (const member of selectedMembers) {
          let prediction: [number, number];
          if (match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null) {
            prediction = mutatePredictionFromResult(match.homeScore, match.awayScore);
          } else if (match.status === 'LIVE' && match.homeScore !== null && match.awayScore !== null) {
            prediction = mutatePredictionFromResult(match.homeScore, match.awayScore);
          } else {
            prediction = randomScore();
          }

          const submittedAt = new Date(
            Math.min(
              deadline.getTime() - randomInt(5, 180) * 60_000,
              Date.now() - randomInt(1, 60) * 60_000,
            ),
          );

          await prisma.prediction.upsert({
            where: { userId_matchId_leagueId: { userId: member.userId, matchId: match.id, leagueId: league.id } },
            update: {
              homeScore: prediction[0],
              awayScore: prediction[1],
              submittedAt,
            },
            create: {
              userId: member.userId,
              matchId: match.id,
              leagueId: league.id,
              homeScore: prediction[0],
              awayScore: prediction[1],
              submittedAt,
            },
          });
          summary.predictionsUpserted++;
        }
      }
    }

    console.log('\n✅ Seed de validación completado');
    console.log(`  Fixtures consultados:     ${summary.fixturesFetched}`);
    console.log(`  Partidos creados:         ${summary.matchesCreated}`);
    console.log(`  Partidos actualizados:    ${summary.matchesUpdated}`);
    console.log(`  Partidos sintéticos:      ${summary.syntheticMatches}`);
    console.log(`  Pronósticos upsertados:   ${summary.predictionsUpserted}`);
    console.log(`  Usuarios demo creados:    ${summary.demoUsersCreated}`);
    console.log('\nSugerencias:');
    console.log('  1. Revisa la vista admin de partidos y pronósticos para confirmar apertura/cierre.');
    console.log('  2. Ejecuta el sync/live del backend para validar transiciones reales con fixtures enlazados.');
    console.log('  3. Recalcula puntos para los partidos FINALIZADO si quieres validar ranking de inmediato.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\n❌ seed_live_validation falló');
  console.error(error);
  process.exit(1);
});
