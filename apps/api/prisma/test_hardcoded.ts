import { createConnection } from 'mariadb';
async function test() {
    console.log('Probando conexión hardcoded...');
    try {
        const conn = await createConnection("mysql://u515832100_polla_ui:L&2mV6md@srv813.hstgr.io:3306/u515832100_polla_ui");
        console.log('¡Conexión OK!');
        await conn.end();
    } catch (err) {
        console.error('ERROR:', err);
    }
}
test();
