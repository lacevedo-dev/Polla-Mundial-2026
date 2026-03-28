/**
 * fix_duplicate_matches.ts - Detecta y unifica partidos duplicados en la base de datos.
 *
 * Un duplicado es un par de partidos con los mismos equipos (local/visitante)
 * cuyas fechas difieren menos de 4 horas (mismo partido real).
 *
 * Estrategia de merge:
 *   - KEEPER  = el que tiene externalId; si ninguno lo tiene, el que tiene mas predicciones.
 *   - REMOVED = el otro. Sus predicciones se migran al keeper y luego se elimina.
 *
 * Uso:
 *   npx tsx -r dotenv/config prisma/fix_duplicate_matches.ts          # dry-run (solo reporta)
 *   npx tsx -r dotenv/config prisma/fix_duplicate_matches.ts --fix    # aplica cambios
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const DRY_RUN = !process.argv.includes('--fix');
const MAX_DIFF_HOURS = 4;

function buildMariaConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL no esta configurada.');
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

  console.log(`\n[scan] Buscando partidos duplicados (ventana +/-${MAX_DIFF_HOURS}h)...`);
  console.log(
    DRY_RUN
      ? '  [dry-run] No se aplican cambios (usa --fix para ejecutar)\n'
      : '  [fix] Se aplicaran cambios\n',
  );

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

  const byPair = new Map<string, typeof matches>();
  for (const match of matches) {
    const key = `${match.homeTeamId}__${match.awayTeamId}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(match);
  }

  type DupGroup = {
    keeper: (typeof matches)[0];
    removed: (typeof matches)[0];
    diffHours: number;
  };
  const dupGroups: DupGroup[] = [];

  for (const [, group] of byPair) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const diffMs = Math.abs(a.matchDate.getTime() - b.matchDate.getTime());
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours > MAX_DIFF_HOURS) continue;

        let keeper = a;
        let removed = b;

        const aHasExt = !!a.externalId;
        const bHasExt = !!b.externalId;

        if (!aHasExt && bHasExt) {
          keeper = b;
          removed = a;
        } else if (aHasExt && !bHasExt) {
          keeper = a;
          removed = b;
        } else if (b._count.predictions > a._count.predictions) {
          keeper = b;
          removed = a;
        }

        dupGroups.push({
          keeper,
          removed,
          diffHours: Math.round(diffHours * 10) / 10,
        });
      }
    }
  }

  if (dupGroups.length === 0) {
    console.log('[ok] No se encontraron duplicados. La base de datos esta limpia.\n');
    await prisma.$disconnect();
    return;
  }

  console.log(`[warn] ${dupGroups.length} grupo(s) de duplicados detectados:\n`);

  let totalPredictionsMigrated = 0;
  let totalDeleted = 0;

  for (const { keeper, removed, diffHours } of dupGroups) {
    const label = `${keeper.homeTeam.name} vs ${keeper.awayTeam.name}`;
    const keeperDate = keeper.matchDate.toISOString().slice(0, 16);
    const removedDate = removed.matchDate.toISOString().slice(0, 16);

    console.log(`  [match] ${label} (diferencia: ${diffHours}h)`);
    console.log(
      `     KEEPER : id=${keeper.id}  ext=${keeper.externalId ?? 'null'}  preds=${keeper._count.predictions}  fecha=${keeperDate}  status=${keeper.status}`,
    );
    console.log(
      `     REMOVE : id=${removed.id}  ext=${removed.externalId ?? 'null'}  preds=${removed._count.predictions}  fecha=${removedDate}  status=${removed.status}`,
    );

    if (DRY_RUN) {
      console.log(
        `     -> [dry-run] Migrar ${removed._count.predictions} prediccion(es) y eliminar REMOVE\n`,
      );
      continue;
    }

    let migrated = 0;
    let movedSyncLogs = 0;

    await prisma.$transaction(
      async (tx) => {
        const [removedPreds, keeperPreds] = await Promise.all([
          tx.prediction.findMany({
            where: { matchId: removed.id },
            select: { id: true, userId: true, leagueId: true },
          }),
          tx.prediction.findMany({
            where: { matchId: keeper.id },
            select: { userId: true, leagueId: true },
          }),
        ]);

        const keeperKeys = new Set(
          keeperPreds.map((pred) => `${pred.userId}__${pred.leagueId}`),
        );

        for (const pred of removedPreds) {
          const key = `${pred.userId}__${pred.leagueId}`;
          if (keeperKeys.has(key)) {
            await tx.prediction.delete({ where: { id: pred.id } });
            continue;
          }

          await tx.prediction.update({
            where: { id: pred.id },
            data: { matchId: keeper.id },
          });
          keeperKeys.add(key);
          migrated++;
        }

        // FootballSyncLog.matchId referencia Match sin onDelete: Cascade.
        const syncLogResult = await tx.footballSyncLog.updateMany({
          where: { matchId: removed.id },
          data: { matchId: keeper.id },
        });
        movedSyncLogs = syncLogResult.count;

        if (!keeper.externalId && removed.externalId) {
          await tx.match.update({
            where: { id: keeper.id },
            data: { externalId: removed.externalId },
          });
        }

        if (!keeper.tournamentId && removed.tournamentId) {
          await tx.match.update({
            where: { id: keeper.id },
            data: { tournamentId: removed.tournamentId },
          });
        }

        await tx.match.delete({ where: { id: removed.id } });
      },
      { maxWait: 10000, timeout: 30000 },
    );

    console.log(
      `     [ok] Migradas ${migrated} prediccion(es), reasignados ${movedSyncLogs} log(s), eliminado ${removed.id}\n`,
    );
    totalPredictionsMigrated += migrated;
    totalDeleted++;
  }

  if (!DRY_RUN) {
    console.log('\n[done] Resumen:');
    console.log(`   Partidos eliminados   : ${totalDeleted}`);
    console.log(`   Predicciones migradas : ${totalPredictionsMigrated}\n`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});