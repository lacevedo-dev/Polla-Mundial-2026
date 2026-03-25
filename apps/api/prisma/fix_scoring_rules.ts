/**
 * fix_scoring_rules.ts
 * Migra las reglas de puntuación de todas las ligas existentes:
 * - Elimina CORRECT_DIFF (ya no existe en las reglas)
 * - Añade TEAM_GOALS, UNIQUE_PREDICTION y PHASE_BONUS_* si no existen
 *
 * Ejecutar: npx ts-node -r dotenv/config prisma/fix_scoring_rules.ts
 */
import 'dotenv/config';
import { PrismaClient, ScoringType } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const NEW_RULES: { ruleType: ScoringType; points: number; description: string }[] = [
  { ruleType: ScoringType.CORRECT_WINNER,    points: 2, description: 'Ganador / empate correcto' },
  { ruleType: ScoringType.TEAM_GOALS,        points: 1, description: 'Gol acertado (al menos un equipo)' },
  { ruleType: ScoringType.UNIQUE_PREDICTION, points: 5, description: 'Predicción única en la liga' },
  { ruleType: ScoringType.PHASE_BONUS_R32,   points: 0, description: 'Bono clasificados Fase 32' },
  { ruleType: ScoringType.PHASE_BONUS_R16,   points: 8, description: 'Bono clasificados Octavos' },
  { ruleType: ScoringType.PHASE_BONUS_QF,    points: 4, description: 'Bono clasificados Cuartos' },
  { ruleType: ScoringType.PHASE_BONUS_SF,    points: 2, description: 'Bono clasificados Semifinal' },
  { ruleType: ScoringType.PHASE_BONUS_FINAL, points: 5, description: 'Bono Campeón (Final)' },
];

async function main() {
  const rawUrl = process.env.DATABASE_URL!;
  const url = rawUrl.startsWith('mysql://') ? 'mariadb://' + rawUrl.slice('mysql://'.length) : rawUrl;
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) as any });
  await prisma.$connect();

  const leagues = await prisma.league.findMany({ select: { id: true, name: true } });
  console.log(`\n📋 ${leagues.length} ligas encontradas\n`);

  for (const league of leagues) {
    const existing = await prisma.scoringRule.findMany({
      where: { leagueId: league.id },
      select: { ruleType: true },
    });
    const existingTypes = new Set(existing.map((r) => r.ruleType));

    // 1. Eliminar CORRECT_DIFF
    if (existingTypes.has(ScoringType.CORRECT_DIFF)) {
      await prisma.scoringRule.deleteMany({
        where: { leagueId: league.id, ruleType: ScoringType.CORRECT_DIFF },
      });
      console.log(`  ✂️  [${league.name}] CORRECT_DIFF eliminado`);
    }

    // 2. Añadir reglas faltantes
    for (const rule of NEW_RULES) {
      if (!existingTypes.has(rule.ruleType)) {
        await prisma.scoringRule.create({
          data: { leagueId: league.id, ...rule },
        });
        console.log(`  ➕ [${league.name}] ${rule.ruleType} (${rule.points} pts) añadido`);
      }
    }
  }

  console.log('\n✅ Migración completada.\n');
  await prisma.$disconnect();
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
