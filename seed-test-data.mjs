/**
 * seed-test-data.mjs
 *
 * Usage: node seed-test-data.mjs <password>
 *
 * What it does:
 *  1. Authenticates as superadmin
 *  2. Imports today + tomorrow's fixtures from API-Football (via admin API)
 *  3. For each tournament with upcoming matches, creates a Polla if one doesn't exist
 *  4. Sets those pollas to ACTIVE and adds the superadmin as ACTIVE member
 *  5. Creates predictions for all upcoming SCHEDULED matches (direct DB insert, bypasses closing time)
 */

import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'srv813.hstgr.io',
  user: 'u515832100_polla_ui_prod',
  password: 'S0p0rt3**26',
  database: 'u515832100_polla_ui_prod',
});

const API_BASE = 'https://api-polla.agildesarrollo.com.co';

// ─── helpers ────────────────────────────────────────────────────────────────

function randomScore() {
  const weights = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4];
  return weights[Math.floor(Math.random() * weights.length)];
}

function generateCode() {
  return Math.random().toString(16).slice(2, 8).toUpperCase();
}

async function apiPost(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error('Uso: node seed-test-data.mjs <password>');
    process.exit(1);
  }

  // 1. Login
  console.log('\n[1/5] Autenticando...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'lacevedovelez@gmail.com', password }),
  });
  if (!loginRes.ok) {
    const err = await loginRes.text();
    console.error(`Login fallido: ${loginRes.status} - ${err}`);
    process.exit(1);
  }
  const { access_token: token } = await loginRes.json();
  console.log('  OK.');

  const conn = await pool.getConnection();

  // Get superadmin userId
  const [[superadmin]] = await conn.execute(
    "SELECT id FROM User WHERE email = 'lacevedovelez@gmail.com' LIMIT 1"
  );
  const superadminId = superadmin.id;

  // 2. Import fixtures for today and tomorrow (Bogotá night = UTC tomorrow)
  console.log('\n[2/5] Importando partidos...');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const datesToImport = [
    today.toISOString().slice(0, 10),
    tomorrow.toISOString().slice(0, 10),
  ];

  let totalImported = 0;
  for (const date of datesToImport) {
    try {
      console.log(`  Buscando fixtures para ${date}...`);
      const searchData = await apiGet(`/admin/football/fixtures/search?date=${date}`, token);
      const fixtures = Array.isArray(searchData) ? searchData : (searchData.fixtures ?? []);

      const toImport = fixtures.filter(f => !f.imported && !f.existsInDb);
      console.log(`    ${fixtures.length} fixtures encontrados, ${toImport.length} sin importar.`);

      if (toImport.length > 0) {
        const fixtureIds = toImport.map(f => f.fixture?.id ?? f.id).filter(Boolean);
        const result = await apiPost('/admin/football/fixtures/import-selection', {
          fixtureIds,
          createTeams: true,
          overwriteExisting: false,
        }, token);
        const imported = result.imported ?? result.created ?? result.matchesCreated ?? fixtureIds.length;
        console.log(`    Importados: ${imported}`);
        totalImported += imported;
      }
    } catch (err) {
      console.warn(`  Advertencia importando ${date}: ${err.message}`);
    }
  }
  console.log(`  Total importados: ${totalImported}`);

  // 3. Load all upcoming SCHEDULED matches (today + tomorrow UTC window)
  console.log('\n[3/5] Cargando partidos próximos...');
  const windowStart = new Date();
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 2);

  const [upcomingMatches] = await conn.execute(`
    SELECT m.id as matchId, m.matchDate, m.tournamentId, m.homeTeamId, m.awayTeamId,
           h.name as homeTeam, a.name as awayTeam,
           t.name as tournamentName, t.id as tId
    FROM \`Match\` m
    JOIN Team h ON m.homeTeamId = h.id
    JOIN Team a ON m.awayTeamId = a.id
    LEFT JOIN Tournament t ON m.tournamentId = t.id
    WHERE m.status = 'SCHEDULED'
      AND m.matchDate >= ?
      AND m.matchDate < ?
    ORDER BY m.matchDate
  `, [windowStart, windowEnd]);

  console.log(`  ${upcomingMatches.length} partidos próximos.`);
  upcomingMatches.forEach(m => {
    const hora = new Date(m.matchDate).toISOString().slice(11, 16);
    console.log(`    ${hora} UTC | ${m.homeTeam} vs ${m.awayTeam} | ${m.tournamentName ?? 'sin torneo'}`);
  });

  if (upcomingMatches.length === 0) {
    console.log('  No hay partidos para hacer seed. Terminando.');
    conn.release();
    await pool.end();
    return;
  }

  // 4. Group matches by tournament → create/find one Polla per tournament
  console.log('\n[4/5] Creando / encontrando pollas por torneo...');

  // Group by tournamentId (null = "sin torneo")
  const byTournament = new Map();
  for (const m of upcomingMatches) {
    const key = m.tId ?? '__no_tournament__';
    if (!byTournament.has(key)) byTournament.set(key, { tournamentId: m.tId, name: m.tournamentName, matches: [] });
    byTournament.get(key).matches.push(m);
  }

  const leagueByTournament = new Map(); // tId → leagueId

  for (const [key, group] of byTournament.entries()) {
    const tournamentId = group.tournamentId;
    const tName = group.name ?? 'Amistosos';

    // Check if a polla already exists for this tournament
    let leagueId;

    if (tournamentId) {
      const [existing] = await conn.execute(`
        SELECT l.id, l.name, l.status
        FROM League l
        JOIN LeagueTournament lt ON lt.leagueId = l.id
        WHERE lt.tournamentId = ?
        LIMIT 1
      `, [tournamentId]);

      if (existing.length > 0) {
        leagueId = existing[0].id;
        console.log(`  Polla existente para "${tName}": "${existing[0].name}" [${existing[0].status}]`);

        // Ensure it's ACTIVE
        if (existing[0].status !== 'ACTIVE') {
          await conn.execute("UPDATE League SET status = 'ACTIVE' WHERE id = ?", [leagueId]);
          console.log(`    → Activada.`);
        }
      }
    }

    if (!leagueId) {
      // Create new polla via API
      const pollaName = tournamentId ? `Polla ${tName} 2026` : 'Polla Amistosos 2026';
      console.log(`  Creando polla "${pollaName}"...`);
      try {
        const league = await apiPost('/admin/leagues', {
          name: pollaName,
          privacy: 'PUBLIC',
          maxParticipants: 100,
          includeBaseFee: false,
          baseFee: 0,
          primaryTournamentId: tournamentId ?? undefined,
        }, token);
        leagueId = league.id;
        console.log(`    Creada con id ${leagueId}`);

        // Activate it
        await conn.execute("UPDATE League SET status = 'ACTIVE' WHERE id = ?", [leagueId]);

        // Link tournament
        if (tournamentId) {
          await conn.execute(
            'INSERT IGNORE INTO LeagueTournament (id, leagueId, tournamentId, addedAt) VALUES (UUID(), ?, ?, NOW())',
            [leagueId, tournamentId]
          ).catch(() => {});
          await conn.execute(
            'UPDATE League SET primaryTournamentId = ? WHERE id = ?',
            [tournamentId, leagueId]
          );
        }
      } catch (err) {
        console.warn(`  No se pudo crear polla para "${tName}": ${err.message}`);
        continue;
      }
    }

    // Ensure superadmin is an ACTIVE member
    const [memberCheck] = await conn.execute(
      'SELECT id, status FROM LeagueMember WHERE userId = ? AND leagueId = ?',
      [superadminId, leagueId]
    );
    if (memberCheck.length === 0) {
      await conn.execute(
        "INSERT INTO LeagueMember (id, userId, leagueId, role, status, joinedAt) VALUES (UUID(), ?, ?, 'ADMIN', 'ACTIVE', NOW())",
        [superadminId, leagueId]
      );
      console.log(`    Superadmin agregado como ADMIN.`);
    } else if (memberCheck[0].status !== 'ACTIVE') {
      await conn.execute(
        "UPDATE LeagueMember SET status = 'ACTIVE' WHERE userId = ? AND leagueId = ?",
        [superadminId, leagueId]
      );
      console.log(`    Superadmin activado.`);
    }

    leagueByTournament.set(key, leagueId);
  }

  // 5. Create predictions for all upcoming matches
  console.log('\n[5/5] Creando predicciones...');
  let created = 0, skipped = 0;

  for (const m of upcomingMatches) {
    const key = m.tId ?? '__no_tournament__';
    const leagueId = leagueByTournament.get(key);
    if (!leagueId) { skipped++; continue; }

    const homeScore = randomScore();
    const awayScore = randomScore();

    try {
      // Upsert directly to bypass closing time validation
      await conn.execute(`
        INSERT INTO Prediction (id, userId, matchId, leagueId, homeScore, awayScore, submittedAt, updatedAt)
        VALUES (UUID(), ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE homeScore = VALUES(homeScore), awayScore = VALUES(awayScore), updatedAt = NOW()
      `, [superadminId, m.matchId, leagueId, homeScore, awayScore]);

      console.log(`  ${m.homeTeam} vs ${m.awayTeam}: ${homeScore}-${awayScore}`);
      created++;
    } catch (err) {
      console.warn(`  Error en ${m.homeTeam} vs ${m.awayTeam}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n  Predicciones creadas: ${created}, saltadas: ${skipped}`);

  // Summary
  console.log('\n=== Resumen ===');
  console.log(`Partidos próximos: ${upcomingMatches.length}`);
  console.log(`Pollas activas: ${leagueByTournament.size}`);
  console.log(`Predicciones: ${created}`);
  console.log('\nTodo listo para seguimiento en tiempo real.');

  conn.release();
  await pool.end();
}

main().catch(err => { console.error('\nError fatal:', err.message); process.exit(1); });
