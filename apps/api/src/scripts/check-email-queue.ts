import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n📧 ============ ESTADO DE LA COLA DE EMAILS ============\n');

  // Contar emails por estado
  const counts = await prisma.emailJob.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  console.log('📊 Resumen por estado:\n');
  counts.forEach(({ status, _count }) => {
    const padding = ' '.repeat(15 - status.length);
    console.log(`  ${status}${padding}: ${_count._all} emails`);
  });

  // Emails pendientes
  const pendingCount = await prisma.emailJob.count({
    where: { status: 'PENDING' },
  });

  if (pendingCount > 0) {
    console.log(`\n⏱️ Emails PENDIENTES de envío (${pendingCount} total):\n`);
    const pending = await prisma.emailJob.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        type: true,
        priority: true,
        recipientEmail: true,
        attemptCount: true,
        availableAt: true,
        createdAt: true,
      },
      orderBy: { availableAt: 'asc' },
      take: 10,
    });

    pending.forEach((job) => {
      const now = new Date();
      const availableIn = Math.round((job.availableAt.getTime() - now.getTime()) / 1000 / 60);
      const availableStatus = availableIn <= 0 ? '✅ LISTO PARA ENVIAR' : `⏳ ${availableIn} min`;

      console.log(`  [${job.id.substring(0, 8)}] ${job.type}`);
      console.log(`    → ${job.recipientEmail} | Prioridad: ${job.priority} | Intentos: ${job.attemptCount}`);
      console.log(`    → Disponible: ${availableStatus}`);
      console.log('');
    });
  }

  // Emails en reintento (DEFERRED)
  const deferredCount = await prisma.emailJob.count({
    where: { status: 'DEFERRED' },
  });

  if (deferredCount > 0) {
    console.log(`\n🔄 Emails en REINTENTO (${deferredCount} total):\n`);
    const deferred = await prisma.emailJob.findMany({
      where: { status: 'DEFERRED' },
      select: {
        id: true,
        type: true,
        recipientEmail: true,
        attemptCount: true,
        availableAt: true,
        lastError: true,
        createdAt: true,
      },
      orderBy: { availableAt: 'asc' },
      take: 10,
    });

    deferred.forEach((job) => {
      const now = new Date();
      const availableIn = Math.round((job.availableAt.getTime() - now.getTime()) / 1000 / 60);

      console.log(`  [${job.id.substring(0, 8)}] ${job.type}`);
      console.log(`    → ${job.recipientEmail} | Intentos: ${job.attemptCount}/6`);
      console.log(`    → Próximo intento en: ${availableIn} minutos`);
      console.log(`    → Error: ${job.lastError?.substring(0, 80)}...`);
      console.log('');
    });
  }

  // Emails fallidos
  const failedCount = await prisma.emailJob.count({
    where: { status: 'FAILED' },
  });

  if (failedCount > 0) {
    console.log(`\n❌ Emails FALLIDOS (${failedCount} total) - Agotaron reintentos:\n`);
    const failed = await prisma.emailJob.findMany({
      where: { status: 'FAILED' },
      select: {
        id: true,
        type: true,
        recipientEmail: true,
        attemptCount: true,
        lastError: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    failed.forEach((job) => {
      console.log(`  [${job.id.substring(0, 8)}] ${job.type}`);
      console.log(`    → ${job.recipientEmail} | Intentos: ${job.attemptCount}`);
      console.log(`    → Error final: ${job.lastError?.substring(0, 100)}...`);
      console.log('');
    });
  }

  // Proveedores bloqueados
  console.log('\n🔌 Estado de Proveedores de Email:\n');
  const now = new Date();
  const allProviders = await prisma.emailProviderAccount.findMany({
    where: { deletedAt: null },
    select: {
      key: true,
      host: true,
      blockedUntil: true,
      lastError: true,
      lastUsedAt: true,
    },
  });

  if (allProviders.length === 0) {
    console.log('  ⚠️ No hay proveedores configurados');
  } else {
    allProviders.forEach((provider) => {
      const isBlocked = provider.blockedUntil && provider.blockedUntil > now;
      const status = isBlocked ? `🚫 BLOQUEADO hasta ${provider.blockedUntil?.toLocaleString('es-CO')}` : '✅ ACTIVO';

      console.log(`  ${provider.key} (${provider.host})`);
      console.log(`    → Estado: ${status}`);
      if (provider.lastError) {
        console.log(`    → Último error: ${provider.lastError.substring(0, 100)}...`);
      }
      if (provider.lastUsedAt) {
        console.log(`    → Último uso: ${provider.lastUsedAt.toLocaleString('es-CO')}`);
      }
      console.log('');
    });
  }

  // Lista negra de emails
  console.log('\n🚫 Lista Negra de Emails:\n');
  const blacklist = await prisma.emailBlacklist.findMany({
    where: { blockedUntil: { gt: now } },
    select: {
      email: true,
      reason: true,
      failureCount: true,
      blockedUntil: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (blacklist.length === 0) {
    console.log('  ✅ No hay emails bloqueados');
  } else {
    blacklist.forEach((entry) => {
      console.log(`  ${entry.email}`);
      console.log(`    → Razón: ${entry.reason}`);
      console.log(`    → Fallos: ${entry.failureCount}`);
      console.log(`    → Bloqueado hasta: ${entry.blockedUntil?.toLocaleString('es-CO')}`);
      console.log('');
    });
  }

  console.log('\n========================================================\n');
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
