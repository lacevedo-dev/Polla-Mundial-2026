import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'srv813.hstgr.io',
  user: 'u515832100_polla_ui_prod',
  password: 'S0p0rt3**26',
  database: 'u515832100_polla_ui_prod',
});

const API_BASE = 'https://api-polla.agildesarrollo.com.co';

async function main() {
  const conn = await pool.getConnection();

  // 1. Find superadmin user email to authenticate
  const [admins] = await conn.execute(
    "SELECT id, email, name FROM User WHERE systemRole = 'SUPERADMIN' LIMIT 1"
  );
  conn.release();
  await pool.end();

  if (admins.length === 0) {
    console.error('No superadmin found');
    process.exit(1);
  }

  console.log(`\nSuperadmin encontrado: ${admins[0].email} (${admins[0].name})`);
  console.log('\nNecesito la contraseña del superadmin para continuar.');
  console.log('Ejecuta: node import-tomorrow-matches.mjs <password>');

  const password = process.argv[2];
  if (!password) {
    process.exit(0);
  }

  // 2. Login to get JWT
  console.log('\nAutenticando...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: admins[0].email, password }),
  });

  if (!loginRes.ok) {
    const err = await loginRes.text();
    console.error(`Login failed: ${loginRes.status} ${err}`);
    process.exit(1);
  }

  const { access_token } = await loginRes.json();
  console.log('Login OK.');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${access_token}`,
  };

  // 3. Search fixtures for tomorrow
  const date = '2026-03-31';
  console.log(`\nBuscando fixtures para ${date}...`);
  const searchRes = await fetch(`${API_BASE}/admin/football/fixtures/search?date=${date}`, {
    headers,
  });

  if (!searchRes.ok) {
    const err = await searchRes.text();
    console.error(`Search failed: ${searchRes.status} ${err}`);
    process.exit(1);
  }

  const searchData = await searchRes.json();
  const fixtures = searchData.fixtures ?? searchData ?? [];
  console.log(`Fixtures encontrados: ${fixtures.length}`);

  // Filter only not-imported ones
  const toImport = fixtures.filter(f => !f.imported && !f.existsInDb);
  const alreadyIn = fixtures.filter(f => f.imported || f.existsInDb);

  console.log(`  Ya en DB: ${alreadyIn.length}`);
  console.log(`  A importar: ${toImport.length}`);

  if (toImport.length === 0) {
    console.log('\nTodos los partidos ya están importados o no hay nada para ese día.');
    return;
  }

  // Show what we're about to import
  console.log('\nPartidos a importar:');
  toImport.slice(0, 20).forEach(f => {
    const teams = `${f.teams?.home?.name ?? '?'} vs ${f.teams?.away?.name ?? '?'}`;
    const time = f.fixture?.date ? new Date(f.fixture.date).toISOString().slice(11, 16) : '?';
    const league = f.league?.name ?? '?';
    console.log(`  ${time} UTC | ${teams} | ${league}`);
  });
  if (toImport.length > 20) console.log(`  ... y ${toImport.length - 20} más`);

  // 4. Import them
  const fixtureIds = toImport.map(f => f.fixture?.id ?? f.id).filter(Boolean);
  console.log(`\nImportando ${fixtureIds.length} fixtures...`);

  const importRes = await fetch(`${API_BASE}/admin/football/fixtures/import-selection`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fixtureIds, createTeams: true, overwriteExisting: false }),
  });

  if (!importRes.ok) {
    const err = await importRes.text();
    console.error(`Import failed: ${importRes.status} ${err}`);
    process.exit(1);
  }

  const importResult = await importRes.json();
  console.log('\n=== Resultado ===');
  console.log(JSON.stringify(importResult, null, 2));
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
