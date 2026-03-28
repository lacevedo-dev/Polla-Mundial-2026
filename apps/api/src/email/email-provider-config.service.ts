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

export interface EmailProviderConfigInput {
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

interface WarnLogger {
  warn(message: string): void;
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
      providers.push(...resolveEmailProviderConfigsFromEnv(process.env, this.logger));
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
    return parseProvidersFromNamedEnv(process.env);
  }

  private parseProvidersFromJson(): EmailProviderConfig[] {
    return parseProvidersFromJson(process.env, this.logger);
  }

  private buildDefaultProvider(): EmailProviderConfig | null {
    return buildDefaultProvider(process.env);
  }

  private normalizeProvider(input: EmailProviderConfigInput, fallbackKey: string): EmailProviderConfig | null {
    return normalizeProvider(input, fallbackKey);
  }
}

export function resolveEmailProviderConfigsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  logger?: WarnLogger,
): EmailProviderConfig[] {
  const providers: EmailProviderConfig[] = [];
  providers.push(...parseProvidersFromNamedEnv(env));
  providers.push(...parseProvidersFromJson(env, logger));

  const defaultProvider = buildDefaultProvider(env);
  if (defaultProvider && !providers.some((provider) => provider.key === defaultProvider.key)) {
    providers.push(defaultProvider);
  }

  return providers.filter((provider) => provider.active);
}

export function parseProvidersFromNamedEnv(env: NodeJS.ProcessEnv = process.env): EmailProviderConfig[] {
  const keys = (env.EMAIL_PROVIDER_KEYS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return keys
    .map((key) => {
      const upperKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      return normalizeProvider(
        {
          key,
          fromEmail: env[`EMAIL_PROVIDER_${upperKey}_FROM`],
          fromName: env[`EMAIL_PROVIDER_${upperKey}_FROM_NAME`] ?? env.EMAIL_FROM_NAME,
          host: env[`EMAIL_PROVIDER_${upperKey}_HOST`] ?? env.EMAIL_HOST ?? env.SMTP_HOST,
          port: env[`EMAIL_PROVIDER_${upperKey}_PORT`] ?? env.EMAIL_PORT ?? env.SMTP_PORT ?? 587,
          secure:
            readBoolean(env[`EMAIL_PROVIDER_${upperKey}_SECURE`], undefined)
            ?? readBoolean(env.EMAIL_SECURE, undefined),
          user: env[`EMAIL_PROVIDER_${upperKey}_USER`],
          pass: env[`EMAIL_PROVIDER_${upperKey}_PASS`],
          dailyLimit: parseInteger(env[`EMAIL_PROVIDER_${upperKey}_DAILY_LIMIT`], 100),
          reservedHighPriority: parseInteger(env[`EMAIL_PROVIDER_${upperKey}_RESERVED_HIGH_PRIORITY`], 60),
          active: readBoolean(env[`EMAIL_PROVIDER_${upperKey}_ACTIVE`], true),
          maxRecipientsPerMessage: parseInteger(env[`EMAIL_PROVIDER_${upperKey}_MAX_RECIPIENTS`], 100),
          maxEmailSizeMb: parseInteger(env[`EMAIL_PROVIDER_${upperKey}_MAX_EMAIL_SIZE_MB`], 35),
          maxAttachmentSizeMb: parseInteger(env[`EMAIL_PROVIDER_${upperKey}_MAX_ATTACHMENT_SIZE_MB`], 25),
        },
        key,
      );
    })
    .filter((provider): provider is EmailProviderConfig => provider !== null);
}

export function parseProvidersFromJson(
  env: NodeJS.ProcessEnv = process.env,
  logger?: WarnLogger,
): EmailProviderConfig[] {
  const raw = env.EMAIL_PROVIDER_ACCOUNTS_JSON?.trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as EmailProviderConfigInput[];
    if (!Array.isArray(parsed)) {
      logger?.warn('EMAIL_PROVIDER_ACCOUNTS_JSON must be a JSON array; ignoring value.');
      return [];
    }

    return parsed
      .map((provider, index) => normalizeProvider(provider, `provider-${index + 1}`))
      .filter((provider): provider is EmailProviderConfig => provider !== null);
  } catch (error) {
    logger?.warn(`Failed to parse EMAIL_PROVIDER_ACCOUNTS_JSON: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export function buildDefaultProvider(env: NodeJS.ProcessEnv = process.env): EmailProviderConfig | null {
  const host = env.EMAIL_HOST || env.SMTP_HOST;
  if (!host?.trim()) {
    return null;
  }

  return normalizeProvider(
    {
      key: 'default',
      fromEmail: env.EMAIL_FROM || env.SMTP_FROM || env.EMAIL_USER || env.SMTP_USER,
      fromName: env.EMAIL_FROM_NAME || 'Polla Mundial 2026',
      host,
      port: env.EMAIL_PORT || env.SMTP_PORT || 587,
      secure: (env.EMAIL_SECURE || '').toLowerCase() === 'true',
      user: env.EMAIL_USER || env.SMTP_USER,
      pass: env.EMAIL_PASS || env.SMTP_PASS,
      dailyLimit: parseInteger(env.EMAIL_DAILY_LIMIT, 100),
      reservedHighPriority: parseInteger(env.EMAIL_RESERVED_HIGH_PRIORITY, 60),
      active: true,
      maxRecipientsPerMessage: parseInteger(env.EMAIL_MAX_RECIPIENTS, 100),
      maxEmailSizeMb: parseInteger(env.EMAIL_MAX_EMAIL_SIZE_MB, 35),
      maxAttachmentSizeMb: parseInteger(env.EMAIL_MAX_ATTACHMENT_SIZE_MB, 25),
    },
    'default',
  );
}

export function normalizeProvider(input: EmailProviderConfigInput, fallbackKey: string): EmailProviderConfig | null {
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
