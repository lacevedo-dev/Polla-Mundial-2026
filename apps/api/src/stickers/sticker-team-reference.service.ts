import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseSystemConfigValue, serializeSystemConfigValue } from '../system-config/system-config.util';
import {
  StickerGlobalReferenceService,
  type StickerGlobalReferenceAdminItem,
} from './sticker-global-reference.service';
import { StickerReferenceStorageService } from './sticker-reference-storage.service';

export const STICKER_TEAM_REFERENCES_KEY = 'sticker_team_references';

export type StickerTeamReferenceEntry = {
  kitDescription: string;
  imageLabel?: string;
};

export type StickerTeamReferencesStored = {
  teams: Record<string, StickerTeamReferenceEntry>;
};

export type StickerTeamReferenceAdminRow = {
  countryCode: string;
  teamName: string;
  flagUrl: string | null;
  imageLabel: string;
  kitDescription: string;
  uniformImage: {
    configured: boolean;
    source: 'upload' | 'bundled' | 'missing';
  };
};

export type StickerReferencesAdminView = {
  global: StickerGlobalReferenceAdminItem[];
  teams: StickerTeamReferenceAdminRow[];
};

export type StickerReferencePromptContext = {
  globalReferences: Array<{
    label: string;
    promptHint: string;
    attached: boolean;
    source?: 'upload' | 'bundled' | 'missing';
  }>;
  teamReference: {
    label: string;
    attached: boolean;
    source?: 'upload' | 'bundled' | 'missing';
  };
  teamKitDescription: string;
};

const DEFAULT_KIT_DESCRIPTION =
  'Official {{COUNTRY_NAME}} national team kit. Match jersey colors, collar trim, crest placement and fabric texture from the team reference image when attached; otherwise stay consistent with the series master reference.';

const DEFAULT_TEAM_IMAGE_LABEL = 'Uniforme selección {{COUNTRY_CODE}}';

@Injectable()
export class StickerTeamReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StickerReferenceStorageService,
    private readonly globalReferences: StickerGlobalReferenceService,
  ) {}

  async getAdminView(): Promise<StickerReferencesAdminView> {
    const stored = await this.loadStored();
    const global = await this.globalReferences.getAdminItems();
    const teams = await this.prisma.team.findMany({
      where: { apiFootballTeamId: { not: null } },
      orderBy: { name: 'asc' },
      select: {
        name: true,
        code: true,
        shortCode: true,
        flagUrl: true,
      },
    });

    const rows: StickerTeamReferenceAdminRow[] = teams.map((team) => {
      const countryCode = (team.shortCode ?? team.code ?? '').trim().toUpperCase().slice(0, 3);
      const uniform = countryCode
        ? this.storage.resolveTeamUniformReference(countryCode)
        : { source: 'missing' as const };
      const teamEntry = stored.teams[countryCode];

      return {
        countryCode: countryCode || '—',
        teamName: team.name,
        flagUrl: team.flagUrl,
        imageLabel: teamEntry?.imageLabel?.trim() || DEFAULT_TEAM_IMAGE_LABEL.replace('{{COUNTRY_CODE}}', countryCode),
        kitDescription: teamEntry?.kitDescription ?? '',
        uniformImage: {
          configured: uniform.source !== 'missing',
          source: uniform.source,
        },
      };
    });

    return {
      global,
      teams: rows.filter((row) => row.countryCode !== '—'),
    };
  }

  async saveTeamReference(
    countryCode: string,
    dto: { kitDescription?: string; imageLabel?: string },
  ): Promise<void> {
    const code = this.storage.normalizeCountryCode(countryCode);
    const stored = await this.loadStored();
    const current = stored.teams[code] ?? { kitDescription: '' };
    stored.teams[code] = {
      kitDescription: dto.kitDescription !== undefined ? dto.kitDescription.trim() : current.kitDescription,
      imageLabel: dto.imageLabel !== undefined ? dto.imageLabel.trim() : current.imageLabel,
    };
    await this.persist(stored);
  }

  async buildPromptContext(countryCode: string, countryName: string): Promise<StickerReferencePromptContext> {
    const code = this.storage.normalizeCountryCode(countryCode);
    const stored = await this.loadStored();
    const uniform = this.storage.resolveTeamUniformReference(code);
    const globalReferences = await this.globalReferences.getPromptItems();

    const customKit = stored.teams[code]?.kitDescription?.trim();
    const teamKitDescription = customKit
      ? customKit
      : DEFAULT_KIT_DESCRIPTION.replace(/\{\{COUNTRY_NAME\}\}/g, countryName);

    const customLabel = stored.teams[code]?.imageLabel?.trim();
    const teamLabel = customLabel
      ? customLabel.replace(/\{\{COUNTRY_CODE\}\}/g, code).replace(/\{\{COUNTRY_NAME\}\}/g, countryName)
      : DEFAULT_TEAM_IMAGE_LABEL.replace(/\{\{COUNTRY_CODE\}\}/g, code).replace(/\{\{COUNTRY_NAME\}\}/g, countryName);

    return {
      globalReferences,
      teamReference: {
        label: teamLabel,
        attached: uniform.source !== 'missing',
        source: uniform.source,
      },
      teamKitDescription,
    };
  }

  private async loadStored(): Promise<StickerTeamReferencesStored> {
    const record = await this.prisma.systemConfig.findUnique({
      where: { key: STICKER_TEAM_REFERENCES_KEY },
    });
    const value = parseSystemConfigValue<StickerTeamReferencesStored>(record?.value);
    return {
      teams: value?.teams && typeof value.teams === 'object' ? value.teams : {},
    };
  }

  private async persist(value: StickerTeamReferencesStored): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key: STICKER_TEAM_REFERENCES_KEY },
      create: { key: STICKER_TEAM_REFERENCES_KEY, value: serializeSystemConfigValue(value) },
      update: { value: serializeSystemConfigValue(value) },
    });
  }
}
