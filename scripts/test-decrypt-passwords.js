/**
 * Script para diagnosticar problemas de desencriptación de contraseñas SMTP
 *
 * Uso:
 * node scripts/test-decrypt-passwords.js
 */

const { createHash, createDecipheriv } = require('crypto');

// Valores de ejemplo de la BD
const ENCRYPTED_VALUE = 'jUs8dNAVhR6HWyrD:nqhllHGG4tDsinMr3/mvCw==:3oQ5r4cl...';
const ENCRYPTION_KEY_1 = '82f151dca8a292ae9da6d07574976e0816ece11ae1cbe2a00e5c6aa5ea837061';
const ENCRYPTION_KEY_2 = 'wczE7K7W0wN1nXc86kg4Y1QsiirKEBileFBmyOEio7w=';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function deriveKey(rawKey) {
  return createHash('sha256').update(rawKey).digest();
}

function decrypt(value, rawKey) {
  if (!value) {
    throw new Error('No value to decrypt');
  }

  const [ivBase64, authTagBase64, encryptedBase64] = value.split(':');
  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted format');
  }

  try {
    const key = deriveKey(rawKey);
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

console.log('='.repeat(80));
console.log('TEST DE DESENCRIPTACIÓN DE CONTRASEÑAS SMTP');
console.log('='.repeat(80));
console.log('');

console.log('Valor encriptado de la BD:');
console.log(ENCRYPTED_VALUE);
console.log('');

// Intentar con la primera clave
console.log('--- INTENTO 1: Clave hexadecimal ---');
console.log(`Clave: ${ENCRYPTION_KEY_1.substring(0, 20)}...`);
try {
  const result = decrypt(ENCRYPTED_VALUE, ENCRYPTION_KEY_1);
  console.log('✅ ÉXITO: Desencriptado correctamente');
  console.log(`Contraseña: ${result}`);
} catch (error) {
  console.log('❌ ERROR:', error.message);
}
console.log('');

// Intentar con la segunda clave
console.log('--- INTENTO 2: Clave base64 ---');
console.log(`Clave: ${ENCRYPTION_KEY_2.substring(0, 20)}...`);
try {
  const result = decrypt(ENCRYPTED_VALUE, ENCRYPTION_KEY_2);
  console.log('✅ ÉXITO: Desencriptado correctamente');
  console.log(`Contraseña: ${result}`);
} catch (error) {
  console.log('❌ ERROR:', error.message);
}
console.log('');

console.log('='.repeat(80));
console.log('NOTAS:');
console.log('- En tu .env hay DOS claves EMAIL_PROVIDER_ENCRYPTION_KEY duplicadas');
console.log('- Node.js usa la ÚLTIMA aparición de una variable de entorno');
console.log('- Si las contraseñas se encriptaron con una clave diferente a la actual,');
console.log('  NO se podrán desencriptar.');
console.log('');
console.log('SOLUCIÓN:');
console.log('1. Elimina la clave duplicada del .env (deja solo UNA)');
console.log('2. Usa el endpoint /re-encrypt-passwords para re-encriptar todas las contraseñas');
console.log('3. Reinicia el servidor');
console.log('='.repeat(80));
