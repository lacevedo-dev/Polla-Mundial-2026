/**
 * seed-players-predictions.mjs
 * Adds all active users to both pollas and creates random predictions for each match.
 */
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'srv813.hstgr.io',
  user: 'u515832100_polla_ui_prod',
  password: 'S0p0rt3**26',
  database: 'u515832100_polla_ui_prod',
});

function randomScore() {
  const weights = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4];
  return weights[Math.floor(Math.random() * weights.length)];
}

async function main() {
  const conn = await pool.getConnection();

  // 1. Get all active users
  const [users] = await conn.execute(
    "SELECT id, name, email FROM User WHERE status = 'ACTIVE' ORDER BY createdAt"
  );
  console.log(`\nUsuarios activos: ${users.length}`);
  users.forEach(u => console.log(`  ${u.name} (${u.email})`));

  // 2. Get both pollas
  const [leagues] = await conn.execute(`
    SELECT id, name, status FROM League
    WHERE name IN ('Liga Test Mundial 2026', 'Polla Amistosos 2026')
  `);
  console.log(`\nPollas encontradas: ${leagues.length}`);
  leagues.forEach(l => console.log(`  [${l.id}] ${l.name} [${l.status}]`));

  if (leagues.length === 0) {
    console.error('No se encontraron pollas. Ejecutá seed-test-data primero.');
    conn.release(); await pool.end(); return;
  }

  // 3. Get upcoming matches per polla (via tournament link + sin torneo)
  const windowStart = new Date();
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 2);

  // Matches for each league
  const matchesByLeague = new Map();

  for (const league of leagues) {
    let matches;
    if (league.name === 'Polla Amistosos 2026') {
      // Matches without tournament
      [matches] = await conn.execute(`
        SELECT m.id as matchId, h.name as homeTeam, a.name as awayTeam
        FROM \`Match\` m
        JOIN Team h ON m.homeTeamId = h.id
        JOIN Team a ON m.awayTeamId = a.id
        WHERE m.status = 'SCHEDULED'
          AND m.tournamentId IS NULL
          AND m.matchDate >= ? AND m.matchDate < ?
        ORDER BY m.matchDate
      `, [windowStart, windowEnd]);
    } else {
      // Matches linked to tournaments in this league
      [matches] = await conn.execute(`
        SELECT m.id as matchId, h.name as homeTeam, a.name as awayTeam
        FROM \`Match\` m
        JOIN Team h ON m.homeTeamId = h.id
        JOIN Team a ON m.awayTeamId = a.id
        JOIN LeagueTournament lt ON lt.tournamentId = m.tournamentId
        WHERE m.status = 'SCHEDULED'
          AND lt.leagueId = ?
          AND m.matchDate >= ? AND m.matchDate < ?
        ORDER BY m.matchDate
      `, [league.id, windowStart, windowEnd]);
    }
    matchesByLeague.set(league.id, matches);
    console.log(`\n  ${league.name}: ${matches.length} partidos`);
    matches.forEach(m => console.log(`    ${m.homeTeam} vs ${m.awayTeam}`));
  }

  // 4. For each user → each league: add member + create predictions
  let membersAdded = 0, predictionsCreated = 0, predictionsSkipped = 0;

  for (const user of users) {
    for (const league of leagues) {
      // Add as ACTIVE PLAYER (skip if already member)
      const [memberCheck] = await conn.execute(
        'SELECT id, status FROM LeagueMember WHERE userId = ? AND leagueId = ?',
        [user.id, league.id]
      );

      if (memberCheck.length === 0) {
        await conn.execute(
          "INSERT INTO LeagueMember (id, userId, leagueId, role, status, joinedAt) VALUES (UUID(), ?, ?, 'PLAYER', 'ACTIVE', NOW())",
          [user.id, league.id]
        );
        membersAdded++;
      } else if (memberCheck[0].status !== 'ACTIVE') {
        await conn.execute(
          "UPDATE LeagueMember SET status = 'ACTIVE' WHERE userId = ? AND leagueId = ?",
          [user.id, league.id]
        );
        membersAdded++;
      }

      // Create predictions for each match
      const matches = matchesByLeague.get(league.id) ?? [];
      for (const match of matches) {
        const h = randomScore(), a = randomScore();
        try {
          await conn.execute(`
            INSERT INTO Prediction (id, userId, matchId, leagueId, homeScore, awayScore, submittedAt, updatedAt)
            VALUES (UUID(), ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE homeScore = VALUES(homeScore), awayScore = VALUES(awayScore), updatedAt = NOW()
          `, [user.id, match.matchId, league.id, h, a]);
          predictionsCreated++;
        } catch (err) {
          console.warn(`    Skipped ${match.homeTeam} vs ${match.awayTeam} para ${user.name}: ${err.message}`);
          predictionsSkipped++;
        }
      }
    }
  }

  // 5. Summary
  console.log('\n=== Resumen ===');
  console.log(`Usuarios: ${users.length}`);
  console.log(`Pollas:   ${leagues.length}`);
  console.log(`Miembros agregados/activados: ${membersAdded}`);
  console.log(`Predicciones creadas: ${predictionsCreated}`);
  if (predictionsSkipped > 0) console.log(`Saltadas: ${predictionsSkipped}`);

  // Show prediction count per league
  for (const league of leagues) {
    const [[{ total }]] = await conn.execute(
      'SELECT COUNT(*) as total FROM Prediction WHERE leagueId = ?',
      [league.id]
    );
    console.log(`\n  ${league.name}: ${total} predicciones totales`);
  }

  conn.release();
  await pool.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
