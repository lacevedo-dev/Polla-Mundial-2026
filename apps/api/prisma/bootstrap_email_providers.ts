import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { EmailProviderCryptoService } from '../src/email/email-provider-crypto.service';
import {
  resolveEmailProviderConfigsFromEnv,
  type EmailProviderConfig,
} from '../src/email/email-provider-config.service';

const APPLY = process.argv.includes('--apply');

function buildMariaConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL no está configurada.');
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 2,
    minimumIdle: 1,
    acquireTimeout: 30000,
  };
}

function buildDisplayName(provider: EmailProviderConfig): string {
  return provider.fromName?.trim() || `SMTP ${provider.fromEmail}`;
}

async function main() {
  const providers = resolveEmailProviderConfigsFromEnv(process.env);
  if (providers.length === 0) {
    console.log('[smtp-bootstrap] No se encontraron proveedores SMTP válidos en el entorno.');
    return;
  }

  const crypto = new EmailProviderCryptoService();
  if (!crypto.hasEncryptionKey()) {
    throw new Error('EMAIL_PROVIDER_ENCRYPTION_KEY es requerido para importar cuentas SMTP a DB.');
  }

  console.log(`[smtp-bootstrap] Proveedores detectados en entorno: ${providers.length}`);
  console.log(APPLY ? '[smtp-bootstrap] Modo apply' : '[smtp-bootstrap] Modo dry-run');

  const adapter = new PrismaMariaDb(buildMariaConfig());
  const prisma = new PrismaClient({ adapter });

  try {
    let imported = 0;
    let updated = 0;
    let skippedWithoutPassword = 0;

    for (const provider of providers) {
      const existing = await prisma.emailProviderAccount.findUnique({
        where: { key: provider.key },
        select: { id: true, smtpPassEncrypted: true },
      });

      const encryptedPassword = provider.pass?.trim()
        ? crypto.encrypt(provider.pass.trim())
        : existing?.smtpPassEncrypted ?? null;

      if (!encryptedPassword) {
        skippedWithoutPassword += 1;
        console.log(`[smtp-bootstrap] Skip ${provider.key}: no hay contraseña SMTP disponible.`);
        continue;
      }

      const payload = {
        key: provider.key,
        name: buildDisplayName(provider),
        fromEmail: provider.fromEmail,
        fromName: provider.fromName ?? null,
        smtpHost: provider.host,
        smtpPort: provider.port,
        secure: provider.secure,
        smtpUser: provider.user ?? null,
        smtpPassEncrypted: encryptedPassword,
        dailyLimit: provider.dailyLimit,
        reservedHighPriority: provider.reservedHighPriority,
        maxRecipientsPerMessage: provider.maxRecipientsPerMessage,
        maxEmailSizeMb: provider.maxEmailSizeMb,
        maxAttachmentSizeMb: provider.maxAttachmentSizeMb,
        active: provider.active,
        deletedAt: null,
      };

      console.log(
        `[smtp-bootstrap] ${existing ? 'UPDATE' : 'CREATE'} ${provider.key} -> ${provider.fromEmail} (${provider.host}:${provider.port})`,
      );

      if (!APPLY) {
        continue;
      }

      await prisma.emailProviderAccount.upsert({
        where: { key: provider.key },
        create: payload,
        update: payload,
      });

      if (existing) {
        updated += 1;
      } else {
        imported += 1;
      }
    }

    console.log(
      `[smtp-bootstrap] Resultado: created=${imported} updated=${updated} skippedWithoutPassword=${skippedWithoutPassword}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[smtp-bootstrap] Error:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
