/**
 * test_both_report_emails.ts
 * Envía el correo ANTES del partido (pronósticos) y DESPUÉS (resultados con puntos).
 * Ejecutar: npx ts-node -r dotenv/config prisma/test_both_report_emails.ts [email]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  PredictionReportEmailService,
  ResultOutcome,
} from '../src/prediction-report/prediction-report-email.service';

/* ── Lógica de puntuación (igual que PredictionsService) ──────────────────── */
function calcOutcome(
  predHome: number, predAway: number,
  realHome: number, realAway: number,
): { outcome: ResultOutcome; points: number } {
  if (predHome === realHome && predAway === realAway)
    return { outcome: 'EXACT', points: 5 };
  const predWinner = predHome > predAway ? 'H' : predHome < predAway ? 'A' : 'D';
  const realWinner = realHome > realAway ? 'H' : realHome < realAway ? 'A' : 'D';
  const homeGoal = predHome === realHome;
  const awayGoal = predAway === realAway;
  if (predWinner === realWinner && (homeGoal || awayGoal))
    return { outcome: 'WINNER_GOAL', points: 3 };
  if (predWinner === realWinner)
    return { outcome: 'WINNER', points: 2 };
  if (homeGoal || awayGoal)
    return { outcome: 'GOAL', points: 1 };
  return { outcome: 'WRONG', points: 0 };
}

async function main() {
  const testEmail = process.argv[2] || process.env.EMAIL_FROM || '';
  if (!testEmail) { console.error('Pasa email destino como argumento'); process.exit(1); }

  const rawUrl = process.env.DATABASE_URL!;
  const url    = rawUrl.startsWith('mysql://') ? 'mariadb://' + rawUrl.slice('mysql://'.length) : rawUrl;
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) as any });
  await prisma.$connect();

  // Partido terminado con scores y predicciones con puntos
  const match = await prisma.match.findFirst({
    where: { status: 'FINISHED', homeScore: { not: null }, predictions: { some: { points: { not: null } } } },
    include: {
      homeTeam: true,
      awayTeam: true,
      predictions: {
        where:   { points: { not: null } },
        include: { user: { select: { id: true, name: true } } },
        take:    20,
        orderBy: { submittedAt: 'asc' },
      },
    },
    orderBy: { matchDate: 'desc' },
  });

  if (!match) { console.error('No hay partidos FINISHED con predicciones con puntos'); process.exit(1); }

  const leagueId = match.predictions[0]?.leagueId;
  const league   = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
    select: { name: true, code: true },
  });
  const members  = await prisma.leagueMember.findMany({
    where: { leagueId },
    select: { userId: true, role: true },
  });

  // Standings ANTES de este partido (puntos acumulados de otros partidos)
  const allPreds = await prisma.prediction.findMany({
    where: { leagueId, points: { not: null }, matchId: { not: match.id } },
    select: { userId: true, points: true },
  });
  const prevTotals = new Map<string, number>();
  for (const p of allPreds) prevTotals.set(p.userId, (prevTotals.get(p.userId) ?? 0) + (p.points ?? 0));

  // Standings DESPUÉS (incluyendo este partido)
  const thisMatchPreds = await prisma.prediction.findMany({
    where: { leagueId, matchId: match.id, points: { not: null } },
    select: { userId: true, points: true },
  });
  const afterTotals = new Map<string, number>(prevTotals);
  for (const p of thisMatchPreds) afterTotals.set(p.userId, (afterTotals.get(p.userId) ?? 0) + (p.points ?? 0));

  const sortedPrev  = [...prevTotals.entries()].sort((a,b) => b[1]-a[1]);
  const sortedAfter = [...afterTotals.entries()].sort((a,b) => b[1]-a[1]);
  const prevStandings  = new Map(sortedPrev.map(([uid,pts],i)  => [uid, { points: pts,  position: i+1 }]));
  const afterStandings = new Map(sortedAfter.map(([uid,pts],i) => [uid, { points: pts,  position: i+1 }]));

  const predictors = match.predictions.map(p => {
    const member = members.find(m => m.userId === p.userId);
    return {
      userId:      p.userId,
      name:        p.user.name,
      isAdmin:     member?.role === 'ADMIN',
      homeScore:   p.homeScore,
      awayScore:   p.awayScore,
      submittedAt: p.submittedAt,
    };
  });

  const realHome = match.homeScore!;
  const realAway = match.awayScore!;

  const results = predictors.map(p => {
    const { outcome, points } = calcOutcome(p.homeScore, p.awayScore, realHome, realAway);
    return {
      ...p,
      outcome,
      pointsEarned: points,
      prevPosition: prevStandings.get(p.userId)?.position ?? 99,
      newPosition:  afterStandings.get(p.userId)?.position ?? 99,
    };
  });

  // Mock EmailQueueService para testing
  const mockEmailQueue = {
    enqueueEmail: async () => ({ success: true }),
  } as any;
  
  const emailSvc = new PredictionReportEmailService(mockEmailQueue);
  const matchInfo = {
    homeTeam:  match.homeTeam.name,
    awayTeam:  match.awayTeam.name,
    matchDate: match.matchDate,
    venue:     match.venue ?? undefined,
    round:     match.round ?? undefined,
  };

  console.log(`\n🏟  Partido: ${match.homeTeam.name} ${realHome}-${realAway} ${match.awayTeam.name}`);
  console.log(`📋  Liga: ${league.name} | ${predictors.length} pronósticos`);
  console.log(`📧  Destino: ${testEmail}\n`);

  // ── CORREO 1: ANTES (ventana cerrada, pronósticos revelados) ──────────────
  console.log('📤 Enviando correo ANTES del partido...');
  await emailSvc.sendPredictionsReport({
    recipients: [testEmail],
    leagueName: league.name,
    leagueCode: league.code,
    match:      matchInfo,
    predictors,
    standings:  prevStandings,
    sentAt:     new Date(match.matchDate.getTime() - 15 * 60_000), // 15 min antes
  });
  console.log('   ✅ Enviado\n');

  // Pequeña pausa para que lleguen en orden
  await new Promise(r => setTimeout(r, 3000));

  // ── CORREO 2: DESPUÉS (resultados y puntos) ───────────────────────────────
  console.log('📤 Enviando correo DESPUÉS del partido...');
  await emailSvc.sendResultsReport({
    recipients: [testEmail],
    leagueName: league.name,
    leagueCode: league.code,
    match:      { ...matchInfo, homeScore: realHome, awayScore: realAway },
    results,
    sentAt:     new Date(),
  });
  console.log('   ✅ Enviado\n');

  console.log('✅ Ambos correos enviados. Revisa tu bandeja de entrada.\n');
  await prisma.$disconnect();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
