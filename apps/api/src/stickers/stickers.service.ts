import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI, { toFile } from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateStickerDto } from './dto/generate-sticker.dto';
import { GenerateStickerFromAlbumDto } from './dto/generate-sticker-from-album.dto';
import { buildGenerateStickerDto } from './stickers-mapper.util';
import { StickerAiConfigService } from './sticker-ai-config.service';
import { StickerGlobalReferenceService } from './sticker-global-reference.service';
import { StickerReferenceStorageService } from './sticker-reference-storage.service';
import { StickerTeamReferenceService } from './sticker-team-reference.service';
import { buildPremiumStickerPrompt } from './stickers-prompt.util';
import { loadStickerReferenceFiles } from './stickers-reference.util';
import {
  buildPremiumStickerFileName,
  buildPremiumStickerPublicUrl,
  premiumStickerFileExists,
  readPremiumStickerFileBuffer,
  removePremiumStickerFiles,
  writePremiumStickerWebp,
} from './stickers-cache.util';
import {
  optimizeOpenAiStickerPng,
  stickerFileToWhatsappJpeg,
} from './stickers-optimize.util';

export type GenerateStickerResult = {
  ok: true;
  cached: boolean;
  imageUrl: string;
  fileName: string;
  playerApiFootballId: number;
  imageBase64?: string;
  imageDataUrl?: string;
  promptUsed?: string;
};

@Injectable()
export class StickersService {
  private readonly logger = new Logger(StickersService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly stickerAiConfig: StickerAiConfigService,
    private readonly stickerReferenceStorage: StickerReferenceStorageService,
    private readonly stickerTeamReferences: StickerTeamReferenceService,
    private readonly stickerGlobalReferences: StickerGlobalReferenceService,
  ) {}

  isOpenAiConfigured(): boolean {
    return this.stickerAiConfig.isEnvApiKeyConfigured();
  }

  async isStickerAiReady(): Promise<boolean> {
    const runtime = await this.stickerAiConfig.getRuntimeConfig();
    return Boolean(runtime.apiKey);
  }

  async getOrGenerateSticker(dto: GenerateStickerDto): Promise<GenerateStickerResult> {
    const playerApiFootballId = dto.playerApiFootballId;
    const outputDir = this.resolveStickersOutputDir();

    if (!dto.forceRegenerate) {
      const cached = await this.resolveCachedSticker(playerApiFootballId, outputDir);
      if (cached) {
        return this.buildResult(cached, playerApiFootballId, true, dto);
      }
    } else {
      removePremiumStickerFiles(outputDir, playerApiFootballId);
    }

    const client = await this.getOpenAIClient();
    const runtime = await this.stickerAiConfig.getRuntimeConfig();
    const referenceContext = await this.stickerTeamReferences.buildPromptContext(
      dto.countryCode,
      dto.countryName,
    );
    const prompt = buildPremiumStickerPrompt(dto, runtime.promptTemplate, referenceContext);
    const quality = dto.quality ?? runtime.quality;

    try {
      const playerFile = await this.urlToOpenAIFile(dto.photoUrl, 'player-a.png');
      const globalFiles = await this.stickerGlobalReferences.resolveAttachedFiles();
      const teamFile = this.stickerReferenceStorage.resolveTeamUniformReference(dto.countryCode);
      const referenceFiles = await loadStickerReferenceFiles([
        ...globalFiles,
        ...(teamFile.source !== 'missing' ? [teamFile] : []),
      ]);
      if (referenceFiles.length === 0) {
        this.logger.warn(
          'Sin referencias globales ni de equipo; generando solo con Image A',
        );
      } else {
        this.logger.debug(
          `Referencias sticker: Image A + ${referenceFiles.length} imagen(es) de referencia`,
        );
      }

      const response = await client.images.edit({
        model: runtime.model,
        image: [playerFile, ...referenceFiles],
        prompt,
        size: '1024x1536',
        quality,
        output_format: 'png',
        background: 'opaque',
      });

      const base64 = response.data?.[0]?.b64_json;
      if (!base64) {
        throw new InternalServerErrorException('OpenAI no devolvió imagen en base64');
      }

      const rawPng = Buffer.from(base64, 'base64');
      const persisted = await this.persistOptimizedSticker(
        outputDir,
        playerApiFootballId,
        rawPng,
      );

      await this.persistStickerReference(
        playerApiFootballId,
        dto.playerName,
        persisted.imageUrl,
      );

      return this.buildResult(
        {
          fileName: persisted.fileName,
          imageUrl: persisted.imageUrl,
          base64: persisted.webpBase64,
          prompt,
        },
        playerApiFootballId,
        false,
        dto,
      );
    } catch (error) {
      this.logger.error(
        `Error generando sticker OpenAI para jugador ${playerApiFootballId}`,
        error instanceof Error ? error.stack : error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Error generando sticker';
      throw new InternalServerErrorException(message);
    }
  }

  /** Compatibilidad con el endpoint admin existente. */
  async generateSticker(dto: GenerateStickerDto): Promise<GenerateStickerResult> {
    return this.getOrGenerateSticker(dto);
  }

  /** Genera desde PlayerProfile en BD (payload canónico, evita desajustes del admin). */
  async generateFromAlbum(dto: GenerateStickerFromAlbumDto): Promise<GenerateStickerResult> {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { apiFootballPlayerId: dto.playerApiFootballId },
    });

    if (!profile) {
      throw new BadRequestException(
        `Jugador ${dto.playerApiFootballId} no está en caché. Ejecuta «Precargar plantillas» primero.`,
      );
    }

    if (!profile.photoUrl?.trim()) {
      throw new BadRequestException(
        'Sin foto del jugador. Ejecuta «Precargar plantillas» con enriquecimiento de perfiles.',
      );
    }

    const team = await this.resolveTeamForStickerProfile(profile, dto.teamCode);
    const teamName = team?.name ?? profile.nationality ?? 'Selección';
    const generateDto = buildGenerateStickerDto({
      profile,
      team,
      teamName,
      minute: dto.minute ?? null,
    });

    if (!generateDto) {
      throw new BadRequestException(
        'No se pudo preparar el sticker (falta foto u otros datos del jugador).',
      );
    }

    return this.getOrGenerateSticker({
      ...generateDto,
      forceRegenerate: dto.forceRegenerate,
    });
  }

  private async resolveTeamForStickerProfile(
    profile: { teamApiFootballId: number | null },
    teamCode?: string,
  ) {
    if (profile.teamApiFootballId != null) {
      return this.prisma.team.findFirst({
        where: { apiFootballTeamId: profile.teamApiFootballId },
      });
    }

    const code = teamCode?.trim();
    if (!code || code === '—') return null;

    return this.prisma.team.findFirst({
      where: { OR: [{ code }, { shortCode: code }] },
    });
  }

  /** Buffer JPEG optimizado para envío por WhatsApp. */
  async readCachedStickerBuffer(playerApiFootballId: number): Promise<Buffer | null> {
    const outputDir = this.resolveStickersOutputDir();
    const stored = readPremiumStickerFileBuffer(outputDir, playerApiFootballId);
    if (!stored) return null;

    if (stored.isLegacyPng) {
      const migrated = await this.migrateLegacyPngToWebp(
        outputDir,
        playerApiFootballId,
        stored.buffer,
      );
      return migrated.whatsappJpeg;
    }

    return stickerFileToWhatsappJpeg(stored.buffer);
  }

  async getCachedSticker(playerApiFootballId: number): Promise<GenerateStickerResult | null> {
    const outputDir = this.resolveStickersOutputDir();
    const stored = readPremiumStickerFileBuffer(outputDir, playerApiFootballId);
    if (stored?.isLegacyPng) {
      await this.migrateLegacyPngToWebp(outputDir, playerApiFootballId, stored.buffer);
    }

    const cached = await this.resolveCachedSticker(playerApiFootballId, outputDir);
    if (!cached) return null;

    return {
      ok: true,
      cached: true,
      imageUrl: cached.imageUrl,
      fileName: cached.fileName,
      playerApiFootballId,
    };
  }

  private async resolveCachedSticker(
    playerApiFootballId: number,
    outputDir: string,
  ): Promise<{ fileName: string; imageUrl: string } | null> {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { apiFootballPlayerId: playerApiFootballId },
      select: { premiumStickerUrl: true },
    });

    const fileName = buildPremiumStickerFileName(playerApiFootballId);
    const imageUrl = buildPremiumStickerPublicUrl(playerApiFootballId);

    if (!premiumStickerFileExists(outputDir, playerApiFootballId)) {
      if (profile?.premiumStickerUrl) {
        this.logger.warn(
          `Sticker cache miss en disco para jugador ${playerApiFootballId}; se regenerará`,
        );
      }
      return null;
    }

    return { fileName, imageUrl };
  }

  private async persistOptimizedSticker(
    outputDir: string,
    playerApiFootballId: number,
    rawPng: Buffer,
  ): Promise<{
    fileName: string;
    imageUrl: string;
    webpBase64: string;
    whatsappJpeg: Buffer;
  }> {
    const optimized = await optimizeOpenAiStickerPng(rawPng);
    writePremiumStickerWebp(outputDir, playerApiFootballId, optimized.webp);

    const fileName = buildPremiumStickerFileName(playerApiFootballId);
    const imageUrl = buildPremiumStickerPublicUrl(playerApiFootballId);

    this.logger.debug(
      `Sticker optimizado jugador ${playerApiFootballId}: PNG ${rawPng.length} → WebP ${optimized.webp.length} B (WA JPEG ${optimized.whatsappJpeg.length} B)`,
    );

    return {
      fileName,
      imageUrl,
      webpBase64: optimized.webp.toString('base64'),
      whatsappJpeg: optimized.whatsappJpeg,
    };
  }

  /** Migra PNG legado a WebP en disco (automático al leer caché antigua). */
  private async migrateLegacyPngToWebp(
    outputDir: string,
    playerApiFootballId: number,
    legacyPng: Buffer,
  ): Promise<{ whatsappJpeg: Buffer; imageUrl: string }> {
    removePremiumStickerFiles(outputDir, playerApiFootballId);
    const persisted = await this.persistOptimizedSticker(
      outputDir,
      playerApiFootballId,
      legacyPng,
    );

    const profile = await this.prisma.playerProfile.findUnique({
      where: { apiFootballPlayerId: playerApiFootballId },
      select: { name: true },
    });

    await this.persistStickerReference(
      playerApiFootballId,
      profile?.name ?? `Jugador ${playerApiFootballId}`,
      persisted.imageUrl,
    );

    this.logger.log(
      `Sticker PNG legado migrado a WebP para jugador ${playerApiFootballId}`,
    );

    return {
      whatsappJpeg: persisted.whatsappJpeg,
      imageUrl: persisted.imageUrl,
    };
  }

  private async persistStickerReference(
    playerApiFootballId: number,
    playerName: string,
    imageUrl: string,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.playerProfile.upsert({
      where: { apiFootballPlayerId: playerApiFootballId },
      update: {
        premiumStickerUrl: imageUrl,
        premiumStickerGeneratedAt: now,
      },
      create: {
        apiFootballPlayerId: playerApiFootballId,
        name: playerName,
        premiumStickerUrl: imageUrl,
        premiumStickerGeneratedAt: now,
      },
    });
  }

  private buildResult(
    payload: { fileName: string; imageUrl: string; base64?: string; prompt?: string },
    playerApiFootballId: number,
    cached: boolean,
    dto: GenerateStickerDto,
  ): GenerateStickerResult {
    const result: GenerateStickerResult = {
      ok: true,
      cached,
      fileName: payload.fileName,
      imageUrl: payload.imageUrl,
      playerApiFootballId,
    };

    if (dto.includeBase64 && payload.base64) {
      result.imageBase64 = payload.base64;
      result.imageDataUrl = `data:image/webp;base64,${payload.base64}`;
    }

    if (dto.includePrompt && payload.prompt) {
      result.promptUsed = payload.prompt;
    }

    return result;
  }

  private openaiKey: string | null = null;

  private async getOpenAIClient(): Promise<OpenAI> {
    const runtime = await this.stickerAiConfig.getRuntimeConfig();
    const apiKey = runtime.apiKey;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OpenAI no está configurado. Agrega API keys en Admin → Sistema → Stickers OpenAI o define OPENAI_API_KEY.',
      );
    }

    if (!this.openai || this.openaiKey !== apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.openaiKey = apiKey;
    }

    return this.openai;
  }

  private resolveStickersOutputDir(): string {
    const uploadsRoot = this.config.get<string>('UPLOADS_DIR')?.trim();
    const base = uploadsRoot ? path.resolve(uploadsRoot) : path.join(process.cwd(), 'uploads');
    return path.join(base, 'stickers');
  }

  private async urlToOpenAIFile(url: string, fileName = 'player.png') {
    const response = await fetch(url);

    if (!response.ok) {
      throw new BadRequestException(
        `No se pudo descargar la imagen: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) {
      throw new BadRequestException(
        `La URL no parece ser una imagen válida. Content-Type: ${contentType}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await toFile(buffer, fileName, { type: contentType });
  }
}
