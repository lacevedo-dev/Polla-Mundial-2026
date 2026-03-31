import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'srv813.hstgr.io',
  user: 'u515832100_polla_ui_prod',
  password: 'S0p0rt3**26',
  database: 'u515832100_polla_ui_prod',
});

async function fix() {
  const conn = await pool.getConnection();

  // Force-close all LIVE/SCHEDULED matches that started more than 200 min ago
  // (130 min match + 30 min extra time + 40 min buffer).
  // Set resultNotificationSentAt to suppress notification with null score.
  const [result] = await conn.execute(`
    UPDATE \`Match\`
    SET status = 'FINISHED',
        resultNotificationSentAt = NOW()
    WHERE status IN ('LIVE', 'SCHEDULED')
      AND externalId IS NOT NULL
      AND matchDate < DATE_SUB(NOW(), INTERVAL 130 MINUTE)
  `);

  console.log(`\nForce-closed ${result.affectedRows} partidos atascados.\n`);

  // Verify
  const [remaining] = await conn.execute(`
    SELECT m.status, h.name as homeTeam, a.name as awayTeam,
           TIMESTAMPDIFF(MINUTE, m.matchDate, NOW()) as minutesAgo
    FROM \`Match\` m
    JOIN Team h ON m.homeTeamId = h.id
    JOIN Team a ON m.awayTeamId = a.id
    WHERE m.status IN ('LIVE', 'SCHEDULED')
      AND m.matchDate < DATE_SUB(NOW(), INTERVAL 130 MINUTE)
  `);

  if (remaining.length === 0) {
    console.log('Verificacion: no quedan partidos atascados.');
  } else {
    console.log('Todavia atascados:');
    remaining.forEach(r => console.log(`  ${r.homeTeam} vs ${r.awayTeam} [${r.status}] | hace ${Math.floor(r.minutesAgo/60)}h ${r.minutesAgo%60}min`));
  }

  conn.release();
  await pool.end();
}

fix().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
