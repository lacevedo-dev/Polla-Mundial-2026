import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'srv813.hstgr.io',
  user: 'u515832100_polla_ui_prod',
  password: 'S0p0rt3**26',
  database: 'u515832100_polla_ui_prod',
});

async function check() {
  const conn = await pool.getConnection();

  // Tomorrow in UTC: 2026-03-31
  const [matches] = await conn.execute(`
    SELECT m.id, m.status, m.externalId, m.matchDate,
           h.name as homeTeam, a.name as awayTeam,
           t.name as tournament
    FROM \`Match\` m
    JOIN Team h ON m.homeTeamId = h.id
    JOIN Team a ON m.awayTeamId = a.id
    LEFT JOIN Tournament t ON m.tournamentId = t.id
    WHERE m.matchDate >= '2026-03-31 00:00:00'
      AND m.matchDate <  '2026-04-01 00:00:00'
    ORDER BY m.matchDate
  `);

  console.log(`\n=== Partidos para 2026-03-31 UTC (${matches.length} total) ===`);
  if (matches.length === 0) {
    console.log('No hay partidos cargados para mañana.');
  } else {
    matches.forEach(m => {
      const hora = new Date(m.matchDate).toISOString().slice(11, 16);
      const externalStr = m.externalId ? `externalId:${m.externalId}` : 'sin externalId';
      console.log(`  ${hora} UTC | ${m.homeTeam} vs ${m.awayTeam} [${m.status}] | ${externalStr} | ${m.tournament ?? 'sin torneo'}`);
    });
  }

  // Also check how many predictions exist for these matches
  if (matches.length > 0) {
    const ids = matches.map(m => `'${m.id}'`).join(',');
    const [preds] = await conn.execute(`
      SELECT matchId, COUNT(*) as total
      FROM Prediction
      WHERE matchId IN (${ids})
      GROUP BY matchId
    `);
    const predMap = new Map(preds.map(p => [p.matchId, p.total]));
    console.log('\n=== Predicciones por partido ===');
    matches.forEach(m => {
      const count = predMap.get(m.id) ?? 0;
      if (count > 0) console.log(`  ${m.homeTeam} vs ${m.awayTeam}: ${count} predicciones`);
    });
    const total = preds.reduce((s, p) => s + Number(p.total), 0);
    console.log(`Total predicciones: ${total}`);
  }

  conn.release();
  await pool.end();
}

check().catch(err => { console.error('Error:', err.message); process.exit(1); });
