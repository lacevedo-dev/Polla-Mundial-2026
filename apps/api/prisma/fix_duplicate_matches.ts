/**
 * fix_duplicate_matches.ts — Detecta y unifica partidos duplicados en la base de datos.
 *
 * Un duplicado es un par de partidos con los mismos equipos (local/visitante)
 * cuyas fechas difieren menos de 4 horas (mismo partido real).
 *
 * Estrategia de merge:
 *   - KEEPER  = el que tiene externalId; si ninguno lo tiene, el que tiene más predicciones.
 *   - REMOVED = el otro. Sus predicciones se migran al keeper y luego se elimina.
 *
 * Uso:
 *   npx ts-node -r dotenv/config prisma/fix_duplicate_matches.ts          # dry-run (solo reporta)
 *   npx ts-node -r dotenv/config prisma/fix_duplicate_matches.ts --fix    # aplica cambios
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const DRY_RUN = !process.argv.includes('--fix');
const MAX_DIFF_HOURS = 4;

function buildMariaConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL no está configurada.');
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

async function main() {
  const adapter = new PrismaMariaDb(buildMariaConfig());
  const prisma = new PrismaClient({ adapter });

  console.log(`\n🔍 Buscando partidos duplicados (ventana ±${MAX_DIFF_HOURS}h)...`);
  console.log(DRY_RUN ? '  ⚠️  MODO DRY-RUN — no se aplican cambios (usa --fix para ejecutar)\n' : '  ✅  MODO FIX — se aplicarán cambios\n');

  // 1. Cargar todos los partidos con sus equipos y conteo de predicciones
  const matches = await prisma.match.findMany({
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      matchDate: true,
      externalId: true,
      status: true,
      round: true,
      tournamentId: true,
      _count: { select: { predictions: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { matchDate: 'asc' },
  });

  console.log(`  Total de partidos en DB: ${matches.length}\n`);

  // 2. Agrupar por homeTeamId + awayTeamId
  const byPair = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = `${m.homeTeamId}__${m.awayTeamId}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(m);
  }

  // 3. Detectar duplicados dentro de cada par
  type DupGroup = { keeper: (typeof matches)[0]; removed: (typeof matches)[0]; diffHours: number };
  const dupGroups: DupGroup[] = [];

  for (const [, group] of byPair) {
    if (group.length < 2) continue;

    // Comparar cada combinación
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const diffMs = Math.abs(a.matchDate.getTime() - b.matchDate.getTime());
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours > MAX_DIFF_HOURS) continue;

        // Decidir cuál conservar
        let keeper = a;
        let removed = b;

        const aHasExt = !!a.externalId;
        const bHasExt = !!b.externalId;

        if (!aHasExt && bHasExt) {
          keeper = b; removed = a;
        } else if (aHasExt && !bHasExt) {
          keeper = a; removed = b;
        } else {
          // Ninguno o ambos tienen externalId — conservar el que tiene más predicciones
          if (b._count.predictions > a._count.predictions) {
            keeper = b; removed = a;
          }
        }

        dupGroups.push({ keeper, removed, diffHours: Math.round(diffHours * 10) / 10 });
      }
    }
  }

  if (dupGroups.length === 0) {
    console.log('✅ No se encontraron duplicados. La base de datos está limpia.\n');
    await prisma.$disconnect();
    return;
  }

  console.log(`⚠️  ${dupGroups.length} grupo(s) de duplicados detectados:\n`);

  let totalPredictionsMigrated = 0;
  let totalDeleted = 0;

  for (const { keeper, removed, diffHours } of dupGroups) {
    const label = `${keeper.homeTeam.name} vs ${keeper.awayTeam.name}`;
    const keeperDate = keeper.matchDate.toISOString().slice(0, 16);
    const removedDate = removed.matchDate.toISOString().slice(0, 16);

    console.log(`  📋 ${label} (diferencia: ${diffHours}h)`);
    console.log(`     KEEPER : id=${keeper.id}  ext=${keeper.externalId ?? 'null'}  preds=${keeper._count.predictions}  fecha=${keeperDate}  status=${keeper.status}`);
    console.log(`     REMOVE : id=${removed.id}  ext=${removed.externalId ?? 'null'}  preds=${removed._count.predictions}  fecha=${removedDate}  status=${removed.status}`);

    if (DRY_RUN) {
      console.log(`     → [dry-run] Migrar ${removed._count.predictions} predicción(es) y eliminar REMOVE\n`);
      continue;
    }

    // Migrar predicciones del removed al keeper (evitar conflicto unique userId+matchId+leagueId)
    const removedPreds = await prisma.prediction.findMany({
      where: { matchId: removed.id },
      select: { id: true, userId: true, leagueId: true },
    });

    let migrated = 0;
    for (const pred of removedPreds) {
      const exists = await prisma.prediction.findFirst({
        where: { userId: pred.userId, matchId: keeper.id, leagueId: pred.leagueId },
      });
      if (exists) {
        // Ya hay predicción en el keeper — eliminar la del removed sin migrar
        await prisma.prediction.delete({ where: { id: pred.id } });
      } else {
        await prisma.prediction.update({
          where: { id: pred.id },
          data: { matchId: keeper.id },
        });
        migrated++;
      }
    }

    // Actualizar keeper con externalId del removed si el keeper no tenía
    if (!keeper.externalId && removed.externalId) {
      await prisma.match.update({
        where: { id: keeper.id },
        data: { externalId: removed.externalId },
      });
    }

    // Transferir tournamentId al keeper si no lo tiene
    if (!keeper.tournamentId && removed.tournamentId) {
      await prisma.match.update({
        where: { id: keeper.id },
        data: { tournamentId: removed.tournamentId },
      });
    }

    // Eliminar el duplicado (cascade borra FootballSyncLog, ParticipationObligation)
    await prisma.match.delete({ where: { id: removed.id } });

    console.log(`     ✅ Migradas ${migrated} predicción(es), eliminado ${removed.id}\n`);
    totalPredictionsMigrated += migrated;
    totalDeleted++;
  }

  if (!DRY_RUN) {
    console.log(`\n🎉 Resumen:`);
    console.log(`   Partidos eliminados   : ${totalDeleted}`);
    console.log(`   Predicciones migradas : ${totalPredictionsMigrated}\n`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
