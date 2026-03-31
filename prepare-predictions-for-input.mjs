import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'srv813.hstgr.io',
  user: 'u515832100_polla_ui_prod',
  password: 'S0p0rt3**26',
  database: 'u515832100_polla_ui_prod',
});

async function prepare() {
  const conn = await pool.getConnection();
  const now = new Date();
  
  console.log('\n🎯 PREPARING PREDICTIONS FOR PLAYER INPUT\n');
  console.log('='.repeat(100));
  
  // 1. Clear all existing prediction scores
  console.log('\n1️⃣  Clearing prediction scores (homeScore/awayScore)...\n');
  
  await conn.execute(`
    UPDATE Prediction 
    SET homeScore = NULL, awayScore = NULL, points = NULL
  `);
  
  console.log('✅ All prediction scores cleared');
  console.log('   Now ready for players to input their scores\n');
  
  // 2. Generate random scores for validation
  console.log('\n2️⃣  Generating RANDOM scores for each prediction (for testing)...\n');
  
  const [allPredictions] = await conn.execute(`
    SELECT id FROM Prediction ORDER BY RAND()
  `);
  
  console.log(`Found ${allPredictions.length} predictions to generate random scores\n`);
  
  // Possible match outcomes: 0-0, 1-0, 0-1, 1-1, 2-0, 0-2, 2-1, 1-2, 2-2, 3-0, 0-3, 3-1, 1-3, etc.
  const possibleScores = [
    [0, 0], [1, 0], [0, 1], [1, 1],
    [2, 0], [0, 2], [2, 1], [1, 2], [2, 2],
    [3, 0], [0, 3], [3, 1], [1, 3], [3, 2], [2, 3],
    [4, 0], [0, 4], [4, 1], [1, 4], [3, 3]
  ];
  
  let updated = 0;
  
  for (const pred of allPredictions) {
    const randomScore = possibleScores[Math.floor(Math.random() * possibleScores.length)];
    const homeScore = randomScore[0];
    const awayScore = randomScore[1];
    
    await conn.execute(`
      UPDATE Prediction 
      SET homeScore = ?, awayScore = ?
      WHERE id = ?
    `, [homeScore, awayScore, pred.id]);
    
    updated++;
  }
  
  console.log(`✅ Generated random scores for ${updated} predictions`);
  console.log('   Sample outcomes: 0-0, 1-0, 0-1, 1-1, 2-0, 0-2, 2-1, 1-2, 2-2, 3-0, 0-3, 3-1, 1-3, etc.\n');
  
  // 3. Verify
  console.log('\n3️⃣  VERIFICATION:\n');
  
  const [leagues] = await conn.execute(`
    SELECT l.id, l.name, COUNT(DISTINCT p.id) as predictions
    FROM League l
    LEFT JOIN Prediction p ON l.id = p.leagueId
    GROUP BY l.id, l.name
    HAVING predictions > 0
  `);
  
  for (const league of leagues) {
    const [leagueData] = await conn.execute(`
      SELECT 
        COUNT(*) as total_preds,
        COUNT(CASE WHEN homeScore IS NOT NULL THEN 1 END) as with_scores,
        COUNT(CASE WHEN homeScore IS NULL THEN 1 END) as empty_scores
      FROM Prediction
      WHERE leagueId = ?
    `, [league.id]);
    
    const data = leagueData[0];
    console.log(`📋 ${league.name}:`);
    console.log(`   Total predictions: ${data.total_preds}`);
    console.log(`   ✅ With random scores: ${data.with_scores}`);
    console.log(`   ⚠️  Without scores: ${data.empty_scores}\n`);
  }
  
  // 4. Sample predictions
  console.log('\n4️⃣  SAMPLE PREDICTIONS (Ready for Players to SEE in UI):\n');
  
  const [samples] = await conn.execute(`
    SELECT 
      u.username,
      l.name as league,
      h.name as homeTeam,
      a.name as awayTeam,
      p.homeScore,
      p.awayScore,
      m.matchDate
    FROM Prediction p
    JOIN User u ON p.userId = u.id
    JOIN League l ON p.leagueId = l.id
    JOIN \`Match\` m ON p.matchId = m.id
    JOIN Team h ON m.homeTeamId = h.id
    JOIN Team a ON m.awayTeamId = a.id
    LIMIT 10
  `);
  
  samples.forEach((s, idx) => {
    const date = new Date(s.matchDate).toISOString().slice(0, 16);
    console.log(`${(idx + 1).toString().padStart(2, '0')}. ${s.username} | ${s.league}`);
    console.log(`    ${s.homeTeam} ${s.homeScore}-${s.awayScore} ${s.awayTeam}`);
    console.log(`    📅 ${date} UTC\n`);
  });
  
  // 5. Show what players should see
  console.log('\n5️⃣  WHAT PLAYERS SEE IN EACH POLLA:\n');
  
  const [userLeagues] = await conn.execute(`
    SELECT DISTINCT
      u.username,
      l.name as league,
      COUNT(DISTINCT p.matchId) as matches,
      COUNT(DISTINCT p.id) as predictions
    FROM LeagueMember lm
    JOIN User u ON lm.userId = u.id
    JOIN League l ON lm.leagueId = l.id
    LEFT JOIN Prediction p ON p.userId = u.id AND p.leagueId = l.id
    GROUP BY u.id, l.id, u.username, l.name
    LIMIT 5
  `);
  
  userLeagues.forEach(ul => {
    console.log(`👤 ${ul.username} → 📋 ${ul.league}`);
    console.log(`   ${ul.matches} matches, ${ul.predictions} predictions ready to input\n`);
  });
  
  console.log('='.repeat(100));
  console.log('\n✅✅✅ PREDICTIONS READY FOR PLAYER INPUT ✅✅✅\n');
  console.log('Players can now:');
  console.log('  1. See all 16 matches in their polla');
  console.log('  2. See random scores pre-populated (for testing)');
  console.log('  3. Edit/change scores if they want');
  console.log('  4. Submit predictions before match starts (SCHEDULED state)');
  console.log('  5. Watch notifications when match state changes\n');
  
  conn.release();
  process.exit(0);
}

prepare().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
