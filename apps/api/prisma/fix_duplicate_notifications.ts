/**
 * fix_duplicate_notifications.ts — Elimina notificaciones duplicadas por (userId, type, matchId).
 *
 * El scheduler crea una notificación por cada liga a la que pertenece el usuario
 * para el mismo partido, generando N filas idénticas en semántica (mismo evento).
 * Este script mantiene solo la más antigua de cada grupo y elimina el resto.
 *
 * Uso:
 *   npx tsx -r dotenv/config prisma/fix_duplicate_notifications.ts           # dry-run
 *   npx tsx -r dotenv/config prisma/fix_duplicate_notifications.ts --fix     # aplica
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const DRY_RUN = !process.argv.includes('--fix');

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
  };
}

async function main() {
  const adapter = new PrismaMariaDb(buildMariaConfig());
  const prisma = new PrismaClient({ adapter } as any);

  console.log(`\n=== fix_duplicate_notifications [${DRY_RUN ? 'DRY-RUN' : 'FIX'}] ===\n`);

  // Traer todas las notificaciones con campo data (tienen matchId potencialmente)
  const all = await prisma.notification.findMany({
    where: { data: { not: null } },
    select: { id: true, userId: true, type: true, data: true, sentAt: true },
    orderBy: { sentAt: 'asc' }, // más antigua primero → será el keeper
  });

  console.log(`Total notificaciones con data: ${all.length}`);

  // Agrupar por (userId, type, matchId)
  const groups = new Map<string, { keeperId: string; duplicateIds: string[] }>();

  for (const n of all) {
    let matchId: string | null = null;
    try {
      const parsed = JSON.parse(n.data as string) as Record<string, unknown>;
      matchId = typeof parsed.matchId === 'string' ? parsed.matchId : null;
    } catch {
      continue;
    }
    if (!matchId) continue;

    const key = `${n.userId}:${n.type}:${matchId}`;
    if (!groups.has(key)) {
      // Primera (más antigua) → keeper
      groups.set(key, { keeperId: n.id, duplicateIds: [] });
    } else {
      groups.get(key)!.duplicateIds.push(n.id);
    }
  }

  const idsToDelete: string[] = [];
  let groupsWithDups = 0;

  for (const [key, { keeperId, duplicateIds }] of groups) {
    if (duplicateIds.length === 0) continue;
    groupsWithDups++;
    idsToDelete.push(...duplicateIds);
    if (DRY_RUN) {
      const [userId, type, matchId] = key.split(':');
      console.log(`  [DUP] userId=${userId} type=${type} matchId=${matchId} → keeper=${keeperId} eliminar=${duplicateIds.length}`);
    }
  }

  console.log(`\nGrupos con duplicados: ${groupsWithDups}`);
  console.log(`Notificaciones a eliminar: ${idsToDelete.length}`);

  if (!DRY_RUN && idsToDelete.length > 0) {
    // Eliminar en lotes de 500 para no superar límites de query
    const BATCH = 500;
    let deleted = 0;
    for (let i = 0; i < idsToDelete.length; i += BATCH) {
      const batch = idsToDelete.slice(i, i + BATCH);
      const { count } = await prisma.notification.deleteMany({
        where: { id: { in: batch } },
      });
      deleted += count;
      console.log(`  Lote ${Math.floor(i / BATCH) + 1}: eliminadas ${count}`);
    }
    console.log(`\n✓ Total eliminadas: ${deleted}`);
  } else if (DRY_RUN && idsToDelete.length > 0) {
    console.log('\nEjecuta con --fix para aplicar los cambios.');
  } else {
    console.log('\n✓ No hay duplicados que eliminar.');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
