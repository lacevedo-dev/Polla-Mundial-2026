import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { serializeSystemConfigValue, parseSystemConfigValue } from '../system-config/system-config.util';
import { DEFAULT_STICKER_PROMPT_TEMPLATE } from './stickers-prompt.util';
import {
  DEFAULT_STICKER_AI_MODEL,
  normalizeStickerAiModel,
  STICKER_AI_MODEL_OPTIONS,
  type StickerAiModelId,
} from './sticker-ai-config.util';

export { STICKER_AI_MODEL_OPTIONS, DEFAULT_STICKER_AI_MODEL } from './sticker-ai-config.util';

export const STICKER_AI_CONFIG_KEY = 'sticker_ai_config';

export type StickerAiQuality = 'low' | 'medium' | 'high' | 'auto';

export type StickerAiConfigStored = {
  apiKeys: string[];
  activeKeyIndex: number;
  model: string;
  quality: StickerAiQuality;
  systemPrompt: string;
};

export type StickerAiConfigAdmin = {
  apiKeys: string[];
  activeKeyIndex: number;
  model: StickerAiModelId;
  quality: StickerAiQuality;
  systemPrompt: string;
  defaultSystemPrompt: string;
  envApiKeyConfigured: boolean;
  availableModels: typeof STICKER_AI_MODEL_OPTIONS;
};

export type StickerAiRuntimeConfig = {
  apiKey: string | null;
  model: string;
  quality: StickerAiQuality;
  promptTemplate: string;
};

const DEFAULT_MODEL = DEFAULT_STICKER_AI_MODEL;
const DEFAULT_QUALITY: StickerAiQuality = 'high';

function maskApiKey(key: string): string {
  return key.length > 4
    ? `${'*'.repeat(Math.max(8, key.length - 4))}${key.slice(-4)}`
    : '****';
}

function normalizeQuality(raw: unknown): StickerAiQuality {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'auto') {
    return value;
  }
  return DEFAULT_QUALITY;
}

function parseStoredConfig(value: unknown): StickerAiConfigStored {
  const record = (value ?? {}) as Record<string, unknown>;
  const apiKeys = Array.isArray(record.apiKeys)
    ? (record.apiKeys as string[]).map((k) => k?.trim()).filter(Boolean)
    : typeof record.apiKey === 'string' && record.apiKey.trim()
      ? [record.apiKey.trim()]
      : [];

  const activeKeyIndex =
    typeof record.activeKeyIndex === 'number'
      ? Math.max(0, Math.min(record.activeKeyIndex, Math.max(0, apiKeys.length - 1)))
      : 0;

  return {
    apiKeys,
    activeKeyIndex,
    model: normalizeStickerAiModel(
      typeof record.model === 'string' ? record.model : undefined,
    ),
    quality: normalizeQuality(record.quality),
    systemPrompt:
      typeof record.systemPrompt === 'string' && record.systemPrompt.trim()
        ? record.systemPrompt
        : DEFAULT_STICKER_PROMPT_TEMPLATE,
  };
}

function resolveIncomingKeys(
  incoming: string[] | undefined,
  existingKeys: string[],
): string[] {
  const resolved = (incoming ?? [])
    .map((k) => {
      const trimmed = k.trim();
      if (!trimmed) return null;
      if (/^\*{4,}/.test(trimmed)) {
        const suffix = trimmed.replace(/^\*+/, '');
        return existingKeys.find((ek) => ek.endsWith(suffix)) ?? null;
      }
      return trimmed;
    })
    .filter(Boolean) as string[];

  return resolved.length > 0 ? resolved : existingKeys;
}

@Injectable()
export class StickerAiConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getAdminConfig(): Promise<StickerAiConfigAdmin> {
    const stored = await this.loadStoredConfig();
    const envApiKey = this.config.get<string>('OPENAI_API_KEY')?.trim() || '';

    return {
      apiKeys: stored.apiKeys.map(maskApiKey),
      activeKeyIndex: stored.activeKeyIndex,
      model: stored.model,
      quality: stored.quality,
      systemPrompt: stored.systemPrompt,
      defaultSystemPrompt: DEFAULT_STICKER_PROMPT_TEMPLATE,
      envApiKeyConfigured: Boolean(envApiKey),
      availableModels: STICKER_AI_MODEL_OPTIONS,
    };
  }

  async saveAdminConfig(dto: {
    apiKeys?: string[];
    activeKeyIndex?: number;
    model: string;
    quality: string;
    systemPrompt: string;
  }): Promise<{ keysCount: number }> {
    const existing = await this.loadStoredConfig();
    const finalKeys = resolveIncomingKeys(dto.apiKeys, existing.apiKeys);

    const value: StickerAiConfigStored = {
      apiKeys: finalKeys,
      activeKeyIndex: Math.min(
        dto.activeKeyIndex ?? 0,
        Math.max(0, finalKeys.length - 1),
      ),
      model: normalizeStickerAiModel(dto.model),
      quality: normalizeQuality(dto.quality),
      systemPrompt: dto.systemPrompt?.trim() || DEFAULT_STICKER_PROMPT_TEMPLATE,
    };

    await this.prisma.systemConfig.upsert({
      where: { key: STICKER_AI_CONFIG_KEY },
      create: { key: STICKER_AI_CONFIG_KEY, value: serializeSystemConfigValue(value) },
      update: { value: serializeSystemConfigValue(value) },
    });

    return { keysCount: finalKeys.length };
  }

  async getRuntimeConfig(): Promise<StickerAiRuntimeConfig> {
    const stored = await this.loadStoredConfig();
    const envKey = this.config.get<string>('OPENAI_API_KEY')?.trim() || null;
    const configKey =
      stored.apiKeys.length > 0
        ? stored.apiKeys[Math.min(stored.activeKeyIndex, stored.apiKeys.length - 1)]
        : null;

    const envModel = this.config.get<string>('OPENAI_STICKER_MODEL')?.trim();
    const envQuality = this.config.get<string>('OPENAI_STICKER_QUALITY')?.trim();

    return {
      apiKey: configKey ?? envKey,
      model: normalizeStickerAiModel(stored.model || envModel),
      quality: stored.quality ?? normalizeQuality(envQuality),
      promptTemplate: stored.systemPrompt?.trim() || DEFAULT_STICKER_PROMPT_TEMPLATE,
    };
  }

  isEnvApiKeyConfigured(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY')?.trim());
  }

  private async loadStoredConfig(): Promise<StickerAiConfigStored> {
    const record = await this.prisma.systemConfig.findUnique({
      where: { key: STICKER_AI_CONFIG_KEY },
    });
    return parseStoredConfig(parseSystemConfigValue(record?.value));
  }
}
