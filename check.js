async function run() {
  try {
    const r = await fetch('https://api-polla.agildesarrollo.com.co/auth/login', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://tupollamundial.com',
        'Access-Control-Request-Method': 'POST'
      }
    });
    console.log("Status:", r.status);
    r.headers.forEach((v, k) => console.log(k + ": " + v));
  } catch(e) { console.error(e) }
}
run();
