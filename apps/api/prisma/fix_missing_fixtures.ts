/**
 * fix_missing_fixtures.ts — Importa fixtures de API-Football que no tienen externalId en la DB
 *
 * Uso:
 *   npx ts-node -r dotenv/config prisma/fix_missing_fixtures.ts
 *
 * Qué hace:
 *   1. Toma la lista FIXTURE_IDS de abajo (los que fallaron o nunca se importaron)
 *   2. Llama a API-Football por cada uno
 *   3. Crea o actualiza el match en la DB con externalId correcto
 *   4. Crea equipos si no existen
 */

import 'dotenv/config';
import { PrismaClient, Phase } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
/* ── IDs a reimportar ─────────────────────────────────────────────────────── */
// Agrega aquí los IDs que quieras forzar su importación/actualización
const FIXTURE_IDS: number[] = [];

// Fechas a buscar en API-Football e importar todos los fixtures encontrados
// Formato: 'YYYY-MM-DD'
const SEARCH_DATES: string[] = [
  '2026-03-24', // primer día de la ventana FIFA — aún no importado
];

// IDs de ligas de API-Football a importar en búsquedas por fecha.
// Si está vacío, importa todos los encontrados en la fecha.
// 10=Friendlies, 1=World Cup, 28=WC Qual CONMEBOL, 29=WC Qual AFC
// 30=WC Qual CONCACAF, 31=WC Qual UEFA, 32=WC Qual CAF, 34=WC Qual OFC
const FILTER_LEAGUE_IDS: number[] = [10, 1, 28, 29, 30, 31, 32, 34];

const API_BASE = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io';
const API_KEY  = process.env.API_FOOTBALL_KEY ?? '';
/** Pausa entre llamadas a API-Football para no superar 10 req/min */
const DELAY_MS = 7000;

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function mapRoundToPhase(round: string): Phase {
  const r = round.toLowerCase();
  if (r.includes('group') || r.includes('regular') || r.includes('jornada')) return Phase.GROUP;
  if (r.includes('round of 32') || r.includes('last 32') || r.includes('round of 64')) return Phase.ROUND_OF_32;
  if (r.includes('round of 16') || r.includes('last 16') || r.includes('8th')) return Phase.ROUND_OF_16;
  if (r.includes('quarter')) return Phase.QUARTER;
  if (r.includes('semi'))    return Phase.SEMI;
  if (r.includes('3rd') || r.includes('third') || r.includes('bronze') || r.includes('tercer')) return Phase.THIRD_PLACE;
  if (r.includes('final'))   return Phase.FINAL;
  return Phase.GROUP;
}

function mapApiStatus(short: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' {
  if (!short) return 'SCHEDULED';
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'LIVE';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED';
  if (['PST', 'SUSP', 'INT'].includes(short)) return 'POSTPONED';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'CANCELLED';
  return 'SCHEDULED';
}

async function apiGet(params: Record<string, string | number>): Promise<any[]> {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY no configurada en .env');
  const qs  = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const url = `${API_BASE}/fixtures?${qs}`;
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key':  API_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  });
  const json = await res.json() as any;
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API error: ${JSON.stringify(json.errors)}`);
  }
  return (json.response as any[]) ?? [];
}

async function fetchFixture(fixtureId: number): Promise<any> {
  const results = await apiGet({ id: fixtureId });
  return results[0] ?? null;
}

async function fetchByDate(date: string): Promise<any[]> {
  return apiGet({ date, timezone: 'America/Bogota' });
}

async function resolveOrCreateTeam(
  prisma: PrismaClient,
  teamData: { id: number; name: string; logo?: string },
): Promise<string | null> {
  if (!teamData?.id) return null;

  const existing = await prisma.team.findFirst({
    where: {
      OR: [
        { apiFootballTeamId: teamData.id },
        { name: teamData.name },
      ],
    },
  });

  if (existing) {
    // Vincular apiFootballTeamId si aún no lo tiene
    if (!existing.apiFootballTeamId) {
      await prisma.team.update({
        where: { id: existing.id },
        data: { apiFootballTeamId: teamData.id },
      });
    }
    return existing.id;
  }

  // Generar un code único a partir del nombre
  const baseCode = teamData.name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  const code = `${baseCode}${teamData.id}`.slice(0, 10);

  const newTeam = await prisma.team.create({
    data: {
      name:              teamData.name,
      code,
      apiFootballTeamId: teamData.id,
      flagUrl:           teamData.logo ?? null,
    },
  });
  console.log(`  ✅ Equipo creado: ${newTeam.name} (code=${code}, apiId=${teamData.id})`);
  return newTeam.id;
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

async function main() {
  if (!API_KEY) {
    console.error('❌ API_FOOTBALL_KEY no está definida en .env');
    process.exit(1);
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL no encontrado en .env');
  const connectionUrl = rawUrl.startsWith('mysql://')
    ? `mariadb://${rawUrl.slice('mysql://'.length)}`
    : rawUrl;

  const adapter = new PrismaMariaDb(connectionUrl);
  const prisma  = new PrismaClient({ adapter: adapter as any });
  await prisma.$connect();

  // ── Búsqueda por fecha ───────────────────────────────────────────────────
  const allFixtureIds = new Set<number>(FIXTURE_IDS);

  for (const date of SEARCH_DATES) {
    console.log(`\n📅 Buscando fixtures para ${date}...`);
    let fixtures: any[];
    try {
      fixtures = await fetchByDate(date);
    } catch (err: any) {
      console.error(`   ⚠ Error buscando ${date}: ${err.message} — saltando`);
      continue;
    }
    const relevant = FILTER_LEAGUE_IDS.length === 0
      ? fixtures
      : fixtures.filter(f => FILTER_LEAGUE_IDS.includes(f.league?.id));

    // Mostrar ligas únicas encontradas para debug
    const uniqueLeagues = [...new Map(fixtures.map(f => [f.league?.id, `${f.league?.id}:${f.league?.name}`])).values()];
    console.log(`   Ligas disponibles: ${uniqueLeagues.slice(0, 10).join(', ')}${uniqueLeagues.length > 10 ? ` (+${uniqueLeagues.length - 10} más)` : ''}`);
    console.log(`   Encontrados: ${fixtures.length} totales, ${relevant.length} relevantes`);

    for (const f of relevant) {
      const id: number = f.fixture?.id;
      const home = f.teams?.home?.name ?? '?';
      const away = f.teams?.away?.name ?? '?';
      const leagueName = f.league?.name ?? '?';
      const status = f.fixture?.status?.short ?? '?';
      console.log(`   + [${id}] ${home} vs ${away} | ${leagueName} | ${status}`);
      if (id) allFixtureIds.add(id);
    }
  }

  console.log(`\n🔍 Importando ${allFixtureIds.size} fixture(s) en total...\n`);

  let imported = 0;
  let updated  = 0;
  let skipped  = 0;
  const errors: string[] = [];

  let callCount = 0;
  for (const fixtureId of allFixtureIds) {
    if (callCount > 0) {
      process.stdout.write(`  ⏳ Esperando ${DELAY_MS / 1000}s (rate limit)...`);
      await new Promise(r => setTimeout(r, DELAY_MS));
      process.stdout.write('\r                                    \r');
    }
    callCount++;
    console.log(`▶ Fixture ${fixtureId}`);
    try {
      const f = await fetchFixture(fixtureId);
      if (!f) {
        console.log(`  ⚠ Sin datos en API-Football — skipped`);
        skipped++;
        continue;
      }

      const homeData = f.teams?.home;
      const awayData = f.teams?.away;
      const league   = f.league;
      const fixture  = f.fixture;
      const goals    = f.goals;

      console.log(`  📋 ${homeData?.name} vs ${awayData?.name} — ${fixture?.date} [${fixture?.status?.short}]`);

      const homeTeamId = await resolveOrCreateTeam(prisma, homeData);
      const awayTeamId = await resolveOrCreateTeam(prisma, awayData);

      if (!homeTeamId || !awayTeamId) {
        console.log(`  ❌ Equipos no resueltos — skipped`);
        skipped++;
        errors.push(`Fixture ${fixtureId}: equipos no resueltos`);
        continue;
      }

      const externalId  = String(fixture?.id);
      const matchDate   = fixture?.date ? new Date(fixture.date) : new Date();
      const round       = league?.round ?? 'Playoff';
      const phase       = mapRoundToPhase(round);
      const matchStatus = mapApiStatus(fixture?.status?.short);
      const homeScore   = goals?.home ?? null;
      const awayScore   = goals?.away ?? null;
      const venue       = fixture?.venue?.name ?? null;

      const existing = await prisma.match.findUnique({ where: { externalId } });

      if (existing) {
        await prisma.match.update({
          where: { externalId },
          data: { homeScore, awayScore, status: matchStatus, matchDate, round, phase, venue, lastSyncAt: new Date() },
        });
        console.log(`  🔄 Match actualizado (id=${existing.id})`);
        updated++;
      } else {
        const created = await prisma.match.create({
          data: { homeTeamId, awayTeamId, homeScore, awayScore, phase, round, matchDate, status: matchStatus, externalId, venue, lastSyncAt: new Date() },
        });
        console.log(`  ✅ Match creado (id=${created.id}, externalId=${externalId})`);
        imported++;
      }
    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
      errors.push(`Fixture ${fixtureId}: ${err.message}`);
    }
  }

  await prisma.$disconnect();

  console.log(`\n────────────────────────────────────`);
  console.log(`✅ Importados: ${imported}`);
  console.log(`🔄 Actualizados: ${updated}`);
  console.log(`⚠  Skipped: ${skipped}`);
  if (errors.length) {
    console.log(`❌ Errores (${errors.length}):`);
    errors.forEach(e => console.log(`   - ${e}`));
  }
  console.log(`────────────────────────────────────\n`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
