import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'srv813.hstgr.io',
  user: 'u515832100_polla_ui_prod',
  password: 'S0p0rt3**26',
  database: 'u515832100_polla_ui_prod',
});

async function check() {
  const conn = await pool.getConnection();

  // Extract just the chunk around fixture 1502256 using SQL SUBSTRING + LOCATE
  const [rows] = await conn.execute(`
    SELECT
      createdAt,
      SUBSTRING(
        responseBody,
        GREATEST(1, LOCATE('"id":1502256', responseBody) - 200),
        800
      ) AS chunk
    FROM ApiFootballRequest
    WHERE responseBody LIKE '%"id":1502256%'
    ORDER BY createdAt DESC
    LIMIT 1
  `);

  if (rows.length === 0) {
    console.log('No API response found with fixture 1502256');
  } else {
    console.log(`\nResponse from: ${new Date(rows[0].createdAt).toISOString()}`);
    console.log('\n=== Chunk around fixture 1502256 ===');
    console.log(rows[0].chunk);
  }

  conn.release();
  await pool.end();
}

check().catch(err => { console.error('Error:', err.message); process.exit(1); });
