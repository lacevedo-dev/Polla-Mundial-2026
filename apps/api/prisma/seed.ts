import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { createConnection } from 'mariadb';

async function main() {
    console.log('Intento final con timeout de 30s...');
    try {
        const conn = await createConnection({
            host: 'srv813.hstgr.io',
            port: 3306,
            user: 'u515832100_polla_ui',
            password: 'L&2mV6md',
            database: 'u515832100_polla_ui',
            ssl: { rejectUnauthorized: false },
            connectTimeout: 30000
        });

        const adapter = new PrismaMariaDb(conn as any);
        const prisma = new PrismaClient({ adapter: adapter as any });

        await prisma.$connect();
        await prisma.team.upsert({
            where: { code: 'COL' },
            create: { name: 'Colombia', code: 'COL', group: 'A' },
            update: {}
        });
        console.log('COL OK');

        await prisma.$disconnect();
        await conn.end();
        console.log('Hecho.');
    } catch (e) {
        console.error('ERROR FINAL SEED:', e);
    }
}
main();
