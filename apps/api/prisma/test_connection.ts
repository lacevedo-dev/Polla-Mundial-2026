import { createConnection } from 'mariadb';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log('Probando conexión directa a MariaDB...');
    try {
        const conn = await createConnection(process.env.DATABASE_URL as string);
        console.log('Conexión exitosa!');
        await conn.end();
    } catch (err) {
        console.error('Error de conexión directa:', err);
    }
}
test();
