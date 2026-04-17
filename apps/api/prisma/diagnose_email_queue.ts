import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

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
    connectionLimit: 2,
    minimumIdle: 1,
    acquireTimeout: 30000,
  };
}

async function main() {
  const adapter = new PrismaMariaDb(buildMariaConfig());
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('\n=== DIAGNÓSTICO DE COLA DE CORREOS ===\n');

    // 1. Resumen de estados
    console.log('📊 RESUMEN POR ESTADO:');
    const statusCounts = await prisma.emailJob.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    
    for (const row of statusCounts) {
      console.log(`  ${row.status}: ${row._count.id} correos`);
    }

    // 2. Correos pendientes
    const pending = await prisma.emailJob.count({
      where: { status: 'PENDING' },
    });
    console.log(`\n✉️  PENDIENTES: ${pending}`);

    if (pending > 0) {
      const pendingSample = await prisma.emailJob.findMany({
        where: { status: 'PENDING' },
        take: 5,
        orderBy: { scheduledAt: 'asc' },
        select: {
          id: true,
          type: true,
          recipientEmail: true,
          subject: true,
          scheduledAt: true,
          availableAt: true,
          attemptCount: true,
        },
      });
      console.log('\n  Muestra de correos pendientes:');
      for (const job of pendingSample) {
        console.log(`    - [${job.type}] ${job.subject}`);
        console.log(`      Para: ${job.recipientEmail}`);
        console.log(`      Programado: ${job.scheduledAt.toISOString()}`);
        console.log(`      Disponible: ${job.availableAt.toISOString()}`);
        console.log(`      Intentos: ${job.attemptCount}`);
      }
    }

    // 3. Correos diferidos
    const deferred = await prisma.emailJob.count({
      where: { status: 'DEFERRED' },
    });
    console.log(`\n⏳ DIFERIDOS: ${deferred}`);

    if (deferred > 0) {
      const deferredSample = await prisma.emailJob.findMany({
        where: { status: 'DEFERRED' },
        take: 5,
        orderBy: { lastAttemptAt: 'desc' },
        select: {
          id: true,
          type: true,
          recipientEmail: true,
          subject: true,
          attemptCount: true,
          lastError: true,
          lastAttemptAt: true,
          availableAt: true,
        },
      });
      console.log('\n  Muestra de correos diferidos:');
      for (const job of deferredSample) {
        console.log(`    - [${job.type}] ${job.subject}`);
        console.log(`      Para: ${job.recipientEmail}`);
        console.log(`      Intentos: ${job.attemptCount}`);
        console.log(`      Último intento: ${job.lastAttemptAt?.toISOString() ?? 'N/A'}`);
        console.log(`      Disponible en: ${job.availableAt.toISOString()}`);
        console.log(`      Error: ${job.lastError ?? 'N/A'}`);
      }
    }

    // 4. Correos fallidos
    const failed = await prisma.emailJob.count({
      where: { status: 'FAILED' },
    });
    console.log(`\n❌ FALLIDOS: ${failed}`);

    if (failed > 0) {
      const failedSample = await prisma.emailJob.findMany({
        where: { status: 'FAILED' },
        take: 10,
        orderBy: { lastAttemptAt: 'desc' },
        select: {
          id: true,
          type: true,
          recipientEmail: true,
          subject: true,
          attemptCount: true,
          lastError: true,
          lastAttemptAt: true,
          providerKey: true,
        },
      });
      console.log('\n  Muestra de correos fallidos:');
      for (const job of failedSample) {
        console.log(`    - [${job.type}] ${job.subject}`);
        console.log(`      Para: ${job.recipientEmail}`);
        console.log(`      Intentos: ${job.attemptCount}`);
        console.log(`      Provider: ${job.providerKey ?? 'N/A'}`);
        console.log(`      Último intento: ${job.lastAttemptAt?.toISOString() ?? 'N/A'}`);
        console.log(`      Error: ${job.lastError ?? 'N/A'}`);
        console.log('');
      }
    }

    // 5. Correos de reportes específicamente
    console.log('\n📋 CORREOS DE REPORTES:');
    const reportTypes = ['PREDICTIONS_REPORT', 'MATCH_RESULTS_REPORT'];
    for (const type of reportTypes) {
      const count = await prisma.emailJob.count({
        where: { type: type as any },
      });
      const sent = await prisma.emailJob.count({
        where: { type: type as any, status: 'SENT' },
      });
      const pending = await prisma.emailJob.count({
        where: { type: type as any, status: { in: ['PENDING', 'DEFERRED', 'SENDING'] } },
      });
      const failed = await prisma.emailJob.count({
        where: { type: type as any, status: { in: ['FAILED', 'DROPPED'] } },
      });
      
      console.log(`  ${type}:`);
      console.log(`    Total: ${count} | Enviados: ${sent} | Pendientes: ${pending} | Fallidos: ${failed}`);
    }

    // 6. Providers SMTP configurados
    console.log('\n🔧 PROVIDERS SMTP:');
    const providers = await prisma.emailProviderAccount.findMany({
      where: { deletedAt: null },
      select: {
        key: true,
        fromEmail: true,
        fromName: true,
        dailyLimit: true,
        blockedUntil: true,
        lastError: true,
        lastUsedAt: true,
      },
    });

    if (providers.length === 0) {
      console.log('  ⚠️  NO HAY PROVIDERS SMTP CONFIGURADOS');
      console.log('  Ejecuta: npm run prisma:bootstrap-email-providers -- --apply');
    } else {
      for (const provider of providers) {
        const isBlocked = provider.blockedUntil && provider.blockedUntil > new Date();
        console.log(`  - ${provider.key} (${provider.fromEmail})`);
        console.log(`    Límite diario: ${provider.dailyLimit}`);
        console.log(`    Estado: ${isBlocked ? '🔴 BLOQUEADO' : '🟢 ACTIVO'}`);
        if (isBlocked) {
          console.log(`    Bloqueado hasta: ${provider.blockedUntil?.toISOString()}`);
        }
        if (provider.lastError) {
          console.log(`    Último error: ${provider.lastError}`);
        }
        if (provider.lastUsedAt) {
          console.log(`    Último uso: ${provider.lastUsedAt.toISOString()}`);
        }
      }
    }

    // 7. Uso de cuota diaria
    console.log('\n📈 USO DE CUOTA DIARIA:');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const usage = await prisma.emailProviderUsage.findMany({
      where: {
        quotaWindowStart: { gte: today },
      },
      select: {
        providerKey: true,
        sentCount: true,
        quotaWindowStart: true,
        blockedUntil: true,
        lastError: true,
      },
    });

    if (usage.length === 0) {
      console.log('  Sin uso registrado hoy');
    } else {
      for (const u of usage) {
        console.log(`  - ${u.providerKey}: ${u.sentCount} enviados`);
        if (u.blockedUntil && u.blockedUntil > new Date()) {
          console.log(`    🔴 Bloqueado hasta: ${u.blockedUntil.toISOString()}`);
        }
        if (u.lastError) {
          console.log(`    Error: ${u.lastError}`);
        }
      }
    }

    console.log('\n=== FIN DEL DIAGNÓSTICO ===\n');

  } catch (error) {
    console.error('Error durante el diagnóstico:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
