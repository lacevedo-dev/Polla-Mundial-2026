/**
 * replace_fictional_matches.ts
 * Reemplaza los 3 partidos ficticios del seed con fixtures reales de API-Football.
 * Preserva todas las predicciones existentes (solo cambia equipos/fechas/externalId).
 *
 * Asignación:
 *   Colombia vs Argentina  → Colombia vs Croatia (1512757)
 *   Brasil vs España       → Brazil vs France    (1501815)
 *   Francia vs Alemania    → Italy vs N. Ireland  (1487925)
 *
 * Ejecutar:
 *   npx ts-node -r dotenv/config prisma/replace_fictional_matches.ts
 */

import 'dotenv/config';
import { PrismaClient, Phase } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function mapRoundToPhase(round: string): Phase {
  const r = round.toLowerCase();
  if (r.includes('group') || r.includes('regular') || r.includes('jornada')) return Phase.GROUP;
  if (r.includes('round of 32') || r.includes('last 32')) return Phase.ROUND_OF_32;
  if (r.includes('round of 16') || r.includes('last 16')) return Phase.ROUND_OF_16;
  if (r.includes('quarter')) return Phase.QUARTER;
  if (r.includes('semi'))    return Phase.SEMI;
  if (r.includes('3rd') || r.includes('third') || r.includes('bronze')) return Phase.THIRD_PLACE;
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

async function fetchFixture(fixtureId: number, apiKey: string): Promise<any> {
  const url = `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`;
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key':  apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  });
  const json = await res.json() as any;
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API error: ${JSON.stringify(json.errors)}`);
  }
  return (json.response as any[])?.[0] ?? null;
}

async function resolveTeam(
  prisma: PrismaClient,
  teamData: { id: number; name: string; logo?: string },
): Promise<string> {
  const existing = await prisma.team.findFirst({
    where: { OR: [{ apiFootballTeamId: teamData.id }, { name: teamData.name }] },
  });
  if (existing) {
    if (!existing.apiFootballTeamId) {
      await prisma.team.update({ where: { id: existing.id }, data: { apiFootballTeamId: teamData.id } });
    }
    return existing.id;
  }
  const code = (teamData.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) + teamData.id).slice(0, 10);
  const created = await prisma.team.create({
    data: { name: teamData.name, code, apiFootballTeamId: teamData.id, flagUrl: teamData.logo ?? null },
  });
  console.log(`    ✅ Equipo creado: ${created.name} (code=${code})`);
  return created.id;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const DELAY_MS = 7000;

/* ── Main ─────────────────────────────────────────────────────────────────── */

async function main() {
  const apiKey = process.env.API_FOOTBALL_KEY ?? '';
  if (!apiKey) throw new Error('API_FOOTBALL_KEY no definida en .env');

  const rawUrl = process.env.DATABASE_URL!;
  if (!rawUrl) throw new Error('DATABASE_URL no definida en .env');
  const connectionUrl = rawUrl.startsWith('mysql://')
    ? 'mariadb://' + rawUrl.slice('mysql://'.length)
    : rawUrl;

  const adapter = new PrismaMariaDb(connectionUrl);
  const prisma  = new PrismaClient({ adapter: adapter as any });
  await prisma.$connect();

  // ── 1. Buscar partidos ficticios en DB ────────────────────────────────────
  const colArg = await prisma.match.findFirst({
    where: {
      externalId: null,
      homeTeam:   { name: 'Colombia' },
      awayTeam:   { name: 'Argentina' },
    },
    include: { homeTeam: true, awayTeam: true },
  });

  const braEsp = await prisma.match.findFirst({
    where: {
      externalId: null,
      homeTeam:   { name: { in: ['Brasil', 'Brazil'] } },
      awayTeam:   { name: { in: ['España', 'Spain'] } },
    },
    include: { homeTeam: true, awayTeam: true },
  });

  const fraGer = await prisma.match.findFirst({
    where: {
      externalId: null,
      homeTeam:   { name: { in: ['Francia', 'France'] } },
      awayTeam:   { name: { in: ['Alemania', 'Germany'] } },
    },
    include: { homeTeam: true, awayTeam: true },
  });

  // ── 2. Definir asignaciones ───────────────────────────────────────────────
  const assignments = [
    {
      fictionalMatch: colArg,
      fixtureId: 1512757,
      label: 'Colombia vs Argentina  →  Colombia vs Croatia',
    },
    {
      fictionalMatch: braEsp,
      fixtureId: 1501815,
      label: 'Brasil vs España       →  Brazil vs France',
    },
    {
      fictionalMatch: fraGer,
      fixtureId: 1487925,
      label: 'Francia vs Alemania    →  Italy vs Northern Ireland',
    },
  ];

  // ── 3. Procesar cada asignación ───────────────────────────────────────────
  for (let i = 0; i < assignments.length; i++) {
    const { fictionalMatch, fixtureId, label } = assignments[i];

    console.log(`\n🔄 ${label}`);

    if (!fictionalMatch) {
      console.log('   ⚠ Partido ficticio no encontrado — puede que ya fue reemplazado');
      continue;
    }
    console.log(`   DB id: ${fictionalMatch.id} (${fictionalMatch.homeTeam.name} vs ${fictionalMatch.awayTeam.name})`);

    // Fetch desde API-Football
    if (i > 0) {
      process.stdout.write(`   ⏳ Esperando ${DELAY_MS / 1000}s (rate limit)...`);
      await sleep(DELAY_MS);
      process.stdout.write('\r                                          \r');
    }

    console.log(`   📡 Fetching fixture ${fixtureId}...`);
    const f = await fetchFixture(fixtureId, apiKey);
    if (!f) {
      console.log('   ❌ Sin datos en API-Football — skipped');
      continue;
    }

    const homeData = f.teams?.home;
    const awayData = f.teams?.away;
    const fixture  = f.fixture;
    const goals    = f.goals;
    const league   = f.league;

    console.log(`   📋 Real: ${homeData.name} vs ${awayData.name} | ${fixture.date} | [${fixture.status.short}]`);

    // Resolver equipos reales en DB
    const homeTeamId = await resolveTeam(prisma, homeData);
    const awayTeamId = await resolveTeam(prisma, awayData);

    // Eliminar registro duplicado que ya tenga ese externalId (si existe)
    const duplicate = await prisma.match.findUnique({
      where: { externalId: String(fixtureId) },
    });
    if (duplicate && duplicate.id !== fictionalMatch.id) {
      console.log(`   🗑 Eliminando registro duplicado importado (id=${duplicate.id})...`);
      await prisma.prediction.deleteMany({ where: { matchId: duplicate.id } });
      await prisma.match.delete({ where: { id: duplicate.id } });
    }

    // Actualizar el partido ficticio con datos reales
    await prisma.match.update({
      where: { id: fictionalMatch.id },
      data: {
        externalId:  String(fixtureId),
        homeTeamId,
        awayTeamId,
        homeScore:   goals?.home ?? null,
        awayScore:   goals?.away ?? null,
        status:      mapApiStatus(fixture?.status?.short),
        matchDate:   new Date(fixture.date),
        round:       league?.round ?? 'Amistoso',
        phase:       mapRoundToPhase(league?.round ?? ''),
        venue:       fixture?.venue?.name ?? null,
        lastSyncAt:  new Date(),
      },
    });

    const predCount = await prisma.prediction.count({ where: { matchId: fictionalMatch.id } });
    console.log(`   ✅ Actualizado — externalId=${fixtureId} | predicciones preservadas: ${predCount}`);
  }

  // ── 4. Estado final ───────────────────────────────────────────────────────
  console.log('\n\n📊 Estado final:');
  const ids = [colArg?.id, braEsp?.id, fraGer?.id].filter(Boolean) as string[];
  const updated = await prisma.match.findMany({
    where: { id: { in: ids } },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    orderBy: { matchDate: 'asc' },
  });
  for (const m of updated) {
    const preds = await prisma.prediction.count({ where: { matchId: m.id } });
    console.log(`  [externalId=${m.externalId}] ${m.homeTeam.name} vs ${m.awayTeam.name} | ${m.matchDate.toISOString().slice(0, 16)} | ${m.status} | ${preds} predicciones`);
  }

  await prisma.$disconnect();
  console.log('\n✅ Listo.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
