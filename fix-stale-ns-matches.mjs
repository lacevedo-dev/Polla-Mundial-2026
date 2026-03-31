import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'srv813.hstgr.io',
  user: 'u515832100_polla_ui_prod',
  password: 'S0p0rt3**26',
  database: 'u515832100_polla_ui_prod',
});

async function fix() {
  const conn = await pool.getConnection();

  // Show what we're about to close
  const [stale] = await conn.execute(`
    SELECT m.id, m.status, m.externalId, m.matchDate,
           h.name as homeTeam, a.name as awayTeam,
           TIMESTAMPDIFF(MINUTE, m.matchDate, NOW()) as minutesAgo
    FROM \`Match\` m
    JOIN Team h ON m.homeTeamId = h.id
    JOIN Team a ON m.awayTeamId = a.id
    WHERE m.status IN ('LIVE', 'SCHEDULED')
      AND m.matchDate < DATE_SUB(NOW(), INTERVAL 90 MINUTE)
    ORDER BY m.matchDate
  `);

  console.log(`\nPartidos a cerrar (${stale.length}):`);
  stale.forEach(r => {
    console.log(`  ${r.homeTeam} vs ${r.awayTeam} [${r.status}] | hace ${Math.floor(r.minutesAgo/60)}h ${r.minutesAgo%60}min | externalId: ${r.externalId ?? 'NULL'}`);
  });

  if (stale.length === 0) {
    console.log('No hay partidos atascados.');
    conn.release();
    await pool.end();
    return;
  }

  const [result] = await conn.execute(`
    UPDATE \`Match\`
    SET status = 'FINISHED',
        resultNotificationSentAt = NOW()
    WHERE status IN ('LIVE', 'SCHEDULED')
      AND matchDate < DATE_SUB(NOW(), INTERVAL 90 MINUTE)
  `);

  console.log(`\nCerrados: ${result.affectedRows} partidos.\n`);

  conn.release();
  await pool.end();
}

fix().catch(err => { console.error('Error:', err.message); process.exit(1); });
