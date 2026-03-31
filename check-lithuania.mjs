import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'srv813.hstgr.io',
  user: 'u515832100_polla_ui_prod',
  password: 'S0p0rt3**26',
  database: 'u515832100_polla_ui_prod',
});

async function check() {
  const conn = await pool.getConnection();

  const [hits] = await conn.execute(`
    SELECT endpoint, responseStatus, matchesFetched, createdAt,
           CASE WHEN responseBody LIKE '%"id":1502256%' THEN 'SI' ELSE 'NO' END as tieneFixture1502256,
           CASE WHEN responseBody LIKE '%"id":1537251%' THEN 'SI' ELSE 'NO' END as tieneFixture1537251
    FROM ApiFootballRequest
    WHERE createdAt > DATE_SUB(NOW(), INTERVAL 3 HOUR)
    ORDER BY createdAt DESC LIMIT 10
  `);

  console.log('\n=== ¿Aparece fixture 1502256 (Lithuania) en las respuestas recientes? ===');
  hits.forEach(h =>
    console.log(`${new Date(h.createdAt).toISOString()} | fixtures:${h.matchesFetched} | Lithuania(1502256):${h.tieneFixture1502256} | T&T-Gabon(1537251):${h.tieneFixture1537251}`)
  );

  const [matchRows] = await conn.execute(
    "SELECT id, externalId, status, matchDate FROM `Match` WHERE externalId = '1502256'"
  );
  if (matchRows.length > 0) {
    const m = matchRows[0];
    console.log(`\n=== Match en DB: id=${m.id}, status=${m.status}, matchDate=${m.matchDate.toISOString()} ===`);
    const [logs] = await conn.execute(
      'SELECT type, status, message, createdAt FROM FootballSyncLog WHERE matchId = ? OR externalId = ? ORDER BY createdAt DESC LIMIT 10',
      [m.id, '1502256']
    );
    console.log('\n=== Sync logs para Lithuania (1502256) ===');
    if (logs.length === 0) console.log('Sin sync logs.');
    else logs.forEach(l => console.log(`${new Date(l.createdAt).toISOString()} | ${l.type} | ${l.status} | ${l.message}`));
  }

  conn.release();
  await pool.end();
}

check().catch(err => { console.error('Error:', err.message); process.exit(1); });
