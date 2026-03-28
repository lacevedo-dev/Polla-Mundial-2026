import 'dotenv/config';

import { EmailJobPriority, EmailJobType } from '@prisma/client';
import * as nodemailer from 'nodemailer';

import { EmailProviderAccountsService } from '../src/email/email-provider-accounts.service';
import { EmailProviderConfigService } from '../src/email/email-provider-config.service';
import type { EmailProviderConfig } from '../src/email/email-provider-config.service';
import { EmailProviderCryptoService } from '../src/email/email-provider-crypto.service';
import { EmailQueueService } from '../src/email/email-queue.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const requestedProviderKey = (process.env.EMAIL_TEST_PROVIDER_KEY || 'default').trim();
  const testRecipient = (process.env.EMAIL_TEST_TO || process.env.EMAIL_FROM || '').trim().toLowerCase();
  if (!testRecipient) {
    throw new Error('EMAIL_TEST_TO or EMAIL_FROM is required to run the SMTP smoke test safely.');
  }

  const prisma = new PrismaService();
  const crypto = new EmailProviderCryptoService();
  const accounts = new EmailProviderAccountsService(prisma, crypto);
  const providerConfig = new EmailProviderConfigService(accounts);
  const emailQueue = new EmailQueueService(prisma, providerConfig);

  const providers = await providerConfig.getProviders();
  const selectedProvider = providers.find((provider) => provider.key === requestedProviderKey);
  if (!selectedProvider) {
    throw new Error(`Active SMTP provider "${requestedProviderKey}" was not found in DB/env config.`);
  }

  console.log('[smoke] Selected provider:');
  console.log(
    JSON.stringify(
      {
        key: selectedProvider.key,
        fromEmail: selectedProvider.fromEmail,
        user: selectedProvider.user,
        host: selectedProvider.host,
        port: selectedProvider.port,
        secure: selectedProvider.secure,
        blockedUntil: selectedProvider.blockedUntil ?? null,
      },
      null,
      2,
    ),
  );

  const verifyResult = await verifyProviderHandshake(selectedProvider);
  console.log(`[smoke] Handshake verify: ${JSON.stringify(verifyResult)}`);

  const dedupeKey = `smtp-smoke:${selectedProvider.key}:${new Date().toISOString()}:${Math.random().toString(36).slice(2, 8)}`;
  const subject = 'SMTP smoke test - Polla Mundial 2026';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 12px;color:#111827">SMTP smoke test</h2>
      <p style="margin:0 0 8px;color:#374151">
        Este correo confirma que la cola DB-backed puede seleccionar un proveedor SMTP activo y despachar un email real.
      </p>
      <p style="margin:0;color:#6b7280;font-size:12px">
        Provider: ${selectedProvider.key}<br />
        Recipient: ${testRecipient}<br />
        Dedupe key: ${dedupeKey}
      </p>
    </div>
  `.trim();
  const text = `SMTP smoke test\nProvider: ${selectedProvider.key}\nRecipient: ${testRecipient}\nDedupe key: ${dedupeKey}`;

  console.log(`[smoke] Queueing test email for ${testRecipient}`);

  const enqueued = await emailQueue.enqueueEmail({
    type: EmailJobType.MATCH_REMINDER,
    priority: EmailJobPriority.HIGH,
    required: true,
    recipientEmail: testRecipient,
    subject,
    html,
    text,
    dedupeKey,
  });

  console.log(`[smoke] Enqueued: ${enqueued}`);

  const queuedJob = await prisma.emailJob.findUniqueOrThrow({
    where: { dedupeKey },
    select: { id: true },
  });

  const dispatchResult = await emailQueue.dispatchJobById(queuedJob.id, {
    providerKey: selectedProvider.key,
  });
  console.log(
    `[smoke] Dispatch result: ${JSON.stringify({
      processed: dispatchResult.processed,
      sent: dispatchResult.sent,
      status: dispatchResult.job.status,
      providerKey: dispatchResult.job.providerKey,
      lastError: dispatchResult.job.lastError,
    })}`,
  );

  const job = await prisma.emailJob.findUniqueOrThrow({
    where: { dedupeKey },
  });

  const quotaWindowStart = getQuotaWindowStart(new Date());
  const usage = job.providerKey
    ? await prisma.emailProviderUsage.findUnique({
        where: {
          providerKey_quotaWindowStart: {
            providerKey: job.providerKey,
            quotaWindowStart,
          },
        },
      })
    : null;

  const providerAccount = await prisma.emailProviderAccount.findFirst({
    where: { key: selectedProvider.key, deletedAt: null },
    select: {
      key: true,
      fromEmail: true,
      smtpUser: true,
      active: true,
      blockedUntil: true,
      lastError: true,
      lastUsedAt: true,
    },
  });

  const payload = {
    recipientEmail: job.recipientEmail,
    status: job.status,
    providerKey: job.providerKey,
    sentAt: job.sentAt,
    lastError: job.lastError,
    attemptCount: job.attemptCount,
    providerAccount,
    usage: usage
      ? {
          providerKey: usage.providerKey,
          sentCount: usage.sentCount,
          blockedUntil: usage.blockedUntil,
          lastError: usage.lastError,
        }
      : null,
  };

  console.log('[smoke] Final DB state:');
  console.log(JSON.stringify(payload, null, 2));

  await prisma.onModuleDestroy();

  if (job.lastError) {
    throw new Error(job.lastError);
  }
}

async function verifyProviderHandshake(provider: EmailProviderConfig): Promise<{ ok: boolean; error?: string }> {
  const transporter = nodemailer.createTransport({
    host: provider.host,
    port: provider.port,
    secure: provider.secure,
    auth: provider.user && provider.pass ? { user: provider.user, pass: provider.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    transporter.close();
  }
}

function getQuotaWindowStart(date: Date): Date {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const bogota = new Date(date.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const offset = utc.getTime() - bogota.getTime();
  const start = new Date(date.getTime() - offset);
  start.setHours(0, 0, 0, 0);
  return new Date(start.getTime() + offset);
}

main().catch((error) => {
  console.error(`[smoke] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
