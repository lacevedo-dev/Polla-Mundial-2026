import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { parseSystemConfigValue, serializeSystemConfigValue } from '../system-config/system-config.util';
import {
  StickerReferenceStorageService,
  type StickerReferenceFileSource,
  type StickerUploadFile,
} from './sticker-reference-storage.service';

export const STICKER_GLOBAL_REFERENCES_KEY = 'sticker_global_references';

export type StickerGlobalReferenceEntry = {
  id: string;
  label: string;
  promptHint: string;
  sortOrder: number;
  bundledFile?: string;
};

export type StickerGlobalReferencesStored = {
  items: StickerGlobalReferenceEntry[];
};

export type StickerGlobalReferenceAdminItem = StickerGlobalReferenceEntry & {
  image: {
    configured: boolean;
    source: StickerReferenceFileSource;
  };
};

export type StickerGlobalReferencePromptItem = {
  label: string;
  promptHint: string;
  attached: boolean;
  source?: StickerReferenceFileSource;
};

export const DEFAULT_GLOBAL_STICKER_REFERENCES: StickerGlobalReferenceEntry[] = [
  {
    id: 'series-master',
    label: 'Image B — Series master',
    promptHint:
      'Main visual style and layout reference. Follow composition, proportions, footer structure and branding placement exactly.',
    sortOrder: 0,
    bundledFile: 'series-master.png',
  },
  {
    id: 'fifa-logo',
    label: 'Image C — Logo FIFA 2026',
    promptHint:
      'Official-style top-right tournament logo. Recreate white "26" structure with cup silhouette and "FIFA" text below.',
    sortOrder: 1,
    bundledFile: 'fifa-2026-logo.png',
  },
];

@Injectable()
export class StickerGlobalReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StickerReferenceStorageService,
  ) {}

  async getAdminItems(): Promise<StickerGlobalReferenceAdminItem[]> {
    const items = await this.listSortedItems();
    return items.map((item) => {
      const resolved = this.storage.resolveGlobalReferenceFile(item);
      return {
        ...item,
        image: {
          configured: resolved.source !== 'missing',
          source: resolved.source,
        },
      };
    });
  }

  async getPromptItems(): Promise<StickerGlobalReferencePromptItem[]> {
    const items = await this.listSortedItems();
    return items.map((item) => {
      const resolved = this.storage.resolveGlobalReferenceFile(item);
      return {
        label: item.label.trim(),
        promptHint: item.promptHint.trim(),
        attached: resolved.source !== 'missing',
        source: resolved.source,
      };
    });
  }

  async resolveAttachedFiles() {
    const items = await this.listSortedItems();
    return items
      .map((item) => this.storage.resolveGlobalReferenceFile(item))
      .filter((file) => file.source !== 'missing');
  }

  async createItem(dto: { label: string; promptHint?: string }): Promise<StickerGlobalReferenceAdminItem> {
    const label = dto.label?.trim();
    if (!label) throw new BadRequestException('La etiqueta es obligatoria');

    const stored = await this.loadStored();
    const sortOrder =
      stored.items.length === 0
        ? 0
        : Math.max(...stored.items.map((item) => item.sortOrder)) + 1;

    const entry: StickerGlobalReferenceEntry = {
      id: randomUUID(),
      label,
      promptHint: dto.promptHint?.trim() ?? '',
      sortOrder,
    };
    stored.items.push(entry);
    await this.persist(stored);

    const resolved = this.storage.resolveGlobalReferenceFile(entry);
    return {
      ...entry,
      image: {
        configured: resolved.source !== 'missing',
        source: resolved.source,
      },
    };
  }

  async updateItem(
    id: string,
    dto: { label?: string; promptHint?: string; sortOrder?: number },
  ): Promise<StickerGlobalReferenceAdminItem> {
    const stored = await this.loadStored();
    const index = stored.items.findIndex((item) => item.id === id);
    if (index < 0) throw new BadRequestException('Referencia global no encontrada');

    const current = stored.items[index];
    if (dto.label !== undefined) {
      const label = dto.label.trim();
      if (!label) throw new BadRequestException('La etiqueta es obligatoria');
      current.label = label;
    }
    if (dto.promptHint !== undefined) {
      current.promptHint = dto.promptHint.trim();
    }
    if (dto.sortOrder !== undefined && Number.isFinite(dto.sortOrder)) {
      current.sortOrder = dto.sortOrder;
    }

    stored.items[index] = current;
    await this.persist(stored);

    const resolved = this.storage.resolveGlobalReferenceFile(current);
    return {
      ...current,
      image: {
        configured: resolved.source !== 'missing',
        source: resolved.source,
      },
    };
  }

  async deleteItem(id: string): Promise<void> {
    const stored = await this.loadStored();
    const index = stored.items.findIndex((item) => item.id === id);
    if (index < 0) throw new BadRequestException('Referencia global no encontrada');

    this.storage.deleteGlobalReferenceUpload(id);
    stored.items.splice(index, 1);
    await this.persist(stored);
  }

  async saveUpload(id: string, file: StickerUploadFile): Promise<{ ok: true; id: string }> {
    const stored = await this.loadStored();
    if (!stored.items.some((item) => item.id === id)) {
      throw new BadRequestException('Referencia global no encontrada');
    }
    await this.storage.saveGlobalReferenceUpload(id, file);
    return { ok: true, id };
  }

  async deleteUpload(id: string): Promise<{ ok: true; removed: boolean }> {
    const stored = await this.loadStored();
    if (!stored.items.some((item) => item.id === id)) {
      throw new BadRequestException('Referencia global no encontrada');
    }
    const removed = this.storage.deleteGlobalReferenceUpload(id);
    return { ok: true, removed };
  }

  private async listSortedItems(): Promise<StickerGlobalReferenceEntry[]> {
    const stored = await this.loadStored();
    return [...stored.items].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  }

  private async loadStored(): Promise<StickerGlobalReferencesStored> {
    const record = await this.prisma.systemConfig.findUnique({
      where: { key: STICKER_GLOBAL_REFERENCES_KEY },
    });
    const value = parseSystemConfigValue<StickerGlobalReferencesStored>(record?.value);
    const items = Array.isArray(value?.items) ? value.items : [];
    if (items.length === 0) {
      return { items: DEFAULT_GLOBAL_STICKER_REFERENCES.map((item) => ({ ...item })) };
    }
    return { items };
  }

  private async persist(value: StickerGlobalReferencesStored): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key: STICKER_GLOBAL_REFERENCES_KEY },
      create: { key: STICKER_GLOBAL_REFERENCES_KEY, value: serializeSystemConfigValue(value) },
      update: { value: serializeSystemConfigValue(value) },
    });
  }
}
