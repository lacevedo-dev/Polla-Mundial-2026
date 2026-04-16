/**
 * seed_prueba_completo.ts — Entorno de prueba COMPLETO v2
 *
 * Crea / actualiza:
 *   - 25 usuarios con perfiles y planes variados
 *   - 3 ligas con configuraciones distintas (pública, privada, premium)
 *   - 6 partidos amistosos: 3 FINALIZADOS (15-17 mar) + 3 PROGRAMADOS (25-27 mar)
 *   - Pronósticos con distintos niveles de acierto (para ver ranking real)
 *   - Todos los estados de pago: CONFIRMED / REVIEW / REJECTED / PENDING
 *   - Todos los estados de membresía: ACTIVE / PENDING_PAYMENT / BANNED / REJECTED
 *   - Stage fees, reglas de puntuación, distribución de premios
 *   - Invitaciones pendientes
 *
 * Ejecutar:
 *   npx ts-node -r dotenv/config prisma/seed_prueba_completo.ts
 *
 * ─── CONTRASEÑAS ──────────────────────────────────────────────────────────────
 *   Superadmin  →  Super2026
 *   Admins      →  Admin2026
 *   Jugadores   →  Jugador2026
 * ──────────────────────────────────────────────────────────────────────────────
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';

// ─── CONTRASEÑAS ──────────────────────────────────────────────────────────────
const PASS_SUPER  = 'Super2026';
const PASS_ADMIN  = 'Admin2026';
const PASS_PLAYER = 'Jugador2026';

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
const USERS = [
  // ── Superadmin del sistema ──────────────────────────────────────────────────
  {
    username: 'prueba_superadmin',
    name: 'Súper Admin Sistema',
    email: 'super@prueba.com',
    phone: '3000000000', cc: '+57',
    plan: 'DIAMOND', systemRole: 'SUPERADMIN',
    pass: PASS_SUPER,
    leagues: [],
    tag: '🔵 SUPERADMIN',
  },
  // ── Admins de liga ──────────────────────────────────────────────────────────
  {
    username: 'prueba_admin1',
    name: 'Carlos Rodríguez — Admin Liga 1',
    email: 'admin1@prueba.com',
    phone: '3001000001', cc: '+57',
    plan: 'GOLD', systemRole: 'USER',
    pass: PASS_ADMIN,
    leagues: ['L1:ADMIN:ACTIVE:paid-cash'],
    tag: '🟠 ADMIN L1',
  },
  {
    username: 'prueba_admin2',
    name: 'Sofía Herrera — Admin Liga 2',
    email: 'admin2@prueba.com',
    phone: '3001000002', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_ADMIN,
    leagues: ['L2:ADMIN:ACTIVE:paid-transfer'],
    tag: '🟠 ADMIN L2',
  },
  {
    username: 'prueba_admin3',
    name: 'Mauricio Díaz — Admin Liga 3',
    email: 'admin3@prueba.com',
    phone: '3001000003', cc: '+57',
    plan: 'DIAMOND', systemRole: 'USER',
    pass: PASS_ADMIN,
    leagues: ['L3:ADMIN:ACTIVE:paid-bancolombia'],
    tag: '🟠 ADMIN L3',
  },
  // ── Jugadores activos con cuota pagada ──────────────────────────────────────
  {
    username: 'prueba_gold1',
    name: 'María González — Gold',
    email: 'gold1@prueba.com',
    phone: '3001000004', cc: '+57',
    plan: 'GOLD', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:ACTIVE:paid-nequi', 'L3:PLAYER:ACTIVE:paid-nequi'],
    tag: '🟢 ACTIVO Gold',
  },
  {
    username: 'prueba_gold2',
    name: 'Andrés Martínez — Gold',
    email: 'gold2@prueba.com',
    phone: '3001000005', cc: '+57',
    plan: 'GOLD', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:ACTIVE:paid-transfer'],
    tag: '🟢 ACTIVO Gold',
  },
  {
    username: 'prueba_free1',
    name: 'Laura Pérez — Free',
    email: 'free1@prueba.com',
    phone: '3001000006', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:ACTIVE:paid-daviplata', 'L2:PLAYER:ACTIVE:paid-cash'],
    tag: '🟢 ACTIVO Free',
  },
  {
    username: 'prueba_free2',
    name: 'Felipe Torres — Free',
    email: 'free2@prueba.com',
    phone: '3001000007', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:ACTIVE:paid-cash'],
    tag: '🟢 ACTIVO Free',
  },
  {
    username: 'prueba_free3',
    name: 'Valentina Ruiz — Free',
    email: 'free3@prueba.com',
    phone: '3001000008', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:ACTIVE:paid-cash'],
    tag: '🟢 ACTIVO Free',
  },
  {
    username: 'prueba_diamond1',
    name: 'Ricardo Lara — Diamond',
    email: 'diamond1@prueba.com',
    phone: '3001000009', cc: '+57',
    plan: 'DIAMOND', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:ACTIVE:paid-gateway', 'L3:PLAYER:ACTIVE:paid-gateway'],
    tag: '🟢 ACTIVO Diamond',
  },
  // ── Multi-liga ─────────────────────────────────────────────────────────────
  {
    username: 'prueba_multiliga',
    name: 'Camila Vargas — Multi-liga',
    email: 'multiliga@prueba.com',
    phone: '3001000010', cc: '+57',
    plan: 'GOLD', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:ACTIVE:paid-nequi', 'L2:PLAYER:ACTIVE:paid-cash', 'L3:PLAYER:ACTIVE:paid-transfer'],
    tag: '🟢 ACTIVO 3 ligas',
  },
  {
    username: 'prueba_premium',
    name: 'Santiago López — Premium',
    email: 'premium@prueba.com',
    phone: '3001000011', cc: '+57',
    plan: 'DIAMOND', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:ACTIVE:paid-bancolombia', 'L2:PLAYER:ACTIVE:paid-bancolombia', 'L3:PLAYER:ACTIVE:paid-bancolombia'],
    tag: '🟢 ACTIVO Diamond 3 ligas',
  },
  // ── Pago en revisión ────────────────────────────────────────────────────────
  {
    username: 'prueba_revision',
    name: 'Juliana Mora — Pago en Revisión',
    email: 'revision@prueba.com',
    phone: '3001000012', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:PENDING_PAYMENT:review'],
    tag: '🟡 PAGO EN REVISIÓN',
  },
  // ── Pago rechazado ──────────────────────────────────────────────────────────
  {
    username: 'prueba_rechazado',
    name: 'David Ospina — Pago Rechazado',
    email: 'rechazado@prueba.com',
    phone: '3001000013', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:PENDING_PAYMENT:rejected'],
    tag: '🔴 PAGO RECHAZADO',
  },
  // ── Sin pago ────────────────────────────────────────────────────────────────
  {
    username: 'prueba_sinpago1',
    name: 'Luisa Fernanda — Sin Pago',
    email: 'sinpago1@prueba.com',
    phone: '3001000014', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:PENDING_PAYMENT:pending'],
    tag: '🟡 PENDIENTE de pago',
  },
  {
    username: 'prueba_sinpago2',
    name: 'Mateo García — Sin Pago',
    email: 'sinpago2@prueba.com',
    phone: '3001000015', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:PENDING_PAYMENT:pending', 'L2:PLAYER:PENDING_PAYMENT:pending'],
    tag: '🟡 PENDIENTE de pago',
  },
  {
    username: 'prueba_sinpago3',
    name: 'Isabella Ramírez — Sin Pago',
    email: 'sinpago3@prueba.com',
    phone: '3001000016', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L2:PLAYER:PENDING_PAYMENT:pending'],
    tag: '🟡 PENDIENTE de pago',
  },
  // ── Recién unido ────────────────────────────────────────────────────────────
  {
    username: 'prueba_nuevo',
    name: 'Nicolás Soto — Recién Unido',
    email: 'nuevo@prueba.com',
    phone: '3001000017', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:PENDING_PAYMENT:pending'],
    tag: '🟡 NUEVO (sin pago)',
  },
  // ── Parcial (pocos pronósticos) ─────────────────────────────────────────────
  {
    username: 'prueba_parcial',
    name: 'Paola Restrepo — Parcial',
    email: 'parcial@prueba.com',
    phone: '3001000018', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:ACTIVE:paid-cash'],
    tag: '🟢 ACTIVO (pronósticos parciales)',
  },
  // ── Sin pronósticos ─────────────────────────────────────────────────────────
  {
    username: 'prueba_casual',
    name: 'Juan Pablo Ríos — Casual',
    email: 'casual@prueba.com',
    phone: '3001000019', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:ACTIVE:paid-cash'],
    tag: '🟢 ACTIVO (sin pronósticos)',
  },
  // ── Baneado ─────────────────────────────────────────────────────────────────
  {
    username: 'prueba_baneado',
    name: 'Esteban Cruz — Baneado',
    email: 'baneado@prueba.com',
    phone: '3001000020', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:BANNED:pending'],
    tag: '🔴 BANEADO',
  },
  // ── Rechazado de la liga ────────────────────────────────────────────────────
  {
    username: 'prueba_rejected',
    name: 'Andrea Niño — Rechazado de Liga',
    email: 'rejected@prueba.com',
    phone: '3001000021', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L1:PLAYER:REJECTED:pending'],
    tag: '🔴 RECHAZADO de liga',
  },
  // ── Invitado Liga 2 ─────────────────────────────────────────────────────────
  {
    username: 'prueba_invitado',
    name: 'Gabriela Silva — Invitada',
    email: 'invitado@prueba.com',
    phone: '3001000022', cc: '+57',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L2:PLAYER:ACTIVE:paid-nequi'],
    tag: '🟢 ACTIVO (vía invitación)',
  },
  // ── Internacional (México) ──────────────────────────────────────────────────
  {
    username: 'prueba_mexico',
    name: 'Diego Hernández — México',
    email: 'mexico@prueba.com',
    phone: '5512345678', cc: '+52',
    plan: 'FREE', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L3:PLAYER:ACTIVE:paid-cash'],
    tag: '🟢 ACTIVO (MX)',
  },
  // ── Internacional (Argentina) ───────────────────────────────────────────────
  {
    username: 'prueba_argentina',
    name: 'Florencia Castro — Argentina',
    email: 'argentina@prueba.com',
    phone: '1112345678', cc: '+54',
    plan: 'GOLD', systemRole: 'USER',
    pass: PASS_PLAYER,
    leagues: ['L3:PLAYER:ACTIVE:paid-transfer'],
    tag: '🟢 ACTIVO (AR)',
  },
] as const;

// ─── LIGAS ────────────────────────────────────────────────────────────────────
const LEAGUES_DEF = [
  {
    key: 'L1',
    code: 'PRUEBA-L1',
    name: 'Liga Test Mundial 2026',
    description: 'Liga pública de prueba — plan GOLD — cuota 50,000 COP',
    privacy: 'PUBLIC',
    plan: 'GOLD',
    baseFee: 50000,
    currency: 'COP',
    adminFeePercent: 10,
    maxParticipants: 25,
    includeStageFees: true,
  },
  {
    key: 'L2',
    code: 'PRUEBA-L2',
    name: 'Polla Privada Amigos',
    description: 'Liga privada entre amigos — plan FREE — cuota 30,000 COP',
    privacy: 'PRIVATE',
    plan: 'FREE',
    baseFee: 30000,
    currency: 'COP',
    adminFeePercent: 0,
    maxParticipants: 10,
    includeStageFees: false,
  },
  {
    key: 'L3',
    code: 'PRUEBA-L3',
    name: 'Champions Premium Club',
    description: 'Liga premium DIAMOND — cuota 100,000 COP — premios altos',
    privacy: 'PUBLIC',
    plan: 'DIAMOND',
    baseFee: 100000,
    currency: 'COP',
    adminFeePercent: 15,
    maxParticipants: 20,
    includeStageFees: true,
  },
] as const;

// Resultados de los partidos ya finalizados (para calcular puntos)
// [homeScore, awayScore]
const FINISHED_RESULTS = {
  'COL-BRA': [2, 1] as [number, number],  // Colombia gana de local
  'ESP-ARG': [1, 1] as [number, number],  // Empate
  'FRA-POR': [3, 0] as [number, number],  // Francia aplasta
};

// Pronósticos por usuario — [COL-BRA, ESP-ARG, FRA-POR, COL-ARG, BRA-ESP, FRA-GER]
// null = no pronosticó ese partido
type Pred = [number, number] | null;
const PREDICTIONS: Record<string, Pred[]> = {
  // Finalizados                        COL-BRA  ESP-ARG  FRA-POR  // Programados COL-ARG  BRA-ESP  FRA-GER
  prueba_admin1:    [[2,1],  [1,1],  [3,0],   [2,1],  [2,2],  [1,1]],  // Perfecto: 15 pts
  prueba_gold1:     [[1,0],  [2,2],  [2,0],   [1,0],  [3,2],  [1,0]],  // Winner: ~6 pts
  prueba_gold2:     [[2,1],  [0,0],  [3,0],   [2,0],  [2,1],  [2,0]],  // Exacto+emp: ~12 pts
  prueba_free1:     [[1,0],  [1,0],  [1,0],   [1,0],  [2,0],  [1,0]],  // Local wins: ~4 pts
  prueba_free2:     [[2,1],  [1,1],  [2,1],   [2,1],  [3,1],  [2,0]],  // Exacto+winner: ~12 pts
  prueba_free3:     [[0,0],  [0,1],  [0,2],   [0,1],  [1,2],  [0,2]],  // Todo mal: 0 pts
  prueba_diamond1:  [[3,1],  [2,0],  [3,0],   [2,0],  [3,0],  [2,1]],  // Exacto parcial: ~7 pts
  prueba_multiliga: [[2,1],  [0,0],  [2,0],   [2,1],  [2,1],  [1,1]],  // Mixto: ~9 pts
  prueba_premium:   [[2,1],  [1,1],  [3,0],   [2,1],  [3,2],  [1,1]],  // Perfecto: 15 pts
  prueba_parcial:   [[2,1],  null,   null,    [1,0],  null,   null],   // Solo 2
  prueba_casual:    [null,   null,   null,    null,   null,   null],   // Sin pronósticos
  prueba_revision:  [[1,0],  [1,1],  [2,0],   null,   null,   null],
  prueba_rechazado: [[1,1],  [2,1],  [1,0],   null,   null,   null],
  prueba_sinpago1:  [[0,1],  [0,1],  [1,2],   null,   null,   null],
  prueba_sinpago2:  [[2,0],  [1,1],  [2,1],   null,   null,   null],
  prueba_invitado:  [[1,1],  [1,1],  [1,1],   null,   null,   null],
  prueba_mexico:    [[0,0],  [1,0],  [2,1],   null,   null,   null],
  prueba_argentina: [[2,1],  [1,0],  [3,0],   null,   null,   null],
  prueba_nuevo:     [[1,0],  null,   null,    null,   null,   null],
};

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🧪 Iniciando seed COMPLETO v2...\n');

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL no encontrado en .env');
  const connectionUrl = rawUrl.startsWith('mysql://')
    ? `mariadb://${rawUrl.slice('mysql://'.length)}`
    : rawUrl;

  const adapter = new PrismaMariaDb(connectionUrl);
  const prisma = new PrismaClient({ adapter: adapter as any });
  await prisma.$connect();

  try {
    // ── 1. HASH DE CONTRASEÑAS ─────────────────────────────────────────────
    console.log('🔑 Generando hashes de contraseñas...');
    const hashSuper  = await bcrypt.hash(PASS_SUPER, 10);
    const hashAdmin  = await bcrypt.hash(PASS_ADMIN, 10);
    const hashPlayer = await bcrypt.hash(PASS_PLAYER, 10);
    const passMap: Record<string, string> = {
      [PASS_SUPER]:  hashSuper,
      [PASS_ADMIN]:  hashAdmin,
      [PASS_PLAYER]: hashPlayer,
    };
    console.log('  ✓ Hashes listos\n');

    // ── 2. CREAR USUARIOS ─────────────────────────────────────────────────
    console.log('👤 Creando 25 usuarios...');
    const userIds: Record<string, string> = {};

    for (const u of USERS) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        create: {
          name: u.name,
          email: u.email,
          username: u.username,
          phone: u.phone,
          countryCode: u.cc,
          passwordHash: passMap[u.pass],
          plan: u.plan as any,
          systemRole: u.systemRole as any,
          emailVerified: true,
        },
        update: {
          name: u.name,
          plan: u.plan as any,
          systemRole: u.systemRole as any,
          emailVerified: true,
        },
      });
      userIds[u.username] = user.id;
      console.log(`  ✓ ${u.username.padEnd(22)} ${u.tag}`);
    }

    // ── 3. BUSCAR TORNEO ──────────────────────────────────────────────────
    console.log('\n🏆 Buscando torneo importado...');
    const tournament = await prisma.tournament.findFirst({
      where: { OR: [{ name: { contains: 'World Cup' } }, { name: { contains: 'Mundial' } }, { name: { contains: 'FIFA' } }] },
      orderBy: { season: 'desc' },
    });
    console.log(tournament
      ? `  ✓ Encontrado: "${tournament.name}"`
      : '  ⚠ Sin torneo importado (normal si aún no se sincronizó la API)');

    // ── 4. CREAR LIGAS ────────────────────────────────────────────────────
    console.log('\n⚽ Creando 3 ligas...');
    const leagueIds: Record<string, string> = {};
    const leagueFees: Record<string, number> = {};

    for (const ld of LEAGUES_DEF) {
      const league = await prisma.league.upsert({
        where: { code: ld.code },
        create: {
          name: ld.name,
          description: ld.description,
          code: ld.code,
          privacy: ld.privacy as any,
          maxParticipants: ld.maxParticipants,
          includeBaseFee: true,
          baseFee: ld.baseFee,
          includeStageFees: ld.includeStageFees,
          currency: ld.currency as any,
          adminFeePercent: ld.adminFeePercent,
          plan: ld.plan as any,
          status: 'ACTIVE',
          closePredictionMinutes: 15,
          primaryTournamentId: tournament?.id ?? null,
        },
        update: { status: 'ACTIVE', primaryTournamentId: tournament?.id ?? null },
      });
      leagueIds[ld.key] = league.id;
      leagueFees[ld.key] = ld.baseFee;

      // Vincular torneo
      if (tournament) {
        await prisma.leagueTournament.upsert({
          where: { leagueId_tournamentId: { leagueId: league.id, tournamentId: tournament.id } },
          create: { leagueId: league.id, tournamentId: tournament.id },
          update: {},
        });
      }

      // Reglas de puntuación
      const scoringRules = [
        { ruleType: 'EXACT_SCORE',    points: 5, description: 'Marcador exacto' },
        { ruleType: 'CORRECT_DIFF',   points: 3, description: 'Diferencia correcta' },
        { ruleType: 'CORRECT_WINNER', points: 2, description: 'Ganador correcto' },
      ];
      for (const sr of scoringRules) {
        const existsSr = await prisma.scoringRule.findFirst({
          where: { leagueId: league.id, ruleType: sr.ruleType as any, appliesToPhase: null },
        });
        if (!existsSr) {
          await prisma.scoringRule.create({
            data: { leagueId: league.id, ruleType: sr.ruleType as any, points: sr.points, description: sr.description, active: true },
          });
        } else {
          await prisma.scoringRule.update({ where: { id: existsSr.id }, data: { points: sr.points } });
        }
      }

      // Distribución de premios
      const prizes = [
        { position: 1, label: '1° PUESTO', percentage: 60 },
        { position: 2, label: '2° PUESTO', percentage: 30 },
        { position: 3, label: '3° PUESTO', percentage: 10 },
      ];
      for (const p of prizes) {
        await prisma.prizeDistribution.upsert({
          where: { leagueId_category_position: { leagueId: league.id, category: 'GENERAL', position: p.position } },
          create: { leagueId: league.id, category: 'GENERAL', position: p.position, label: p.label, percentage: p.percentage, active: true },
          update: { percentage: p.percentage },
        });
      }

      // Stage fees para ligas que los tienen
      if (ld.includeStageFees) {
        const stageFees = [
          { type: 'MATCH', label: 'Cuota por partido', amount: Math.round(ld.baseFee * 0.1) },
          { type: 'ROUND', label: 'Cuota por ronda',   amount: Math.round(ld.baseFee * 0.3) },
          { type: 'PHASE', label: 'Cuota por fase',    amount: Math.round(ld.baseFee * 0.5) },
        ];
        for (const sf of stageFees) {
          await prisma.stageFee.upsert({
            where: { leagueId_type_label: { leagueId: league.id, type: sf.type as any, label: sf.label } },
            create: { leagueId: league.id, type: sf.type as any, label: sf.label, amount: sf.amount, active: true },
            update: { amount: sf.amount },
          });
        }
      }

      console.log(`  ✓ [${ld.key}] ${ld.name} (${ld.code}) — ${ld.plan} — ${ld.baseFee.toLocaleString()} COP`);
    }

    // ── 5. MIEMBROS + PAGOS ───────────────────────────────────────────────
    console.log('\n👥 Agregando miembros y pagos...');
    const deadline = new Date('2026-05-31T23:59:59Z');

    // Mapa de método de pago por tag
    const methodMap: Record<string, string> = {
      'paid-cash':       'CASH',
      'paid-nequi':      'NEQUI',
      'paid-transfer':   'TRANSFER',
      'paid-daviplata':  'DAVIPLATA',
      'paid-bancolombia':'BANCOLOMBIA',
      'paid-gateway':    'GATEWAY',
      'review':          'TRANSFER',
      'rejected':        'NEQUI',
      'pending':         '',
    };

    for (const u of USERS) {
      const userId = userIds[u.username];

      for (const leagueEntry of u.leagues) {
        const [lKey, role, memStatus, payTag] = leagueEntry.split(':');
        const leagueId = leagueIds[lKey];
        if (!leagueId) continue;

        // Crear membresía
        await prisma.leagueMember.upsert({
          where: { userId_leagueId: { userId, leagueId } },
          create: { userId, leagueId, role: role as any, status: memStatus as any },
          update: { role: role as any, status: memStatus as any },
        });

        // Crear obligación de cuota base
        const isPaid     = payTag.startsWith('paid-');
        const isReview   = payTag === 'review';
        const isRejected = payTag === 'rejected';
        const obligStatus = isPaid ? 'PAID' : 'PENDING_PAYMENT';

        const existingObl = await prisma.participationObligation.findFirst({
          where: { userId, leagueId, category: 'PRINCIPAL' },
        });

        let obligId = existingObl?.id;
        if (!existingObl) {
          const obl = await prisma.participationObligation.create({
            data: {
              userId, leagueId,
              category: 'PRINCIPAL',
              referenceLabel: `Cuota base ${LEAGUES_DEF.find(l => l.key === lKey)?.name}`,
              source: 'INVITATION',
              unitAmount: leagueFees[lKey],
              multiplier: 1,
              totalAmount: leagueFees[lKey],
              currency: 'COP',
              status: obligStatus as any,
              deadlineAt: deadline,
              paidAt: isPaid ? new Date() : null,
            },
          });
          obligId = obl.id;
        }

        // Crear registro de pago según escenario
        if (isPaid) {
          const existPay = await prisma.payment.findFirst({ where: { userId, leagueId, conceptId: obligId } });
          if (!existPay) {
            await prisma.payment.create({
              data: {
                userId, leagueId,
                conceptId: obligId,
                conceptType: 'PRINCIPAL',
                amount: leagueFees[lKey],
                method: methodMap[payTag] as any,
                status: 'CONFIRMED',
                note: `Pago seed — ${u.username}`,
              },
            });
          }
        } else if (isReview) {
          // Envió comprobante, admin lo está revisando
          const existPay = await prisma.payment.findFirst({ where: { userId, leagueId, conceptId: obligId } });
          if (!existPay) {
            await prisma.payment.create({
              data: {
                userId, leagueId,
                conceptId: obligId,
                conceptType: 'PRINCIPAL',
                amount: leagueFees[lKey],
                method: 'TRANSFER',
                status: 'REVIEW',
                note: 'Comprobante enviado — pendiente de confirmación por admin',
              },
            });
          }
        } else if (isRejected) {
          // Pago rechazado
          const existPay = await prisma.payment.findFirst({ where: { userId, leagueId, conceptId: obligId } });
          if (!existPay) {
            await prisma.payment.create({
              data: {
                userId, leagueId,
                conceptId: obligId,
                conceptType: 'PRINCIPAL',
                amount: leagueFees[lKey],
                method: 'NEQUI',
                status: 'REJECTED',
                note: 'Comprobante inválido — monto incorrecto',
              },
            });
          }
        }
      }
      if ((u as any).leagues.length > 0) {
        const icons = (u as any).leagues.map((e: string) => e.split(':')[0]).join('+');
        console.log(`  ✓ ${u.username.padEnd(22)} → ligas: ${icons}`);
      }
    }

    // ── 6. PARTIDOS AMISTOSOS ─────────────────────────────────────────────
    console.log('\n📅 Creando partidos amistosos...');
    const allTeams = await prisma.team.findMany({ select: { id: true, code: true } });
    const teamMap = new Map(allTeams.map(t => [t.code, t.id]));

    const MATCHES_DEF = [
      // FINALIZADOS (para ver puntos reales)
      { home: 'COL', away: 'BRA', date: '2026-03-15T20:00:00Z', venue: 'El Campín, Bogotá',         status: 'FINISHED', homeScore: 2, awayScore: 1, key: 'COL-BRA', label: 'Colombia 2-1 Brasil (FIN)' },
      { home: 'ESP', away: 'ARG', date: '2026-03-16T21:00:00Z', venue: 'Estadio Bernabéu, Madrid',   status: 'FINISHED', homeScore: 1, awayScore: 1, key: 'ESP-ARG', label: 'España 1-1 Argentina (FIN)' },
      { home: 'FRA', away: 'POR', date: '2026-03-17T19:00:00Z', venue: 'Parc des Princes, París',    status: 'FINISHED', homeScore: 3, awayScore: 0, key: 'FRA-POR', label: 'Francia 3-0 Portugal (FIN)' },
      // PROGRAMADOS (para ver pronósticos futuros)
      { home: 'COL', away: 'ARG', date: '2026-03-25T20:00:00Z', venue: 'El Campín, Bogotá',         status: 'SCHEDULED', homeScore: null, awayScore: null, key: 'COL-ARG', label: 'Colombia vs Argentina (25 mar)' },
      { home: 'BRA', away: 'ESP', date: '2026-03-26T21:00:00Z', venue: 'Maracanã, Río de Janeiro',  status: 'SCHEDULED', homeScore: null, awayScore: null, key: 'BRA-ESP', label: 'Brasil vs España (26 mar)' },
      { home: 'FRA', away: 'GER', date: '2026-03-27T19:00:00Z', venue: 'Stade de France, París',    status: 'SCHEDULED', homeScore: null, awayScore: null, key: 'FRA-GER', label: 'Francia vs Alemania (27 mar)' },
    ];

    const matchIds: Record<string, string> = {};

    for (const m of MATCHES_DEF) {
      const homeId = teamMap.get(m.home);
      const awayId = teamMap.get(m.away);

      if (!homeId || !awayId) {
        console.log(`  ✗ ${m.label} — equipos no encontrados (ejecuta seed_wc2026.ts primero)`);
        continue;
      }

      const matchDate = new Date(m.date);
      const existing = await prisma.match.findFirst({
        where: { homeTeamId: homeId, awayTeamId: awayId, matchDate },
      });

      const match = existing ?? await prisma.match.create({
        data: {
          homeTeamId: homeId,
          awayTeamId: awayId,
          phase: 'GROUP',
          matchDate,
          venue: m.venue,
          status: m.status as any,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          tournamentId: tournament?.id ?? null,
          round: 'Amistoso',
        },
      });

      // Actualizar scores si ya existía
      if (existing && m.status === 'FINISHED' && existing.homeScore === null) {
        await prisma.match.update({
          where: { id: existing.id },
          data: { homeScore: m.homeScore, awayScore: m.awayScore, status: 'FINISHED' },
        });
      }

      matchIds[m.key] = match.id;
      console.log(`  ✓ ${m.label}${existing ? ' (ya existía)' : ' (nuevo)'}`);
    }

    // ── 7. PRONÓSTICOS ────────────────────────────────────────────────────
    console.log('\n🎯 Insertando pronósticos...');
    const MATCH_KEYS = ['COL-BRA', 'ESP-ARG', 'FRA-POR', 'COL-ARG', 'BRA-ESP', 'FRA-GER'];
    let predCount = 0;

    for (const u of USERS) {
      if ((u as any).skipLeague) continue;
      const userId = userIds[u.username];
      const preds = PREDICTIONS[u.username] ?? [];
      if (preds.length === 0) continue;

      // Determinar en qué ligas está activo para usar como referencia de liga
      const activeLeagues = (u as any).leagues
        .filter((e: string) => e.includes(':ACTIVE:') || e.includes(':PENDING_PAYMENT:'))
        .map((e: string) => e.split(':')[0]);

      // Usar la primera liga disponible (o L1 si está en ella)
      const primaryLeagueKey = activeLeagues.includes('L1') ? 'L1' : activeLeagues[0];
      if (!primaryLeagueKey) continue;
      const leagueId = leagueIds[primaryLeagueKey];
      if (!leagueId) continue;

      for (let i = 0; i < MATCH_KEYS.length; i++) {
        const pred = preds[i];
        if (!pred) continue;
        const matchId = matchIds[MATCH_KEYS[i]];
        if (!matchId) continue;

        const [homeScore, awayScore] = pred;
        await prisma.prediction.upsert({
          where: { userId_matchId_leagueId: { userId, matchId, leagueId } },
          create: { userId, matchId, leagueId, homeScore, awayScore },
          update: { homeScore, awayScore },
        });
        predCount++;
      }
    }
    console.log(`  ✓ ${predCount} pronósticos insertados`);

    // ── 8. INVITACIONES PENDIENTES ────────────────────────────────────────
    console.log('\n📩 Creando invitaciones de prueba...');
    const adminL1Id = userIds['prueba_admin1'];
    const l1Id = leagueIds['L1'];
    if (adminL1Id && l1Id) {
      const invitations = [
        { channel: 'EMAIL',    recipient: 'invitado.email@externo.com' },
        { channel: 'WHATSAPP', recipient: '+573009999999' },
        { channel: 'LINK',     recipient: 'enlace-publico' },
      ];
      for (const inv of invitations) {
        const exists = await prisma.invitation.findFirst({
          where: { leagueId: l1Id, recipient: inv.recipient },
        });
        if (!exists) {
          await prisma.invitation.create({
            data: {
              leagueId: l1Id,
              invitedBy: adminL1Id,
              channel: inv.channel as any,
              recipient: inv.recipient,
              status: 'SENT',
              expiresAt: new Date('2026-05-01T00:00:00Z'),
            },
          });
        }
      }
      console.log('  ✓ 3 invitaciones creadas en Liga 1');
    }

    // ── 9. RESUMEN FINAL ──────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(70));
    console.log('✅  ENTORNO DE PRUEBA COMPLETO v2');
    console.log('═'.repeat(70));

    console.log('\n🔑  CONTRASEÑAS');
    console.log('  Superadmin  →  Super2026');
    console.log('  Admins      →  Admin2026');
    console.log('  Jugadores   →  Jugador2026');

    console.log('\n👤  USUARIOS (25 en total)');
    console.log('─'.repeat(70));
    for (const u of USERS) {
      console.log(`  ${u.tag.padEnd(30)} ${u.email.padEnd(30)} ${u.pass}`);
    }

    console.log('\n⚽  LIGAS');
    console.log('─'.repeat(70));
    for (const ld of LEAGUES_DEF) {
      console.log(`  [${ld.key}] ${ld.code.padEnd(12)} ${ld.name.padEnd(28)} ${ld.plan} ${ld.baseFee.toLocaleString()} COP`);
    }

    console.log('\n📅  PARTIDOS');
    console.log('─'.repeat(70));
    console.log('  FINALIZADOS:');
    console.log('    • Colombia 2-1 Brasil       (15 mar 2026)');
    console.log('    • España 1-1 Argentina      (16 mar 2026)');
    console.log('    • Francia 3-0 Portugal      (17 mar 2026)');
    console.log('  PROGRAMADOS:');
    console.log('    • Colombia vs Argentina     (25 mar 2026)');
    console.log('    • Brasil vs España          (26 mar 2026)');
    console.log('    • Francia vs Alemania       (27 mar 2026)');

    console.log('\n🎯  ESCENARIOS DE PRUEBA');
    console.log('─'.repeat(70));
    console.log('  💰 PAGOS — estados disponibles en Liga 1:');
    console.log('    CONFIRMED: admin1, gold1/2, free1/2/3, diamond1, multiliga, premium, parcial, casual');
    console.log('    REVIEW:    revision (envió comprobante, esperando admin)');
    console.log('    REJECTED:  rechazado (comprobante inválido)');
    console.log('    PENDING:   sinpago1/2/3, nuevo, baneado, rejected');
    console.log('  👥 MEMBRESÍAS — estados:');
    console.log('    ACTIVE:          admin1/2/3, gold1/2, free1/2/3, diamond1, multiliga, premium, parcial, casual, invitado, mexico, argentina');
    console.log('    PENDING_PAYMENT: revision, rechazado, sinpago1/2/3, nuevo');
    console.log('    BANNED:          baneado');
    console.log('    REJECTED:        rejected');
    console.log('  🌍 MULTI-LIGA: multiliga (L1+L2+L3), premium (L1+L2+L3)');
    console.log('  🌎 INTERNACIONALES: mexico (+52), argentina (+54)');
    console.log('  📊 RANKING: admin1 y premium con score perfecto (15 pts)');
    console.log('              free3 y casual con 0 pts (sin aciertos / sin pronósticos)');
    console.log('═'.repeat(70));

  } catch (err) {
    console.error('\n❌ Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
