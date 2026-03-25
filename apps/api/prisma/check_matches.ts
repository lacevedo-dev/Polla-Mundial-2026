import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

async function main() {
  const rawUrl = process.env.DATABASE_URL!;
  const url = rawUrl.startsWith('mysql://') ? 'mariadb://' + rawUrl.slice('mysql://'.length) : rawUrl;
  const adapter = new PrismaMariaDb(url);
  const prisma = new PrismaClient({ adapter: adapter as any });
  await prisma.$connect();

  const matches = await prisma.match.findMany({
    where: {
      matchDate: {
        gte: new Date('2026-03-25T00:00:00Z'),
        lt:  new Date('2026-03-28T00:00:00Z'),
      },
    },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    orderBy: { matchDate: 'asc' },
  });

  console.log(`\nPartidos 25-27 mar (${matches.length} total):\n`);
  for (const m of matches) {
    const date  = m.matchDate.toISOString().slice(0, 16);
    const extId = m.externalId ?? '❌ SIN_EXTERNAL_ID';
    console.log(`  ${date} | ${m.homeTeam.name} vs ${m.awayTeam.name} | ${m.status} | extId=${extId}`);
  }

  const sinExt = matches.filter(m => !m.externalId);
  console.log(`\nTotal sin externalId: ${sinExt.length}`);
  await prisma.$disconnect();
}
main().catch(console.error);
