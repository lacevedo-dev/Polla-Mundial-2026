const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const counts = await prisma.emailJob.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  
  console.log('\n📧 Estado de la cola de emails:\n');
  counts.forEach(({ status, _count }) => {
    console.log(`${status.padEnd(15)}: ${_count._all} emails`);
  });

  console.log('\n📊 Emails pendientes de reintento (DEFERRED):\n');
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
    console.log(`ID: ${job.id.substring(0, 8)}`);
    console.log(`  Tipo: ${job.type}`);
    console.log(`  Destinatario: ${job.recipientEmail}`);
    console.log(`  Intentos: ${job.attemptCount}`);
    console.log(`  Disponible en: ${availableIn} minutos`);
    console.log(`  Error: ${job.lastError?.substring(0, 80)}...`);
    console.log(`  Creado: ${job.createdAt.toISOString()}`);
    console.log('');
  });

  console.log('\n📊 Emails fallidos (FAILED):\n');
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
    take: 5,
  });

  failed.forEach((job) => {
    console.log(`ID: ${job.id.substring(0, 8)}`);
    console.log(`  Tipo: ${job.type}`);
    console.log(`  Destinatario: ${job.recipientEmail}`);
    console.log(`  Intentos: ${job.attemptCount}`);
    console.log(`  Error: ${job.lastError?.substring(0, 100)}...`);
    console.log('');
  });

  console.log('\n🔍 Proveedores de email bloqueados:\n');
  const now = new Date();
  const providers = await prisma.emailProviderAccount.findMany({
    where: {
      deletedAt: null,
      OR: [
        { blockedUntil: { gt: now } },
        { lastError: { not: null } },
      ],
    },
    select: {
      key: true,
      host: true,
      blockedUntil: true,
      lastError: true,
      lastUsedAt: true,
    },
  });

  if (providers.length === 0) {
    console.log('  ✅ No hay proveedores bloqueados');
  } else {
    providers.forEach((provider) => {
      console.log(`Proveedor: ${provider.key}`);
      console.log(`  Host: ${provider.host}`);
      console.log(`  Bloqueado hasta: ${provider.blockedUntil?.toISOString() || 'N/A'}`);
      console.log(`  Último error: ${provider.lastError?.substring(0, 100)}...`);
      console.log(`  Último uso: ${provider.lastUsedAt?.toISOString() || 'N/A'}`);
      console.log('');
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
