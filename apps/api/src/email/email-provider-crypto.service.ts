import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

@Injectable()
export class EmailProviderCryptoService {
  hasEncryptionKey(): boolean {
    return !!this.getRawKey();
  }

  encrypt(value: string): string {
    const rawKey = this.getRawKey();
    if (!rawKey) {
      throw new Error('EMAIL_PROVIDER_ENCRYPTION_KEY is required to store SMTP passwords in the database.');
    }

    const key = this.deriveKey(rawKey);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
  }

  decrypt(value: string | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const rawKey = this.getRawKey();
    if (!rawKey) {
      throw new Error('EMAIL_PROVIDER_ENCRYPTION_KEY is required to decrypt SMTP passwords from the database.');
    }

    const [ivBase64, authTagBase64, encryptedBase64] = value.split(':');
    if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
      throw new Error('Stored SMTP password has an invalid encrypted format.');
    }

    const key = this.deriveKey(rawKey);
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  private getRawKey(): string | undefined {
    const value = process.env.EMAIL_PROVIDER_ENCRYPTION_KEY?.trim();
    return value ? value : undefined;
  }

  private deriveKey(rawKey: string): Buffer {
    return createHash('sha256').update(rawKey).digest();
  }
}
