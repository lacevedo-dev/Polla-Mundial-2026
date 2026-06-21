import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import type { StickerGlobalReferenceEntry } from './sticker-global-reference.service';

export type StickerReferenceSlot = 'team-uniform';

export type StickerReferenceFileSource = 'upload' | 'bundled' | 'missing';

export type ResolvedStickerReferenceFile = {
  absolutePath: string;
  uploadName: string;
  source: StickerReferenceFileSource;
};

export type StickerUploadFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Injectable()
export class StickerReferenceStorageService {
  constructor(private readonly config: ConfigService) {}

  resolveUploadsRoot(): string {
    const uploadsRoot = this.config.get<string>('UPLOADS_DIR')?.trim();
    return uploadsRoot ? path.resolve(uploadsRoot) : path.join(process.cwd(), 'uploads');
  }

  resolveUploadReferencesDir(): string {
    return path.join(this.resolveUploadsRoot(), 'sticker-references');
  }

  resolveGlobalUploadDir(): string {
    return path.join(this.resolveUploadReferencesDir(), 'global');
  }

  resolveBundledReferencesDir(): string {
    return path.join(__dirname, 'references');
  }

  normalizeCountryCode(code: string): string {
    return code.trim().toUpperCase().slice(0, 3);
  }

  resolveGlobalReferenceFile(entry: Pick<StickerGlobalReferenceEntry, 'id' | 'bundledFile'>): ResolvedStickerReferenceFile {
    const globalDir = this.resolveGlobalUploadDir();
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      const uploadPath = path.join(globalDir, `${entry.id}${ext}`);
      if (fs.existsSync(uploadPath)) {
        return {
          absolutePath: uploadPath,
          uploadName: path.basename(uploadPath),
          source: 'upload',
        };
      }
    }

    const legacy = this.resolveLegacyGlobalUpload(entry.id);
    if (legacy) return legacy;

    if (entry.bundledFile) {
      const bundledPath = path.join(this.resolveBundledReferencesDir(), entry.bundledFile);
      if (fs.existsSync(bundledPath)) {
        return {
          absolutePath: bundledPath,
          uploadName: entry.bundledFile,
          source: 'bundled',
        };
      }
      if (entry.bundledFile === 'fifa-2026-logo.png') {
        const bundledSvg = path.join(this.resolveBundledReferencesDir(), 'fifa-2026-logo.svg');
        if (fs.existsSync(bundledSvg)) {
          return {
            absolutePath: bundledSvg,
            uploadName: 'fifa-2026-logo.svg',
            source: 'bundled',
          };
        }
      }
    }

    return {
      absolutePath: '',
      uploadName: `${entry.id}.png`,
      source: 'missing',
    };
  }

  resolveTeamUniformReference(countryCode: string): ResolvedStickerReferenceFile {
    const code = this.normalizeCountryCode(countryCode);
    const fileName = `${code}.png`;
    const uploadPath = path.join(this.resolveUploadReferencesDir(), 'countries', fileName);
    if (fs.existsSync(uploadPath)) {
      return { absolutePath: uploadPath, uploadName: fileName, source: 'upload' };
    }
    const bundledPath = path.join(this.resolveBundledReferencesDir(), 'countries', fileName);
    if (fs.existsSync(bundledPath)) {
      return { absolutePath: bundledPath, uploadName: fileName, source: 'bundled' };
    }
    return { absolutePath: '', uploadName: fileName, source: 'missing' };
  }

  async saveGlobalReferenceUpload(id: string, file: StickerUploadFile): Promise<void> {
    this.validateImageFile(file);
    const dir = this.resolveGlobalUploadDir();
    fs.mkdirSync(dir, { recursive: true });
    this.deleteGlobalReferenceUpload(id);
    const ext = this.extensionForMime(file.mimetype);
    fs.writeFileSync(path.join(dir, `${id}${ext}`), file.buffer);
  }

  deleteGlobalReferenceUpload(id: string): boolean {
    const dir = this.resolveGlobalUploadDir();
    let removed = false;
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      const target = path.join(dir, `${id}${ext}`);
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        removed = true;
      }
    }
    return removed;
  }

  async saveTeamUniformUpload(countryCode: string, file: StickerUploadFile): Promise<void> {
    this.validateImageFile(file);
    const code = this.normalizeCountryCode(countryCode);
    if (!code) throw new BadRequestException('countryCode requerido para uniforme de equipo');
    const dir = path.join(this.resolveUploadReferencesDir(), 'countries');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${code}.png`), file.buffer);
  }

  deleteTeamUniform(countryCode: string): boolean {
    const code = this.normalizeCountryCode(countryCode);
    const uploadPath = path.join(this.resolveUploadReferencesDir(), 'countries', `${code}.png`);
    if (!fs.existsSync(uploadPath)) return false;
    fs.unlinkSync(uploadPath);
    return true;
  }

  private resolveLegacyGlobalUpload(id: string): ResolvedStickerReferenceFile | null {
    const root = this.resolveUploadReferencesDir();
    if (id === 'series-master') {
      const legacy = path.join(root, 'series-master.png');
      if (fs.existsSync(legacy)) {
        return { absolutePath: legacy, uploadName: 'series-master.png', source: 'upload' };
      }
    }
    if (id === 'fifa-logo') {
      const legacy = path.join(root, 'fifa-2026-logo.png');
      if (fs.existsSync(legacy)) {
        return { absolutePath: legacy, uploadName: 'fifa-2026-logo.png', source: 'upload' };
      }
    }
    return null;
  }

  private validateImageFile(file: StickerUploadFile): void {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Solo se permiten imágenes PNG, JPEG o WebP');
    }
    if (file.buffer.length === 0 || file.buffer.length > 8 * 1024 * 1024) {
      throw new BadRequestException('La imagen debe ser mayor a 0 y menor a 8 MB');
    }
  }

  private extensionForMime(mimetype: string): string {
    if (mimetype === 'image/jpeg') return '.jpg';
    if (mimetype === 'image/webp') return '.webp';
    return '.png';
  }
}
