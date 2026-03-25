/**
 * seed_test_env.ts — Entorno de prueba completo para Polla Mundial 2026
 *
 * Crea:
 *   - 10 usuarios de prueba con perfiles variados
 *   - 1 polla "Liga Test Mundial 2026" vinculada al torneo WC2026
 *   - 3 partidos amistosos (25, 26, 27 de marzo 2026)
 *   - Pronósticos distintos por usuario
 *   - Obligaciones de pago: algunos pagados, otros pendientes
 *   - Estados de membresía variados (activo, pendiente, baneado)
 *
 * Ejecutar:
 *   npx ts-node -r dotenv/config prisma/seed_test_env.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';

// ─── USUARIOS DE PRUEBA ───────────────────────────────────────────────────────
// Contraseña de todos: Test2026!
const TEST_PASSWORD = 'Test2026!';

const TEST_USERS = [
  // Perfil 1: Admin de liga (plan GOLD)
  {
    username: 'test_admin',
    name: 'Carlos Rodríguez (Admin)',
    email: 'test.admin@polla-test.com',
    phone: '3001000001',
    plan: 'GOLD' as const,
    systemRole: 'USER' as const,
    role: 'ADMIN' as const,
    memberStatus: 'ACTIVE' as const,
    pays: true,
    description: 'Administrador de la liga',
  },
  // Perfil 2: Jugador activo pagado (plan GOLD)
  {
    username: 'test_jugador1',
    name: 'María González',
    email: 'test.jugador1@polla-test.com',
    phone: '3001000002',
    plan: 'GOLD' as const,
    systemRole: 'USER' as const,
    role: 'PLAYER' as const,
    memberStatus: 'ACTIVE' as const,
    pays: true,
    description: 'Jugadora activa, pagó cuota',
  },
  // Perfil 3: Jugador activo pagado (plan FREE)
  {
    username: 'test_jugador2',
    name: 'Andrés Martínez',
    email: 'test.jugador2@polla-test.com',
    phone: '3001000003',
    plan: 'FREE' as const,
    systemRole: 'USER' as const,
    role: 'PLAYER' as const,
    memberStatus: 'ACTIVE' as const,
    pays: true,
    description: 'Jugador activo plan FREE, pagó',
  },
  // Perfil 4: Jugador con pago pendiente (restringido)
  {
    username: 'test_sinpago1',
    name: 'Laura Pérez',
    email: 'test.sinpago1@polla-test.com',
    phone: '3001000004',
    plan: 'FREE' as const,
    systemRole: 'USER' as const,
    role: 'PLAYER' as const,
    memberStatus: 'PENDING_PAYMENT' as const,
    pays: false,
    description: 'Jugadora con pago pendiente (restringida)',
  },
  // Perfil 5: Jugador con pago pendiente (restringido)
  {
    username: 'test_sinpago2',
    name: 'Felipe Torres',
    email: 'test.sinpago2@polla-test.com',
    phone: '3001000005',
    plan: 'FREE' as const,
    systemRole: 'USER' as const,
    role: 'PLAYER' as const,
    memberStatus: 'PENDING_PAYMENT' as const,
    pays: false,
    description: 'Jugador con pago pendiente (restringido)',
  },
  // Perfil 6: Jugador activo pagado (plan DIAMOND)
  {
    username: 'test_diamond',
    name: 'Valentina Ruiz',
    email: 'test.diamond@polla-test.com',
    phone: '3001000006',
    plan: 'DIAMOND' as const,
    systemRole: 'USER' as const,
    role: 'PLAYER' as const,
    memberStatus: 'ACTIVE' as const,
    pays: true,
    description: 'Jugadora plan DIAMOND, pagó',
  },
  // Perfil 7: Jugador activo recién unido (sin pago aún)
  {
    username: 'test_nuevo',
    name: 'Santiago López',
    email: 'test.nuevo@polla-test.com',
    phone: '3001000007',
    plan: 'FREE' as const,
    systemRole: 'USER' as const,
    role: 'PLAYER' as const,
    memberStatus: 'PENDING_PAYMENT' as const,
    pays: false,
    description: 'Jugador recién unido, pendiente de pago',
  },
  // Perfil 8: Jugador baneado
  {
    username: 'test_baneado',
    name: 'Ricardo Gómez',
    email: 'test.baneado@polla-test.com',
    phone: '3001000008',
    plan: 'FREE' as const,
    systemRole: 'USER' as const,
    role: 'PLAYER' as const,
    memberStatus: 'BANNED' as const,
    pays: false,
    description: 'Jugador baneado de la liga',
  },
  // Perfil 9: Jugador activo pagado (plan FREE)
  {
    username: 'test_jugador3',
    name: 'Camila Vargas',
    email: 'test.jugador3@polla-test.com',
    phone: '3001000009',
    plan: 'FREE' as const,
    systemRole: 'USER' as const,
    role: 'PLAYER' as const,
    memberStatus: 'ACTIVE' as const,
    pays: true,
    description: 'Jugadora activa, pagó cuota',
  },
  // Perfil 10: Superadmin del sistema
  {
    username: 'test_superadmin',
    name: 'Admin Sistema TEST',
    email: 'test.superadmin@polla-test.com',
    phone: '3001000010',
    plan: 'DIAMOND' as const,
    systemRole: 'SUPERADMIN' as const,
    role: 'PLAYER' as const,
    memberStatus: 'ACTIVE' as const,
    pays: true,
    description: 'Superadmin del sistema (no miembro de liga)',
    skipLeague: true, // no se une a la liga
  },
];

// ─── PARTIDOS AMISTOSOS ───────────────────────────────────────────────────────
// Usa equipos del WC2026 que ya deben existir en la BD
const FRIENDLY_MATCHES = [
  {
    home: 'COL',
    away: 'ARG',
    date: '2026-03-25T20:00:00Z',
    venue: 'Estadio El Campín, Bogotá',
    label: 'Colombia vs Argentina (Amistoso)',
  },
  {
    home: 'BRA',
    away: 'ESP',
    date: '2026-03-26T21:00:00Z',
    venue: 'Estádio do Maracanã, Río de Janeiro',
    label: 'Brasil vs España (Amistoso)',
  },
  {
    home: 'FRA',
    away: 'GER',
    date: '2026-03-27T19:00:00Z',
    venue: 'Stade de France, París',
    label: 'Francia vs Alemania (Amistoso)',
  },
];

// ─── PRONÓSTICOS POR USUARIO (home-away para cada partido) ───────────────────
// Orden: [COL-ARG, BRA-ESP, FRA-GER]
const USER_PREDICTIONS: Record<string, [number, number][]> = {
  test_admin:      [[2, 1], [3, 2], [1, 1]],  // marcadores exactos, muy buenos
  test_jugador1:   [[1, 1], [2, 2], [1, 0]],  // empates seguros
  test_jugador2:   [[3, 0], [2, 1], [2, 0]],  // local siempre gana
  test_sinpago1:   [[0, 2], [1, 3], [0, 2]],  // visitante siempre gana
  test_sinpago2:   [[1, 2], [0, 1], [0, 1]],  // visitante gana por poco
  test_diamond:    [[2, 0], [3, 1], [2, 1]],  // local gana cómodo
  test_nuevo:      [[1, 0], [1, 0], [1, 0]],  // siempre 1-0
  test_baneado:    [],                          // baneado no puede pronosticar
  test_jugador3:   [[2, 2], [1, 1], [2, 2]],  // empates altos
  test_superadmin: [],                          // no en liga
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🧪 Iniciando seed de entorno de prueba...\n');

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL no encontrado en .env');

  const connectionUrl = rawUrl.startsWith('mysql://')
    ? `mariadb://${rawUrl.slice('mysql://'.length)}`
    : rawUrl;

  const adapter = new PrismaMariaDb(connectionUrl);
  const prisma = new PrismaClient({ adapter: adapter as any });
  await prisma.$connect();

  const SALT = 10;
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, SALT);

  try {
    // ── 1. CREAR USUARIOS ──────────────────────────────────────────────────
    console.log('👤 Creando 10 usuarios de prueba...');
    const createdUsers: Record<string, string> = {};

    for (const u of TEST_USERS) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        create: {
          name: u.name,
          email: u.email,
          username: u.username,
          phone: u.phone,
          countryCode: '+57',
          passwordHash,
          plan: u.plan,
          systemRole: u.systemRole,
          emailVerified: true,
        },
        update: {
          name: u.name,
          plan: u.plan,
          systemRole: u.systemRole,
          emailVerified: true,
        },
      });
      createdUsers[u.username] = user.id;
      console.log(`  ✓ ${u.username} (${u.plan}) — ${u.description}`);
    }

    // ── 2. BUSCAR TORNEO WC2026 ────────────────────────────────────────────
    console.log('\n🏆 Buscando torneo Mundial 2026...');
    const tournament = await prisma.tournament.findFirst({
      where: { OR: [{ name: { contains: 'Mundial' } }, { name: { contains: 'World Cup' } }, { name: { contains: 'FIFA' } }] },
      orderBy: { season: 'desc' },
    });
    if (tournament) {
      console.log(`  ✓ Torneo encontrado: "${tournament.name}" (id: ${tournament.id})`);
    } else {
      console.log('  ⚠ No se encontró torneo WC2026 — la liga no tendrá torneo vinculado');
    }

    // ── 3. CREAR LIGA DE PRUEBA ────────────────────────────────────────────
    console.log('\n⚽ Creando liga de prueba...');
    const adminUserId = createdUsers['test_admin'];

    const league = await prisma.league.upsert({
      where: { code: 'TEST-WC26' },
      create: {
        name: 'Liga Test Mundial 2026',
        description: 'Liga de prueba para validar el funcionamiento completo del sistema. Contraseña usuarios: Test2026!',
        code: 'TEST-WC26',
        privacy: 'PUBLIC',
        maxParticipants: 20,
        includeBaseFee: true,
        baseFee: 50000,
        currency: 'COP',
        adminFeePercent: 10,
        plan: 'GOLD',
        status: 'ACTIVE',
        closePredictionMinutes: 15,
        primaryTournamentId: tournament?.id ?? null,
      },
      update: {
        status: 'ACTIVE',
        primaryTournamentId: tournament?.id ?? null,
      },
    });
    console.log(`  ✓ Liga creada: "${league.name}" (código: ${league.code})`);

    // Vincular torneo a la liga
    if (tournament) {
      await prisma.leagueTournament.upsert({
        where: { leagueId_tournamentId: { leagueId: league.id, tournamentId: tournament.id } },
        create: { leagueId: league.id, tournamentId: tournament.id },
        update: {},
      });
      console.log(`  ✓ Torneo vinculado a la liga`);
    }

    // ── 4. DISTRIBUCION DE PREMIOS ─────────────────────────────────────────
    console.log('\n🏅 Configurando distribución de premios...');
    const prizes = [
      { position: 1, label: '1° PUESTO', percentage: 60, category: 'GENERAL' as const },
      { position: 2, label: '2° PUESTO', percentage: 30, category: 'GENERAL' as const },
      { position: 3, label: '3° PUESTO', percentage: 10, category: 'GENERAL' as const },
    ];
    for (const p of prizes) {
      await prisma.prizeDistribution.upsert({
        where: { leagueId_category_position: { leagueId: league.id, category: p.category, position: p.position } },
        create: { leagueId: league.id, ...p, active: true },
        update: { percentage: p.percentage, label: p.label },
      });
    }
    console.log(`  ✓ 3 puestos de premio configurados`);

    // ── 5. AGREGAR MIEMBROS A LA LIGA ──────────────────────────────────────
    console.log('\n👥 Agregando miembros a la liga...');
    for (const u of TEST_USERS) {
      if (u.skipLeague) continue;
      const userId = createdUsers[u.username];
      await prisma.leagueMember.upsert({
        where: { userId_leagueId: { userId, leagueId: league.id } },
        create: {
          userId,
          leagueId: league.id,
          role: u.role,
          status: u.memberStatus,
        },
        update: {
          role: u.role,
          status: u.memberStatus,
        },
      });
      console.log(`  ✓ ${u.username} → rol: ${u.role}, estado: ${u.memberStatus}`);
    }

    // ── 6. PARTIDOS AMISTOSOS ──────────────────────────────────────────────
    console.log('\n📅 Creando partidos amistosos (25-27 marzo 2026)...');

    // Verificar que los equipos existen
    const allTeams = await prisma.team.findMany({ select: { id: true, code: true } });
    const teamMap = new Map(allTeams.map(t => [t.code, t.id]));

    const missingTeams = FRIENDLY_MATCHES.flatMap(m => [m.home, m.away]).filter(c => !teamMap.has(c));
    if (missingTeams.length > 0) {
      console.log(`  ⚠ Equipos no encontrados: ${missingTeams.join(', ')}`);
      console.log('  ⚠ Ejecuta seed_wc2026.ts primero para crear los equipos');
    }

    const createdMatches: { id: string; label: string }[] = [];
    for (const m of FRIENDLY_MATCHES) {
      const homeId = teamMap.get(m.home);
      const awayId = teamMap.get(m.away);
      if (!homeId || !awayId) {
        console.log(`  ✗ Saltando ${m.label} — equipos no encontrados`);
        continue;
      }

      // Buscar si ya existe (por fecha + equipos)
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
          status: 'SCHEDULED',
          tournamentId: tournament?.id ?? null,
          round: 'Amistoso',
        },
      });

      createdMatches.push({ id: match.id, label: m.label });
      console.log(`  ✓ ${m.label} (${existing ? 'ya existía' : 'creado'})`);
    }

    // ── 7. PRONÓSTICOS ─────────────────────────────────────────────────────
    console.log('\n🎯 Insertando pronósticos...');
    let predCount = 0;
    for (const u of TEST_USERS) {
      if (u.skipLeague) continue;
      if (u.memberStatus === 'BANNED') continue;

      const userId = createdUsers[u.username];
      const preds = USER_PREDICTIONS[u.username] ?? [];
      if (preds.length === 0) continue;

      for (let i = 0; i < createdMatches.length; i++) {
        if (!preds[i]) continue;
        const [homeScore, awayScore] = preds[i];
        const match = createdMatches[i];

        await prisma.prediction.upsert({
          where: { userId_matchId_leagueId: { userId, matchId: match.id, leagueId: league.id } },
          create: { userId, matchId: match.id, leagueId: league.id, homeScore, awayScore },
          update: { homeScore, awayScore },
        });
        predCount++;
      }
    }
    console.log(`  ✓ ${predCount} pronósticos creados`);

    // ── 8. OBLIGACIONES DE PAGO ────────────────────────────────────────────
    console.log('\n💰 Creando obligaciones de pago (cuota base 50,000 COP)...');
    const deadline = new Date('2026-04-30T23:59:59Z');

    for (const u of TEST_USERS) {
      if (u.skipLeague) continue;
      if (u.memberStatus === 'BANNED') continue;

      const userId = createdUsers[u.username];

      // Buscar obligación existente
      const existingObligation = await prisma.participationObligation.findFirst({
        where: { userId, leagueId: league.id, category: 'PRINCIPAL' },
      });

      if (!existingObligation) {
        const status = u.pays ? 'PAID' : 'PENDING_PAYMENT';
        const obligation = await prisma.participationObligation.create({
          data: {
            userId,
            leagueId: league.id,
            category: 'PRINCIPAL',
            referenceLabel: 'Cuota base Liga Test Mundial 2026',
            source: 'INVITATION',
            unitAmount: 50000,
            multiplier: 1,
            totalAmount: 50000,
            currency: 'COP',
            status,
            deadlineAt: deadline,
            paidAt: u.pays ? new Date() : null,
          },
        });

        // Si pagó, crear registro de pago
        if (u.pays) {
          await prisma.payment.create({
            data: {
              userId,
              leagueId: league.id,
              conceptId: obligation.id,
              conceptType: 'PRINCIPAL',
              amount: 50000,
              method: u.username === 'test_jugador1' ? 'NEQUI' :
                      u.username === 'test_jugador2' ? 'TRANSFER' :
                      u.username === 'test_diamond'  ? 'BANCOLOMBIA' :
                      u.username === 'test_jugador3' ? 'DAVIPLATA' : 'CASH',
              status: 'CONFIRMED',
              note: 'Pago confirmado — entorno de prueba',
            },
          });
        }

        const icon = u.pays ? '✓ PAGADO' : '⏳ PENDIENTE';
        console.log(`  ${icon} ${u.username} — 50,000 COP`);
      } else {
        console.log(`  → ${u.username} ya tiene obligación`);
      }
    }

    // ── 9. RESUMEN ─────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('✅ ENTORNO DE PRUEBA CREADO');
    console.log('═'.repeat(60));
    console.log('\n📋 USUARIOS (contraseña: Test2026!)');
    console.log('─'.repeat(60));
    for (const u of TEST_USERS) {
      const status = u.memberStatus === 'ACTIVE' ? '🟢' :
                     u.memberStatus === 'PENDING_PAYMENT' ? '🟡' :
                     u.memberStatus === 'BANNED' ? '🔴' : '⚪';
      console.log(`  ${status} ${u.email.padEnd(38)} ${u.plan.padEnd(8)} ${u.role}`);
    }
    console.log('\n🏆 LIGA');
    console.log(`  Código: TEST-WC26`);
    console.log(`  Nombre: Liga Test Mundial 2026`);
    console.log(`  Estado: ACTIVE | Plan: GOLD | Cuota: 50,000 COP`);
    console.log(`  Torneo: ${tournament?.name ?? 'Sin torneo'}`);
    console.log('\n📅 PARTIDOS AMISTOSOS CREADOS');
    createdMatches.forEach((m, i) => console.log(`  ${i+1}. ${m.label}`));
    console.log('\n🎯 ESCENARIOS DE PRUEBA');
    console.log('  🟢 ACTIVOS con pago: test_admin, test_jugador1/2/3, test_diamond');
    console.log('  🟡 PENDIENTES sin pago: test_sinpago1, test_sinpago2, test_nuevo');
    console.log('  🔴 BANEADO: test_baneado');
    console.log('  🔵 SUPERADMIN (no en liga): test_superadmin');
    console.log('\n' + '═'.repeat(60));

  } catch (err) {
    console.error('\n❌ Error en seed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
