/**
 * Re-encripta la contraseña SMTP de los EmailProviderAccount usando la clave de api-corp.
 *
 * Uso:
 *   $env:EMAIL_PROVIDER_ENCRYPTION_KEY="tu-clave"; node apps/api-corp/scripts/reencrypt-providers.mjs "tu-password-smtp"
 *
 * Esto genera el UPDATE SQL listo para ejecutar en la BD corporativa.
 */

import { createCipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function encrypt(plaintext, rawKey) {
  const key = createHash('sha256').update(rawKey).digest();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

const encKey = process.env.EMAIL_PROVIDER_ENCRYPTION_KEY?.trim();
if (!encKey) {
  console.error('ERROR: Variable EMAIL_PROVIDER_ENCRYPTION_KEY no está definida.');
  console.error('Uso: $env:EMAIL_PROVIDER_ENCRYPTION_KEY="tu-clave"; node apps/api-corp/scripts/reencrypt-providers.mjs "smtp-password"');
  process.exit(1);
}

const smtpPass = process.argv[2];
if (!smtpPass) {
  console.error('ERROR: Debes pasar la contraseña SMTP como argumento.');
  console.error('Uso: $env:EMAIL_PROVIDER_ENCRYPTION_KEY="tu-clave"; node apps/api-corp/scripts/reencrypt-providers.mjs "smtp-password"');
  process.exit(1);
}

const keyFingerprint = createHash('sha256').update(encKey).digest('hex').slice(0, 16);
console.log(`KEY_FINGERPRINT : ${keyFingerprint}  (keyLength=${encKey.length})`);

const encryptedValue = encrypt(smtpPass, encKey);
console.log(`smtpPassEncrypted: ${encryptedValue}`);
console.log('');
console.log('-- SQL: pegar y ejecutar en la BD CORPORATIVA (u875522599_polla_corp)');
console.log('-- Actualiza los 21 proveedores con la nueva contraseña encriptada');
console.log(`UPDATE \`EmailProviderAccount\` SET \`smtpPassEncrypted\` = '${encryptedValue}' WHERE \`deletedAt\` IS NULL;`);
