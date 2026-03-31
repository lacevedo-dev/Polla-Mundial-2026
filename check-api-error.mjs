import https from 'https';

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000);
    req.end();
  });
}

async function check() {
  console.log('\n🔍 Testing API endpoint...\n');
  
  try {
    const response = await makeRequest({
      hostname: 'api-polla.agildesarrollo.com.co',
      path: '/health',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test'
      }
    });
    
    console.log('GET /health:');
    console.log(`  Status: ${response.status}`);
    console.log(`  Body: ${response.body.substring(0, 200)}\n`);
  } catch (err) {
    console.error('❌ Health check failed:', err.message);
  }
  
  process.exit(0);
}

check();
