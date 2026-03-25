/**
 * test_email.ts — Prueba la conexión SMTP y envía un correo de muestra
 * Ejecutar: npx ts-node -r dotenv/config prisma/test_email.ts
 */
import 'dotenv/config';
import * as nodemailer from 'nodemailer';

async function main() {
  const host    = process.env.EMAIL_HOST    || process.env.SMTP_HOST || '';
  const port    = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '465', 10);
  const user    = process.env.EMAIL_USER    || process.env.SMTP_USER || '';
  const pass    = process.env.EMAIL_PASS    || process.env.SMTP_PASS || '';
  const from    = process.env.EMAIL_FROM    || '';
  const testTo  = process.env.EMAIL_TEST_TO || from; // Envía a sí mismo si no hay destino

  console.log('\n📧 Configuración SMTP detectada:');
  console.log(`  HOST : ${host || '❌ no definido'}`);
  console.log(`  PORT : ${port}`);
  console.log(`  USER : ${user || '❌ no definido (EMAIL_USER)'}`);
  console.log(`  PASS : ${pass ? '✅ configurado' : '❌ no definido (EMAIL_PASS)'}`);
  console.log(`  FROM : ${from || '❌ no definido'}`);
  console.log(`  TO   : ${testTo}\n`);

  if (!host) { console.error('❌ EMAIL_HOST no configurado'); process.exit(1); }
  if (!from) { console.error('❌ EMAIL_FROM no configurado'); process.exit(1); }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  } as any);

  console.log('🔌 Verificando conexión SMTP...');
  try {
    await transporter.verify();
    console.log('✅ Conexión SMTP exitosa\n');
  } catch (err: any) {
    console.error('❌ Error de conexión SMTP:', err.message);
    console.error('\nPara Hostinger necesitas agregar al .env:');
    console.error('  EMAIL_USER=notificacion@polla.agildesarrollo.com.co');
    console.error('  EMAIL_PASS=<contraseña del correo>\n');
    process.exit(1);
  }

  console.log(`📤 Enviando correo de prueba a ${testTo}...`);
  const result = await transporter.sendMail({
    from,
    to: testTo,
    subject: '✅ Prueba SMTP — Polla Mundial 2026',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px">
        <h2 style="color:#16a34a">✅ Conexión SMTP funcionando</h2>
        <p>Este es un correo de prueba del sistema <strong>Polla Mundial 2026</strong>.</p>
        <p>La configuración de email está correcta y lista para enviar reportes de predicciones.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
        <p style="font-size:12px;color:#6b7280">Enviado desde: ${from}<br>Host: ${host}:${port}</p>
      </div>
    `,
    text: 'Prueba SMTP exitosa — Polla Mundial 2026',
  });

  console.log('✅ Email enviado exitosamente');
  console.log('  messageId:', result.messageId);
  console.log('  accepted:', result.accepted);
}

main().catch(e => { console.error(e.message); process.exit(1); });
