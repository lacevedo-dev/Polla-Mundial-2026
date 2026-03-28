import { Injectable, Logger } from '@nestjs/common';
import { EmailProviderAccountsService } from './email-provider-accounts.service';

export interface EmailProviderConfig {
  key: string;
  fromEmail: string;
  fromName?: string;
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  dailyLimit: number;
  reservedHighPriority: number;
  active: boolean;
  maxRecipientsPerMessage: number;
  maxEmailSizeMb: number;
  maxAttachmentSizeMb: number;
  blockedUntil?: Date;
  cacheKey: string;
}

interface EmailProviderConfigInput {
  key?: string;
  fromEmail?: string;
  fromName?: string;
  host?: string;
  port?: number | string;
  secure?: boolean;
  user?: string;
  pass?: string;
  dailyLimit?: number;
  reservedHighPriority?: number;
  active?: boolean;
  maxRecipientsPerMessage?: number;
  maxEmailSizeMb?: number;
  maxAttachmentSizeMb?: number;
}

@Injectable()
export class EmailProviderConfigService {
  private static readonly CACHE_TTL_MS = 30_000;
  private readonly logger = new Logger(EmailProviderConfigService.name);
  private cachedProviders: EmailProviderConfig[] | null = null;
  private cachedAt = 0;

  constructor(private readonly emailProviderAccountsService: EmailProviderAccountsService) {}

  async getProviders(): Promise<EmailProviderConfig[]> {
    const now = Date.now();
    if (this.cachedProviders && now - this.cachedAt < EmailProviderConfigService.CACHE_TTL_MS) {
      return this.cachedProviders;
    }

    const databaseProviders = await this.emailProviderAccountsService.getProviderConfigs();
    const providers: EmailProviderConfig[] = [...databaseProviders];

    if (providers.length === 0) {
      providers.push(...this.parseProvidersFromNamedEnv());
      providers.push(...this.parseProvidersFromJson());

      const defaultProvider = this.buildDefaultProvider();
      if (defaultProvider && !providers.some((provider) => provider.key === defaultProvider.key)) {
        providers.push(defaultProvider);
      }
    }

    this.cachedProviders = providers.filter((provider) => provider.active);
    this.cachedAt = now;
    return this.cachedProviders;
  }

  invalidateCache(): void {
    this.cachedProviders = null;
    this.cachedAt = 0;
  }

  private parseProvidersFromNamedEnv(): EmailProviderConfig[] {
    const keys = (process.env.EMAIL_PROVIDER_KEYS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    return keys
      .map((key) => {
        const upperKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        return this.normalizeProvider(
          {
            key,
            fromEmail: process.env[`EMAIL_PROVIDER_${upperKey}_FROM`],
            fromName: process.env[`EMAIL_PROVIDER_${upperKey}_FROM_NAME`] ?? process.env.EMAIL_FROM_NAME,
            host: process.env[`EMAIL_PROVIDER_${upperKey}_HOST`] ?? process.env.EMAIL_HOST ?? process.env.SMTP_HOST,
            port: process.env[`EMAIL_PROVIDER_${upperKey}_PORT`] ?? process.env.EMAIL_PORT ?? process.env.SMTP_PORT ?? 587,
            secure:
              readBoolean(process.env[`EMAIL_PROVIDER_${upperKey}_SECURE`], undefined)
              ?? readBoolean(process.env.EMAIL_SECURE, undefined),
            user: process.env[`EMAIL_PROVIDER_${upperKey}_USER`],
            pass: process.env[`EMAIL_PROVIDER_${upperKey}_PASS`],
            dailyLimit: parseInteger(process.env[`EMAIL_PROVIDER_${upperKey}_DAILY_LIMIT`], 100),
            reservedHighPriority: parseInteger(process.env[`EMAIL_PROVIDER_${upperKey}_RESERVED_HIGH_PRIORITY`], 60),
            active: readBoolean(process.env[`EMAIL_PROVIDER_${upperKey}_ACTIVE`], true),
            maxRecipientsPerMessage: parseInteger(process.env[`EMAIL_PROVIDER_${upperKey}_MAX_RECIPIENTS`], 100),
            maxEmailSizeMb: parseInteger(process.env[`EMAIL_PROVIDER_${upperKey}_MAX_EMAIL_SIZE_MB`], 35),
            maxAttachmentSizeMb: parseInteger(process.env[`EMAIL_PROVIDER_${upperKey}_MAX_ATTACHMENT_SIZE_MB`], 25),
          },
          key,
        );
      })
      .filter((provider): provider is EmailProviderConfig => provider !== null);
  }

  private parseProvidersFromJson(): EmailProviderConfig[] {
    const raw = process.env.EMAIL_PROVIDER_ACCOUNTS_JSON?.trim();
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as EmailProviderConfigInput[];
      if (!Array.isArray(parsed)) {
        this.logger.warn('EMAIL_PROVIDER_ACCOUNTS_JSON must be a JSON array; ignoring value.');
        return [];
      }

      return parsed
        .map((provider, index) => this.normalizeProvider(provider, `provider-${index + 1}`))
        .filter((provider): provider is EmailProviderConfig => provider !== null);
    } catch (error) {
      this.logger.warn(`Failed to parse EMAIL_PROVIDER_ACCOUNTS_JSON: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private buildDefaultProvider(): EmailProviderConfig | null {
    const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
    if (!host?.trim()) {
      return null;
    }

    return this.normalizeProvider(
      {
        key: 'default',
        fromEmail: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.EMAIL_USER || process.env.SMTP_USER,
        fromName: process.env.EMAIL_FROM_NAME || 'Polla Mundial 2026',
        host,
        port: process.env.EMAIL_PORT || process.env.SMTP_PORT || 587,
        secure: (process.env.EMAIL_SECURE || '').toLowerCase() === 'true',
        user: process.env.EMAIL_USER || process.env.SMTP_USER,
        pass: process.env.EMAIL_PASS || process.env.SMTP_PASS,
        dailyLimit: parseInteger(process.env.EMAIL_DAILY_LIMIT, 100),
        reservedHighPriority: parseInteger(process.env.EMAIL_RESERVED_HIGH_PRIORITY, 60),
        active: true,
        maxRecipientsPerMessage: parseInteger(process.env.EMAIL_MAX_RECIPIENTS, 100),
        maxEmailSizeMb: parseInteger(process.env.EMAIL_MAX_EMAIL_SIZE_MB, 35),
        maxAttachmentSizeMb: parseInteger(process.env.EMAIL_MAX_ATTACHMENT_SIZE_MB, 25),
      },
      'default',
    );
  }

  private normalizeProvider(input: EmailProviderConfigInput, fallbackKey: string): EmailProviderConfig | null {
    const host = input.host?.trim();
    const fromEmail = input.fromEmail?.trim();
    if (!host || !fromEmail) {
      return null;
    }

    const port = parseInteger(input.port, 587);
    const secure = typeof input.secure === 'boolean' ? input.secure : port === 465;
    const dailyLimit = Math.max(1, parseInteger(input.dailyLimit, 100));
    const reservedHighPriority = Math.min(dailyLimit, Math.max(0, parseInteger(input.reservedHighPriority, 60)));
    const key = input.key?.trim() || fallbackKey;

    return {
      key,
      fromEmail,
      fromName: input.fromName?.trim() || undefined,
      host,
      port,
      secure,
      user: input.user?.trim() || undefined,
      pass: input.pass?.trim() || undefined,
      dailyLimit,
      reservedHighPriority,
      active: input.active ?? true,
      maxRecipientsPerMessage: Math.max(1, parseInteger(input.maxRecipientsPerMessage, 100)),
      maxEmailSizeMb: Math.max(1, parseInteger(input.maxEmailSizeMb, 35)),
      maxAttachmentSizeMb: Math.max(1, parseInteger(input.maxAttachmentSizeMb, 25)),
      cacheKey: key,
    };
  }
}

function parseInteger(value: number | string | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean | undefined): boolean | undefined {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}
