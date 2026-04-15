import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

// Usar el mismo adaptador que PrismaService
const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl?.trim()) {
    throw new Error('DATABASE_URL is required');
}

// Normalizar mysql:// a mariadb://
const databaseUrl = rawDatabaseUrl.replace(/^mysql:\/\//, 'mariadb://');
const adapter = new PrismaMariaDb(databaseUrl);

const prisma = new PrismaClient({
    adapter: adapter as any,
});

async function main() {
    console.log('🗑️  Limpiando datos de prueba...\n');

    try {
        // Orden respetando foreign keys
        console.log('   → Eliminando pronósticos...');
        await prisma.prediction.deleteMany();

        console.log('   → Eliminando relaciones partido-polla (LeagueMatch)...');
        await prisma.leagueMatch.deleteMany();

        console.log('   → Eliminando relaciones torneo-polla (LeagueTournament)...');
        await prisma.leagueTournament.deleteMany();

        console.log('   → Eliminando miembros de pollas...');
        await prisma.leagueMember.deleteMany();

        console.log('   → Eliminando obligaciones de participación...');
        await prisma.participationObligation.deleteMany();

        console.log('   → Eliminando pagos...');
        await prisma.payment.deleteMany();

        console.log('   → Eliminando pollas...');
        const deletedLeagues = await prisma.league.deleteMany();

        console.log('\n✅ Datos de prueba eliminados correctamente');
        console.log(`   Pollas eliminadas: ${deletedLeagues.count}`);

        console.log('\n📋 Siguiente paso:\n');
        console.log('1. Importar torneos desde API-Football:');
        console.log('   Admin → Matches → Import Tournament\n');
        console.log('2. Crear polla de prueba:');
        console.log('   Admin → Leagues → Create\n');
        console.log('3. Vincular torneo a la polla:');
        console.log('   Admin → League Detail → Tab "Torneos" → Vincular Torneo\n');
        console.log('4. Activar partidos del torneo:');
        console.log('   Admin → League Detail → Tab "Partidos" → Seleccionar torneo → "Activar Todos del Torneo"\n');
        console.log('5. Opcional: Desactivar partidos individuales según necesites\n');

    } catch (error) {
        console.error('\n❌ Error al limpiar datos:', error);
        throw error;
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
