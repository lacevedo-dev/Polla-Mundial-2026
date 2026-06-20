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
import { buildPremiumStickerPrompt } from './stickers-prompt.util';
import {
  buildPremiumStickerFileName,
  buildPremiumStickerPublicUrl,
  premiumStickerFileExists,
  readPremiumStickerBuffer,
  resolvePremiumStickerFilePath,
} from './stickers-cache.util';

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
  ) {}

  isOpenAiConfigured(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY')?.trim());
  }

  async getOrGenerateSticker(dto: GenerateStickerDto): Promise<GenerateStickerResult> {
    const playerApiFootballId = dto.playerApiFootballId;
    const outputDir = this.resolveStickersOutputDir();

    if (!dto.forceRegenerate) {
      const cached = await this.resolveCachedSticker(playerApiFootballId, outputDir);
      if (cached) {
        return this.buildResult(cached, playerApiFootballId, true, dto);
      }
    }

    const client = this.getOpenAIClient();
    const prompt = buildPremiumStickerPrompt(dto);
    const quality = dto.quality ?? this.resolveDefaultQuality();
    const fileName = buildPremiumStickerFileName(playerApiFootballId);
    const imageUrl = buildPremiumStickerPublicUrl(playerApiFootballId);

    try {
      const imageFile = await this.urlToOpenAIFile(dto.photoUrl);

      const response = await client.images.edit({
        model: this.config.get<string>('OPENAI_STICKER_MODEL')?.trim() || 'gpt-image-2',
        image: [imageFile],
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

      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(
        resolvePremiumStickerFilePath(outputDir, playerApiFootballId),
        Buffer.from(base64, 'base64'),
      );

      await this.persistStickerReference(playerApiFootballId, dto.playerName, imageUrl);

      return this.buildResult(
        { fileName, imageUrl, base64, prompt },
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

  async readCachedStickerBuffer(playerApiFootballId: number): Promise<Buffer | null> {
    return readPremiumStickerBuffer(this.resolveStickersOutputDir(), playerApiFootballId);
  }

  async getCachedSticker(playerApiFootballId: number): Promise<GenerateStickerResult | null> {
    const outputDir = this.resolveStickersOutputDir();
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
    const imageUrl = profile?.premiumStickerUrl ?? buildPremiumStickerPublicUrl(playerApiFootballId);

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
      result.imageDataUrl = `data:image/png;base64,${payload.base64}`;
    }

    if (dto.includePrompt && payload.prompt) {
      result.promptUsed = payload.prompt;
    }

    return result;
  }

  private getOpenAIClient(): OpenAI {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY no está configurada en el servidor',
      );
    }

    if (!this.openai) {
      this.openai = new OpenAI({ apiKey });
    }

    return this.openai;
  }

  private resolveDefaultQuality(): 'low' | 'medium' | 'high' | 'auto' {
    const raw = this.config.get<string>('OPENAI_STICKER_QUALITY')?.trim().toLowerCase();
    if (raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'auto') {
      return raw;
    }
    return 'high';
  }

  private resolveStickersOutputDir(): string {
    const uploadsRoot = this.config.get<string>('UPLOADS_DIR')?.trim();
    const base = uploadsRoot ? path.resolve(uploadsRoot) : path.join(process.cwd(), 'uploads');
    return path.join(base, 'stickers');
  }

  private async urlToOpenAIFile(url: string) {
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

    return await toFile(buffer, 'player.png', { type: contentType });
  }
}
