import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding con Prisma Nativo...');
    try {
        await prisma.$connect();
        console.log('Conectado.');

        await prisma.team.upsert({
            where: { code: 'COL' },
            update: {},
            create: { name: 'Colombia', code: 'COL', group: 'A' },
        });
        console.log('Colombia OK');

        await prisma.team.upsert({
            where: { code: 'ARG' },
            update: {},
            create: { name: 'Argentina', code: 'ARG', group: 'A' },
        });
        console.log('Argentina OK');

        console.log('Seed terminado.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
