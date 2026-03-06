import { createConnection } from 'mariadb';
import * as dotenv from 'dotenv';
import { classifyDatabaseConnectivityError } from '../src/prisma/database-error.util';
import { resolveDatabaseUrlForMariaDb } from '../src/prisma/database-url.util';

dotenv.config();

async function test() {
    console.log('Probando conexión directa a MariaDB...');

    try {
        const rawDatabaseUrl = process.env.DATABASE_URL;
        if (!rawDatabaseUrl?.trim()) {
            throw new Error('DATABASE_URL is required for Prisma runtime initialization.');
        }

        const resolvedUrl = resolveDatabaseUrlForMariaDb(rawDatabaseUrl);

        if (resolvedUrl.normalizedFromMysqlScheme) {
            console.warn('[db-test] DATABASE_URL uses mysql:// scheme; normalizing to mariadb:// for connectivity test.');
        }

        const conn = await createConnection(resolvedUrl.connectionUrl);
        console.log('DB_CONNECTIVITY_RESULT=ok');
        console.log('Conexión exitosa!');
        await conn.end();
    } catch (error) {
        const diagnostic = classifyDatabaseConnectivityError(error);
        console.error('DB_CONNECTIVITY_RESULT=failed');
        console.error(`DB_FAILURE_CATEGORY=${diagnostic.category}`);
        console.error(`DB_FAILURE_MESSAGE=${diagnostic.message}`);
        process.exitCode = 1;
    }
}

void test();
