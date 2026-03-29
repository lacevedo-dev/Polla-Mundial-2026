import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL no encontrado en .env');
  const connectionUrl = rawUrl.startsWith('mysql://') ? `mariadb://${rawUrl.slice('mysql://'.length)}` : rawUrl;
  const adapter = new PrismaMariaDb(connectionUrl);
  return new PrismaClient({ adapter: adapter as never });
}

async function main() {
  const prisma = createPrismaClient();
  await prisma.$connect();

  try {
    console.log('🧹 Buscando partidos duplicados (mismos equipos y torneo)...');

    // Get all matches
    const allMatches = await prisma.match.findMany({
      include: {
        homeTeam: { select: { code: true } },
        awayTeam: { select: { code: true } },
      },
    });

    // Group by homeTeamId + awayTeamId + tournamentId
    const groups = new Map<string, typeof allMatches>();
    for (const m of allMatches) {
      const key = `${m.homeTeamId}-${m.awayTeamId}-${m.tournamentId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }

    let deletedCount = 0;
    let movedPredictionsCount = 0;

    for (const [key, matches] of groups.entries()) {
      if (matches.length <= 1) continue;

      console.log(`\n⚠️ Duplicado detectado: ${matches[0].homeTeam.code} vs ${matches[0].awayTeam.code} (${matches.length} partidos)`);

      // Find the best match to keep (the one with externalId, or the newest)
      matches.sort((a, b) => {
        // Priority 1: Has externalId
        if (a.externalId && !b.externalId) return -1;
        if (!a.externalId && b.externalId) return 1;
        // Priority 2: Newest created
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      const targetMatch = matches[0];
      const sourceMatches = matches.slice(1);

      console.log(`   -> Conservando: ${targetMatch.id} (externalId: ${targetMatch.externalId || 'NINGUNO'})`);

      for (const source of sourceMatches) {
        console.log(`   -> Fusionando desde: ${source.id} (externalId: ${source.externalId || 'NINGUNO'})`);

        // Get predictions from source
        const predictions = await prisma.prediction.findMany({
          where: { matchId: source.id },
        });

        for (const p of predictions) {
          // Check if target already has a prediction from this user in this league
          const existingTargetPred = await prisma.prediction.findUnique({
            where: {
              userId_matchId_leagueId: {
                userId: p.userId,
                matchId: targetMatch.id,
                leagueId: p.leagueId,
              },
            },
          });

          if (!existingTargetPred) {
            // Move prediction
            await prisma.prediction.update({
              where: { id: p.id },
              data: { matchId: targetMatch.id },
            });
            movedPredictionsCount++;
          } else {
            // Duplicate prediction, keeping the newer one
            if (p.createdAt > existingTargetPred.createdAt) {
               await prisma.prediction.update({
                  where: { id: existingTargetPred.id },
                  data: {
                    homeScore: p.homeScore,
                    awayScore: p.awayScore,
                  }
               });
               await prisma.prediction.delete({ where: { id: p.id } });
               movedPredictionsCount++;
            } else {
               // Target already has a better or equal prediction, delete source
               await prisma.prediction.delete({ where: { id: p.id } });
            }
          }
        }

        // Check AutomationRun to avoid FK constraint errors 
        await prisma.$executeRaw`DELETE FROM AutomationRun WHERE matchId = ${source.id}`;
        
        // Finalize: delete source match
        await prisma.match.delete({
          where: { id: source.id },
        });
        deletedCount++;
        console.log(`      ✓ Eliminado partido antiguo ${source.id} y movidos/limpiados pronósticos.`);
      }
    }

    console.log(`\n✅ Resumen de Fusión:`);
    console.log(`   - Partidos duplicados eliminados: ${deletedCount}`);
    console.log(`   - Pronósticos rescatados/actualizados: ${movedPredictionsCount}`);

  } catch (error) {
    console.error('❌ Error migrando duplicados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
