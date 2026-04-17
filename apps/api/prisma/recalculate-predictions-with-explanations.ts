/**
 * recalculate-predictions-with-explanations.ts
 *
 * Recalcula todas las predicciones de partidos finalizados para agregar
 * el campo 'explanation' al pointDetail.
 *
 * Uso:
 *   # Dry-run (solo ver qué se haría)
 *   npx ts-node -r dotenv/config prisma/recalculate-predictions-with-explanations.ts
 *
 *   # Ejecutar cambios reales
 *   npx ts-node -r dotenv/config prisma/recalculate-predictions-with-explanations.ts --apply
 */

import 'dotenv/config';
import { PrismaClient, Phase, ScoringType } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const DRY_RUN = !process.argv.includes('--apply');

type ScoringRuleLike = {
    ruleType: ScoringType | string;
    points: number;
};

type MatchScoreLike = {
    homeScore: number;
    awayScore: number;
    phase: Phase;
};

type PredictionScoreLike = {
    homeScore: number;
    awayScore: number;
};

type PointType = 'EXACT_SCORE' | 'CORRECT_WINNER_GOAL' | 'CORRECT_WINNER' | 'TEAM_GOALS' | 'NONE';

interface PredictionPointDetail {
    type: PointType;
    exactPoints: number;
    winnerPoints: number;
    goalPoints: number;
    uniqueBonus: number;
    basePoints: number;
    phase: Phase;
    multiplier: number;
    total: number;
    explanation?: string;
}

const DEFAULT_POINTS = {
    EXACT_SCORE:        5,
    CORRECT_WINNER:     2,
    TEAM_GOALS:         1,
    UNIQUE_PREDICTION:  5,
    PHASE_BONUS_R32:    0,
    PHASE_BONUS_R16:    8,
    PHASE_BONUS_QF:     4,
    PHASE_BONUS_SF:     2,
    PHASE_BONUS_FINAL:  5,
} as const;

const KNOCKOUT_PHASE_MULTIPLIER = 1.5;

function getRulePoints(rules: ScoringRuleLike[], ruleType: ScoringType, fallback: number): number {
    return rules.find((rule) => rule.ruleType === ruleType)?.points ?? fallback;
}

function calculatePointsForOne(
    match: MatchScoreLike,
    pred: PredictionScoreLike,
    rules: ScoringRuleLike[],
): { total: number; detail: PredictionPointDetail } {
    const actualHome = match.homeScore;
    const actualAway = match.awayScore;
    const predHome = pred.homeScore;
    const predAway = pred.awayScore;

    const actualWinner = actualHome > actualAway ? 'HOME' : actualHome < actualAway ? 'AWAY' : 'DRAW';
    const predWinner   = predHome  > predAway   ? 'HOME' : predHome  < predAway   ? 'AWAY' : 'DRAW';

    const ruleExact  = getRulePoints(rules, ScoringType.EXACT_SCORE,    DEFAULT_POINTS.EXACT_SCORE);
    const ruleWinner = getRulePoints(rules, ScoringType.CORRECT_WINNER, DEFAULT_POINTS.CORRECT_WINNER);
    const ruleGoal   = getRulePoints(rules, ScoringType.TEAM_GOALS,     DEFAULT_POINTS.TEAM_GOALS);

    let type: PointType = 'NONE';
    let exactPoints  = 0;
    let winnerPoints = 0;
    let goalPoints   = 0;

    if (actualHome === predHome && actualAway === predAway) {
        // Marcador exacto: puntaje plano, no acumulativo
        exactPoints = ruleExact;
        type = 'EXACT_SCORE';
    } else {
        // Ganador acertado (+2 pts)
        if (actualWinner === predWinner) {
            winnerPoints = ruleWinner;
        }
        // Gol acertado: al menos un equipo tiene los goles correctos (+1 pt)
        if (actualHome === predHome || actualAway === predAway) {
            goalPoints = ruleGoal;
        }

        if (winnerPoints > 0 && goalPoints > 0) type = 'CORRECT_WINNER_GOAL';
        else if (winnerPoints > 0) type = 'CORRECT_WINNER';
        else if (goalPoints > 0) type = 'TEAM_GOALS';
    }

    const basePoints = exactPoints > 0 ? exactPoints : (winnerPoints + goalPoints);

    // Multiplicador de fase: grupos x1.0, eliminatorias x1.5
    const phaseMultiplier = match.phase !== Phase.GROUP ? KNOCKOUT_PHASE_MULTIPLIER : 1.0;
    const total = basePoints * phaseMultiplier;

    // Generar explicación legible del cálculo
    let explanation = '';
    if (type === 'EXACT_SCORE') {
        explanation = `Marcador exacto: ${basePoints} pts`;
    } else if (type === 'CORRECT_WINNER_GOAL') {
        explanation = `Ganador (${winnerPoints} pts) + Gol (${goalPoints} pt)`;
    } else if (type === 'CORRECT_WINNER') {
        explanation = `Ganador correcto: ${winnerPoints} pts`;
    } else if (type === 'TEAM_GOALS') {
        explanation = `Gol acertado: ${goalPoints} pt`;
    } else {
        explanation = 'Sin aciertos';
    }

    if (phaseMultiplier !== 1.0) {
        explanation += ` × ${phaseMultiplier} (eliminatoria) = ${total} pts`;
    } else if (basePoints > 0) {
        explanation += ` = ${total} pts`;
    }

    const detail: PredictionPointDetail = {
        type,
        exactPoints,
        winnerPoints,
        goalPoints,
        uniqueBonus: 0,
        basePoints,
        phase: match.phase,
        multiplier: phaseMultiplier,
        total,
        explanation,
    };

    return { total, detail };
}

async function main() {
    console.log('\n🔄 Recálculo de predicciones con explicaciones\n');
    console.log(`Modo: ${DRY_RUN ? '🔍 DRY-RUN (solo vista previa)' : '✅ APPLY (cambios reales)'}\n`);

    const rawUrl = process.env.DATABASE_URL!;
    const url = rawUrl.startsWith('mysql://') ? 'mariadb://' + rawUrl.slice('mysql://'.length) : rawUrl;
    const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) as any });

    try {
        await prisma.$connect();

        // 1. Obtener todas las predicciones de partidos finalizados
        const predictions = await prisma.prediction.findMany({
            where: {
                match: {
                    status: 'FINISHED',
                    homeScore: { not: null },
                    awayScore: { not: null },
                },
            },
            include: {
                match: {
                    include: {
                        homeTeam: { select: { name: true } },
                        awayTeam: { select: { name: true } },
                    },
                },
                league: {
                    include: {
                        scoringRules: {
                            where: { active: true },
                        },
                    },
                },
                user: {
                    select: { username: true },
                },
            },
            orderBy: { submittedAt: 'asc' },
        });

        console.log(`📊 Total de predicciones en partidos finalizados: ${predictions.length}\n`);

        if (predictions.length === 0) {
            console.log('✅ No hay predicciones para recalcular.');
            return;
        }

        // 2. Agrupar por partido para detectar bonos únicos
        const byMatch = new Map<string, typeof predictions>();
        for (const pred of predictions) {
            const arr = byMatch.get(pred.matchId) ?? [];
            arr.push(pred);
            byMatch.set(pred.matchId, arr);
        }

        let updated = 0;
        let withExplanation = 0;
        let withUniqueBonus = 0;
        const updateBatch: Array<{ id: string; points: number; pointDetail: string }> = [];

        // 3. Recalcular puntos con explicaciones
        for (const [matchId, matchPreds] of byMatch.entries()) {
            const firstPred = matchPreds[0];
            const match = firstPred.match;

            if (match.homeScore === null || match.awayScore === null) continue;

            const matchForScoring: MatchScoreLike = {
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                phase: match.phase,
            };

            // Recalcular puntos base para cada predicción
            const scored = matchPreds.map((pred) => ({
                pred,
                result: calculatePointsForOne(matchForScoring, pred, pred.league.scoringRules),
            }));

            // Detectar y aplicar bono único por liga
            const byLeague = new Map<string, typeof scored>();
            for (const item of scored) {
                const arr = byLeague.get(item.pred.leagueId) ?? [];
                arr.push(item);
                byLeague.set(item.pred.leagueId, arr);
            }

            for (const leaguePreds of byLeague.values()) {
                const exactPreds = leaguePreds.filter(({ result }) => result.detail.type === 'EXACT_SCORE');
                if (exactPreds.length !== 1) continue;

                const { pred, result } = exactPreds[0];
                const uniqueBonus = getRulePoints(
                    pred.league.scoringRules,
                    ScoringType.UNIQUE_PREDICTION,
                    DEFAULT_POINTS.UNIQUE_PREDICTION,
                );

                if (uniqueBonus > 0) {
                    const newTotal = result.total + uniqueBonus;
                    result.detail.uniqueBonus = uniqueBonus;
                    result.detail.total = newTotal;

                    // Agregar el bono único a la explicación
                    if (result.detail.explanation) {
                        result.detail.explanation = result.detail.explanation.replace(
                            / = ([\d.]+) pts$/,
                            ` + Única (${uniqueBonus} pts) = ${newTotal} pts`,
                        );
                    }
                    result.total = newTotal;
                }
            }

            // Actualizar predicciones
            for (const { pred, result } of scored) {
                const currentDetail = pred.pointDetail ? JSON.parse(pred.pointDetail) : null;
                const hasExplanation = currentDetail?.explanation;

                if (!hasExplanation) {
                    withExplanation++;
                }

                if (result.detail.uniqueBonus > 0) {
                    withUniqueBonus++;
                }

                if (DRY_RUN) {
                    if (updated < 5) {
                        console.log(`[Preview] ${pred.user.username} - ${match.homeTeam.name} vs ${match.awayTeam.name}`);
                        console.log(`  Antes: ${pred.points ?? 0} pts${hasExplanation ? ' (ya tiene explicación)' : ''}`);
                        console.log(`  Después: ${result.total} pts - "${result.detail.explanation}"`);
                        console.log();
                    }
                } else {
                    // Agregar al batch en lugar de actualizar inmediatamente
                    updateBatch.push({
                        id: pred.id,
                        points: result.total,
                        pointDetail: JSON.stringify(result.detail),
                    });
                }

                updated++;
            }
        }

        // 4. Ejecutar updates secuencialmente con progreso
        if (!DRY_RUN && updateBatch.length > 0) {
            console.log(`\n🔄 Actualizando ${updateBatch.length} predicciones...\n`);
            for (let i = 0; i < updateBatch.length; i++) {
                const item = updateBatch[i];
                await prisma.prediction.update({
                    where: { id: item.id },
                    data: {
                        points: item.points,
                        pointDetail: item.pointDetail,
                    },
                });

                // Mostrar progreso cada 100 registros
                if ((i + 1) % 100 === 0 || i === updateBatch.length - 1) {
                    process.stdout.write(`\r   Procesadas: ${i + 1}/${updateBatch.length}`);
                }
            }
            console.log('\n');
        }

        console.log(`\n📈 Resumen:\n`);
        console.log(`   Total procesadas: ${updated}`);
        console.log(`   Sin explicación (antes): ${withExplanation}`);
        console.log(`   Con bono único: ${withUniqueBonus}`);

        if (DRY_RUN) {
            console.log(`\n⚠️  Esto fue un DRY-RUN. Para aplicar cambios ejecuta:`);
            console.log(`   npx ts-node -r dotenv/config prisma/recalculate-predictions-with-explanations.ts --apply\n`);
        } else {
            console.log(`\n✅ Predicciones actualizadas con explicaciones.\n`);
        }
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
