/**
 * seed-missing-polla.mjs
 * Creates the "Polla Amistosos 2026" league directly in DB for matches without tournament,
 * then creates predictions for those 5 remaining matches.
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

  // Get superadmin
  const [[admin]] = await conn.execute(
    "SELECT id FROM User WHERE email = 'lacevedovelez@gmail.com' LIMIT 1"
  );
  const adminId = admin.id;

  // Find or create "Polla Amistosos 2026" (no tournament link)
  const [existing] = await conn.execute(
    "SELECT id, status FROM League WHERE name = 'Polla Amistosos 2026' LIMIT 1"
  );

  let leagueId;

  if (existing.length > 0) {
    leagueId = existing[0].id;
    console.log(`Polla existente: ${leagueId} [${existing[0].status}]`);
    if (existing[0].status !== 'ACTIVE') {
      await conn.execute("UPDATE League SET status = 'ACTIVE' WHERE id = ?", [leagueId]);
      console.log('→ Activada.');
    }
  } else {
    // Generate unique code
    let code;
    while (true) {
      code = Math.random().toString(16).slice(2, 8).toUpperCase();
      const [[dupe]] = await conn.execute('SELECT id FROM League WHERE code = ?', [code]);
      if (!dupe) break;
    }

    const [ins] = await conn.execute(`
      INSERT INTO League
        (id, name, code, privacy, maxParticipants, includeBaseFee, baseFee,
         includeStageFees, currency, adminFeePercent, plan, status,
         closePredictionMinutes, createdAt, updatedAt)
      VALUES
        (UUID(), 'Polla Amistosos 2026', ?, 'PUBLIC', 100, 0, 0,
         0, 'COP', 10, 'FREE', 'ACTIVE',
         15, NOW(), NOW())
    `, [code]);

    // Get the inserted id
    const [[row]] = await conn.execute(
      "SELECT id FROM League WHERE code = ? LIMIT 1", [code]
    );
    leagueId = row.id;
    console.log(`Polla creada: ${leagueId} (code: ${code})`);

    // Default scoring rules
    const rules = [
      ['EXACT_SCORE', 5], ['CORRECT_WINNER', 2], ['TEAM_GOALS', 1],
      ['UNIQUE_PREDICTION', 5], ['PHASE_BONUS_R32', 0], ['PHASE_BONUS_R16', 8],
      ['PHASE_BONUS_QF', 4], ['PHASE_BONUS_SF', 2], ['PHASE_BONUS_FINAL', 5],
    ];
    for (const [ruleType, points] of rules) {
      await conn.execute(`
        INSERT IGNORE INTO ScoringRule (id, leagueId, ruleType, points, multiplier, active)
        VALUES (UUID(), ?, ?, ?, 1.0, 1)
      `, [leagueId, ruleType, points]);
    }
    console.log('Scoring rules creadas.');
  }

  // Ensure admin is ACTIVE member
  const [memberCheck] = await conn.execute(
    'SELECT id, status FROM LeagueMember WHERE userId = ? AND leagueId = ?',
    [adminId, leagueId]
  );
  if (memberCheck.length === 0) {
    await conn.execute(
      "INSERT INTO LeagueMember (id, userId, leagueId, role, status, joinedAt) VALUES (UUID(), ?, ?, 'ADMIN', 'ACTIVE', NOW())",
      [adminId, leagueId]
    );
    console.log('Admin agregado como miembro ACTIVE.');
  } else if (memberCheck[0].status !== 'ACTIVE') {
    await conn.execute(
      "UPDATE LeagueMember SET status = 'ACTIVE' WHERE userId = ? AND leagueId = ?",
      [adminId, leagueId]
    );
    console.log('Admin activado en la polla.');
  } else {
    console.log('Admin ya es miembro activo.');
  }

  // Get upcoming matches without tournament
  const windowStart = new Date();
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 2);

  const [matches] = await conn.execute(`
    SELECT m.id as matchId, h.name as homeTeam, a.name as awayTeam, m.matchDate
    FROM \`Match\` m
    JOIN Team h ON m.homeTeamId = h.id
    JOIN Team a ON m.awayTeamId = a.id
    WHERE m.status = 'SCHEDULED'
      AND m.tournamentId IS NULL
      AND m.matchDate >= ?
      AND m.matchDate < ?
    ORDER BY m.matchDate
  `, [windowStart, windowEnd]);

  console.log(`\nPartidos sin torneo: ${matches.length}`);

  let created = 0;
  for (const m of matches) {
    const h = randomScore(), a = randomScore();
    try {
      await conn.execute(`
        INSERT INTO Prediction (id, userId, matchId, leagueId, homeScore, awayScore, submittedAt, updatedAt)
        VALUES (UUID(), ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE homeScore = VALUES(homeScore), awayScore = VALUES(awayScore), updatedAt = NOW()
      `, [adminId, m.matchId, leagueId, h, a]);
      console.log(`  ${m.homeTeam} vs ${m.awayTeam}: ${h}-${a}`);
      created++;
    } catch (err) {
      console.warn(`  Error ${m.homeTeam} vs ${m.awayTeam}: ${err.message}`);
    }
  }

  console.log(`\nPredicciones creadas: ${created}`);
  console.log('Listo.');

  conn.release();
  await pool.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
