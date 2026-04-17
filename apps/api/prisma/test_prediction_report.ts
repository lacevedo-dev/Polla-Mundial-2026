/**
 * test_prediction_report.ts — Envía un correo de prueba del reporte de predicciones
 * Ejecutar: npx ts-node -r dotenv/config prisma/test_prediction_report.ts [email_destino]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PredictionReportEmailService } from '../src/prediction-report/prediction-report-email.service';

async function main() {
  const testEmail = process.argv[2] || process.env.EMAIL_FROM || '';
  if (!testEmail) { console.error('Pasa el email destino como argumento'); process.exit(1); }

  const rawUrl = process.env.DATABASE_URL!;
  const url    = rawUrl.startsWith('mysql://') ? 'mariadb://' + rawUrl.slice('mysql://'.length) : rawUrl;
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) as any });
  await prisma.$connect();

  // Buscar un match con predicciones
  const match = await prisma.match.findFirst({
    where:   { predictions: { some: {} } },
    include: { homeTeam: true, awayTeam: true, predictions: { include: { user: true }, take: 20 } },
    orderBy: { matchDate: 'asc' },
  });

  if (!match) { console.error('No hay partidos con predicciones'); process.exit(1); }

  // Buscar la liga del primer pronóstico
  const leagueId = match.predictions[0]?.leagueId;
  const league   = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
    select: { name: true, code: true },
  });

  const members = await prisma.leagueMember.findMany({
    where: { leagueId },
    select: { userId: true, role: true },
  });

  // Calcular standings
  const allPreds = await prisma.prediction.findMany({
    where: { leagueId, points: { not: null } },
    select: { userId: true, points: true },
  });
  const totals = new Map<string, number>();
  for (const p of allPreds) totals.set(p.userId, (totals.get(p.userId) ?? 0) + (p.points ?? 0));
  const sorted  = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const standings = new Map(sorted.map(([uid, pts], i) => [uid, { points: pts, position: i + 1 }]));

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

  // Mock EmailQueueService para testing
  const mockEmailQueue = {
    enqueueEmail: async () => ({ success: true }),
  } as any;
  
  const emailSvc = new PredictionReportEmailService(mockEmailQueue);

  console.log(`\n📧 Enviando reporte de prueba a: ${testEmail}`);
  console.log(`   Partido: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
  console.log(`   Liga: ${league.name} (${league.code})`);
  console.log(`   Pronósticos: ${predictors.length}\n`);

  await emailSvc.sendPredictionsReport({
    recipients:  [testEmail],
    leagueName:  league.name,
    leagueCode:  league.code,
    match: {
      homeTeam:  match.homeTeam.name,
      awayTeam:  match.awayTeam.name,
      matchDate: match.matchDate,
      venue:     match.venue ?? undefined,
      round:     match.round ?? undefined,
    },
    predictors,
    standings,
    sentAt: new Date(),
  });

  console.log('✅ Correo enviado correctamente\n');
  await prisma.$disconnect();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
