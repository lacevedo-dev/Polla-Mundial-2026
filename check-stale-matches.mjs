import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'srv813.hstgr.io',
  user: 'u515832100_polla_ui_prod',
  password: 'S0p0rt3**26',
  database: 'u515832100_polla_ui_prod',
});

async function check() {
  const conn = await pool.getConnection();

  // Lithuania vs Bulgaria specifically
  const [match] = await conn.execute(`
    SELECT m.id, m.status, m.externalId, m.matchDate, m.homeScore, m.awayScore,
           m.resultNotificationSentAt,
           h.name as homeTeam, a.name as awayTeam,
           TIMESTAMPDIFF(MINUTE, m.matchDate, NOW()) as minutesAgo
    FROM \`Match\` m
    JOIN Team h ON m.homeTeamId = h.id
    JOIN Team a ON m.awayTeamId = a.id
    WHERE (h.name LIKE '%Lithuania%' OR a.name LIKE '%Lithuania%'
       OR h.name LIKE '%Bulgaria%' OR a.name LIKE '%Bulgaria%')
    ORDER BY m.matchDate DESC
    LIMIT 5
  `);

  console.log('\n=== Lithuania / Bulgaria ===');
  match.forEach(r => {
    console.log(`${r.homeTeam} vs ${r.awayTeam}`);
    console.log(`  status     : ${r.status}`);
    console.log(`  externalId : ${r.externalId ?? 'NULL'}`);
    console.log(`  matchDate  : ${r.matchDate.toISOString()} UTC`);
    console.log(`  hace       : ${Math.floor(r.minutesAgo/60)}h ${r.minutesAgo%60}min`);
    console.log(`  score      : ${r.homeScore ?? '-'}-${r.awayScore ?? '-'}`);
    console.log(`  notifSent  : ${r.resultNotificationSentAt ?? 'NULL'}`);
  });

  if (match.length === 0) { console.log('No encontrado'); return; }

  const matchId = match[0].id;
  const externalId = match[0].externalId;

  // Sync logs for this match
  const [logs] = await conn.execute(`
    SELECT type, status, message, matchesUpdated, createdAt
    FROM FootballSyncLog
    WHERE matchId = ? OR externalId = ?
    ORDER BY createdAt DESC LIMIT 10
  `, [matchId, externalId]);

  console.log('\n=== Sync logs ===');
  if (logs.length === 0) {
    console.log('Sin sync logs — nunca fue sincronizado.');
  } else {
    logs.forEach(l => console.log(`${new Date(l.createdAt).toISOString()} | ${l.type} | ${l.status} | ${l.message ?? ''}`));
  }

  // Check if externalId appears in recent API responses
  if (externalId) {
    const [apiHits] = await conn.execute(`
      SELECT endpoint, responseStatus, matchesFetched, createdAt,
             CASE WHEN responseBody LIKE ? THEN 'SI' ELSE 'NO' END as containsFixture
      FROM ApiFootballRequest
      WHERE createdAt > DATE_SUB(NOW(), INTERVAL 6 HOUR)
      ORDER BY createdAt DESC LIMIT 10
    `, [`%"id":${externalId}%`]);

    console.log(`\n=== API hits recientes (contiene fixture ${externalId}?) ===`);
    apiHits.forEach(h => {
      console.log(`${new Date(h.createdAt).toISOString()} | ${h.endpoint} | HTTP ${h.responseStatus} | fixtures:${h.matchesFetched} | contiene partido: ${h.containsFixture}`);
    });
  }

  // All stale matches right now
  const [stale] = await conn.execute(`
    SELECT m.status, h.name as homeTeam, a.name as awayTeam,
           m.externalId, TIMESTAMPDIFF(MINUTE, m.matchDate, NOW()) as minutesAgo
    FROM \`Match\` m
    JOIN Team h ON m.homeTeamId = h.id
    JOIN Team a ON m.awayTeamId = a.id
    WHERE m.status IN ('LIVE', 'SCHEDULED')
      AND m.matchDate < DATE_SUB(NOW(), INTERVAL 90 MINUTE)
    ORDER BY m.matchDate
  `);

  console.log(`\n=== Todos los LIVE/SCHEDULED con mas de 90 min (${stale.length} total) ===`);
  stale.forEach(r => {
    console.log(`${r.homeTeam} vs ${r.awayTeam} [${r.status}] | hace ${Math.floor(r.minutesAgo/60)}h ${r.minutesAgo%60}min | externalId: ${r.externalId ?? 'NULL'}`);
  });

  conn.release();
  await pool.end();
}

check().catch(err => { console.error('Error:', err.message); process.exit(1); });
