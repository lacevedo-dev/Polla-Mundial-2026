import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type EmailProviderAccount } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProviderCryptoService } from './email-provider-crypto.service';
import type { EmailProviderConfig } from './email-provider-config.service';

export interface CreateEmailProviderAccountInput {
  key: string;
  name: string;
  fromEmail: string;
  fromName?: string;
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  smtpUser?: string;
  smtpPass?: string;
  dailyLimit: number;
  reservedHighPriority: number;
  maxRecipientsPerMessage: number;
  maxEmailSizeMb: number;
  maxAttachmentSizeMb: number;
  active?: boolean;
}

export type UpdateEmailProviderAccountInput = Partial<CreateEmailProviderAccountInput> & {
  smtpPass?: string | null;
};

export interface ListEmailProviderAccountsInput {
  active?: boolean;
  search?: string;
}

type AccountWithUsage = EmailProviderAccount & {
  usageToday?: {
    sentCount: number;
    blockedUntil: Date | null;
    lastError: string | null;
  };
};

@Injectable()
export class EmailProviderAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: EmailProviderCryptoService,
  ) {}

  async listAccounts(filters: ListEmailProviderAccountsInput = {}): Promise<AccountWithUsage[]> {
    const quotaWindowStart = getQuotaWindowStart(new Date());
    const accounts = await this.prisma.emailProviderAccount.findMany({
      where: {
        deletedAt: null,
        ...(typeof filters.active === 'boolean' ? { active: filters.active } : {}),
        ...(filters.search
          ? {
              OR: [
                { key: { contains: filters.search } },
                { name: { contains: filters.search } },
                { fromEmail: { contains: filters.search } },
                { smtpHost: { contains: filters.search } },
              ],
            }
          : {}),
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }, { fromEmail: 'asc' }],
    });

    const usages = await this.prisma.emailProviderUsage.findMany({
      where: {
        providerKey: { in: accounts.map((account) => account.key) },
        quotaWindowStart,
      },
    });

    const usageByKey = new Map(usages.map((usage) => [usage.providerKey, usage]));
    return accounts.map((account) => ({
      ...account,
      usageToday: usageByKey.has(account.key)
        ? {
            sentCount: usageByKey.get(account.key)!.sentCount,
            blockedUntil: usageByKey.get(account.key)!.blockedUntil,
            lastError: usageByKey.get(account.key)!.lastError,
          }
        : undefined,
    }));
  }

  async getAccountOrThrow(id: string): Promise<AccountWithUsage> {
    const quotaWindowStart = getQuotaWindowStart(new Date());
    const existing = await this.prisma.emailProviderAccount.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Cuenta de correo no encontrada');
    }

    const usage = await this.prisma.emailProviderUsage.findUnique({
      where: {
        providerKey_quotaWindowStart: {
          providerKey: existing.key,
          quotaWindowStart,
        },
      },
    });

    return {
      ...existing,
      usageToday: usage
        ? {
            sentCount: usage.sentCount,
            blockedUntil: usage.blockedUntil,
            lastError: usage.lastError,
          }
        : undefined,
    };
  }

  async createAccount(input: CreateEmailProviderAccountInput): Promise<AccountWithUsage> {
    const account = await this.prisma.emailProviderAccount.create({
      data: {
        key: normalizeKey(input.key),
        name: input.name.trim(),
        fromEmail: normalizeEmail(input.fromEmail),
        fromName: input.fromName?.trim() || null,
        smtpHost: input.smtpHost.trim(),
        smtpPort: sanitizeInt(input.smtpPort, 587),
        secure: input.secure,
        smtpUser: input.smtpUser?.trim() || null,
        smtpPassEncrypted: input.smtpPass ? this.cryptoService.encrypt(input.smtpPass.trim()) : null,
        dailyLimit: sanitizeInt(input.dailyLimit, 100),
        reservedHighPriority: sanitizeReserved(input.dailyLimit, input.reservedHighPriority),
        maxRecipientsPerMessage: sanitizeInt(input.maxRecipientsPerMessage, 100),
        maxEmailSizeMb: sanitizeInt(input.maxEmailSizeMb, 35),
        maxAttachmentSizeMb: sanitizeInt(input.maxAttachmentSizeMb, 25),
        active: input.active ?? true,
      },
    });

    return this.getAccountOrThrow(account.id);
  }

  async updateAccount(id: string, input: UpdateEmailProviderAccountInput): Promise<AccountWithUsage> {
    const existing = await this.getAccountOrThrow(id);
    const nextDailyLimit = input.dailyLimit != null ? sanitizeInt(input.dailyLimit, existing.dailyLimit) : existing.dailyLimit;

    const data: Prisma.EmailProviderAccountUpdateInput = {
      ...(input.key ? { key: normalizeKey(input.key) } : {}),
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.fromEmail ? { fromEmail: normalizeEmail(input.fromEmail) } : {}),
      ...(input.fromName !== undefined ? { fromName: input.fromName?.trim() || null } : {}),
      ...(input.smtpHost ? { smtpHost: input.smtpHost.trim() } : {}),
      ...(input.smtpPort != null ? { smtpPort: sanitizeInt(input.smtpPort, existing.smtpPort) } : {}),
      ...(input.secure != null ? { secure: input.secure } : {}),
      ...(input.smtpUser !== undefined ? { smtpUser: input.smtpUser?.trim() || null } : {}),
      ...(input.dailyLimit != null ? { dailyLimit: nextDailyLimit } : {}),
      ...(input.reservedHighPriority != null
        ? { reservedHighPriority: sanitizeReserved(nextDailyLimit, input.reservedHighPriority) }
        : {}),
      ...(input.maxRecipientsPerMessage != null
        ? { maxRecipientsPerMessage: sanitizeInt(input.maxRecipientsPerMessage, existing.maxRecipientsPerMessage) }
        : {}),
      ...(input.maxEmailSizeMb != null ? { maxEmailSizeMb: sanitizeInt(input.maxEmailSizeMb, existing.maxEmailSizeMb) } : {}),
      ...(input.maxAttachmentSizeMb != null
        ? { maxAttachmentSizeMb: sanitizeInt(input.maxAttachmentSizeMb, existing.maxAttachmentSizeMb) }
        : {}),
      ...(input.active != null ? { active: input.active } : {}),
      ...(input.smtpPass !== undefined
        ? {
            smtpPassEncrypted: input.smtpPass
              ? this.cryptoService.encrypt(input.smtpPass.trim())
              : null,
          }
        : {}),
    };

    await this.prisma.emailProviderAccount.update({
      where: { id },
      data,
    });

    return this.getAccountOrThrow(id);
  }

  async activateAccount(id: string): Promise<AccountWithUsage> {
    return this.updateAccount(id, { active: true });
  }

  async deactivateAccount(id: string): Promise<AccountWithUsage> {
    return this.updateAccount(id, { active: false });
  }

  async removeAccount(id: string): Promise<{ id: string; deletedAt: Date }> {
    const existing = await this.getAccountOrThrow(id);
    const deletedAt = new Date();
    await this.prisma.emailProviderAccount.update({
      where: { id: existing.id },
      data: {
        active: false,
        deletedAt,
      },
    });

    return { id: existing.id, deletedAt };
  }

  async getProviderConfigs(): Promise<EmailProviderConfig[]> {
    const accounts = await this.prisma.emailProviderAccount.findMany({
      where: {
        deletedAt: null,
        active: true,
      },
      orderBy: [{ lastUsedAt: 'asc' }, { createdAt: 'asc' }],
    });

    return accounts.flatMap((account) => {
      try {
        const decryptedPass = this.cryptoService.decrypt(account.smtpPassEncrypted);
        return [{
          key: account.key,
          fromEmail: account.fromEmail,
          fromName: account.fromName ?? undefined,
          host: account.smtpHost,
          port: account.smtpPort,
          secure: account.secure,
          user: account.smtpUser ?? undefined,
          pass: decryptedPass,
          dailyLimit: account.dailyLimit,
          reservedHighPriority: account.reservedHighPriority,
          active: account.active,
          maxRecipientsPerMessage: account.maxRecipientsPerMessage,
          maxEmailSizeMb: account.maxEmailSizeMb,
          maxAttachmentSizeMb: account.maxAttachmentSizeMb,
          blockedUntil: account.blockedUntil ?? undefined,
          cacheKey: `${account.key}:${account.updatedAt.getTime()}`,
        }];
      } catch (error) {
        this.logger.error(
          `Failed to decrypt password for provider ${account.key} (${account.fromEmail}): ${error instanceof Error ? error.message : String(error)}`
        );
        return [];
      }
    });
  }

  toAdminView(account: AccountWithUsage) {
    return {
      id: account.id,
      key: account.key,
      name: account.name,
      fromEmail: account.fromEmail,
      fromName: account.fromName,
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      secure: account.secure,
      smtpUser: account.smtpUser,
      hasPassword: !!account.smtpPassEncrypted,
      dailyLimit: account.dailyLimit,
      reservedHighPriority: account.reservedHighPriority,
      maxRecipientsPerMessage: account.maxRecipientsPerMessage,
      maxEmailSizeMb: account.maxEmailSizeMb,
      maxAttachmentSizeMb: account.maxAttachmentSizeMb,
      active: account.active,
      blockedUntil: account.blockedUntil,
      lastUsedAt: account.lastUsedAt,
      lastError: account.lastError,
      deletedAt: account.deletedAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      usageToday: account.usageToday ?? {
        sentCount: 0,
        blockedUntil: null,
        lastError: null,
      },
    };
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function sanitizeInt(value: number, fallback: number): number {
  const parsed = Number.isFinite(value) ? Math.trunc(value) : fallback;
  return parsed > 0 ? parsed : fallback;
}

function sanitizeReserved(dailyLimit: number, reservedHighPriority: number | undefined): number {
  const safeDailyLimit = sanitizeInt(dailyLimit, 100);
  const reserved = sanitizeInt(reservedHighPriority ?? 60, 60);
  return Math.min(safeDailyLimit, reserved);
}

function getQuotaWindowStart(date: Date): Date {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const bogota = new Date(date.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const offset = utc.getTime() - bogota.getTime();
  const start = new Date(date.getTime() - offset);
  start.setHours(0, 0, 0, 0);
  return new Date(start.getTime() + offset);
}
