import { Injectable, Logger } from '@nestjs/common';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface AvatarUploadFile {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const REMOTE_FETCH_TIMEOUT_MS = 15000;

function resolveUploadsRoot(): string {
    if (process.env.UPLOADS_DIR?.trim()) {
        return path.resolve(process.env.UPLOADS_DIR.trim());
    }
    return path.resolve(process.cwd(), 'uploads');
}

@Injectable()
export class AvatarStorageService {
    private readonly logger = new Logger(AvatarStorageService.name);

    private readonly uploadDir = process.env.AVATAR_UPLOAD_DIR?.trim()
        ? path.resolve(process.env.AVATAR_UPLOAD_DIR.trim())
        : path.join(resolveUploadsRoot(), 'avatars');

    async save(file: AvatarUploadFile): Promise<string> {
        const extension = path.extname(file.originalname || '').toLowerCase() || this.extensionFromMime(file.mimetype);
        const filename = `${randomUUID()}${extension}`;

        await fs.mkdir(this.uploadDir, { recursive: true });
        await fs.writeFile(path.join(this.uploadDir, filename), file.buffer);

        return `/uploads/avatars/${filename}`;
    }

    /** Descarga una imagen remota (OAuth) y la guarda como avatar local. */
    async saveFromUrl(remoteUrl: string): Promise<string | null> {
        const trimmed = remoteUrl.trim();
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            return null;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);

        try {
            const response = await fetch(trimmed, {
                signal: controller.signal,
                headers: { Accept: 'image/*' },
                redirect: 'follow',
            });

            if (!response.ok) {
                this.logger.warn(`No se pudo descargar avatar OAuth (${response.status}): ${trimmed}`);
                return null;
            }

            const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
            if (!contentType?.startsWith('image/')) {
                this.logger.warn(`Avatar OAuth con tipo no imagen (${contentType ?? 'unknown'}): ${trimmed}`);
                return null;
            }

            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_AVATAR_BYTES) {
                this.logger.warn(`Avatar OAuth con tamaño inválido (${arrayBuffer.byteLength} bytes): ${trimmed}`);
                return null;
            }

            const extension =
                this.extensionFromMime(contentType) ||
                this.extensionFromUrl(trimmed) ||
                '.jpg';

            return await this.save({
                originalname: `oauth-avatar${extension}`,
                mimetype: contentType,
                buffer: Buffer.from(arrayBuffer),
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Error al descargar avatar OAuth: ${message} (${trimmed})`);
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    isLocalAvatarPath(publicPath?: string | null): boolean {
        const normalized = publicPath?.trim();
        return Boolean(normalized?.startsWith('/uploads/avatars/'));
    }

    async exists(publicPath: string): Promise<boolean> {
        if (!this.isLocalAvatarPath(publicPath)) {
            return false;
        }

        const filename = path.basename(publicPath);
        try {
            await fs.access(path.join(this.uploadDir, filename));
            return true;
        } catch {
            return false;
        }
    }

    async remove(publicPath: string): Promise<void> {
        const filename = path.basename(publicPath);
        const absolutePath = path.join(this.uploadDir, filename);

        try {
            await fs.rm(absolutePath);
        } catch (error: any) {
            if (error?.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    private extensionFromMime(mimetype?: string): string {
        switch (mimetype) {
            case 'image/jpeg':
                return '.jpg';
            case 'image/png':
                return '.png';
            case 'image/webp':
                return '.webp';
            case 'image/gif':
                return '.gif';
            default:
                return '';
        }
    }

    private extensionFromUrl(url: string): string {
        try {
            const ext = path.extname(new URL(url).pathname).toLowerCase();
            if (ext === '.jpeg') return '.jpg';
            if (['.jpg', '.png', '.webp', '.gif'].includes(ext)) return ext;
        } catch {
            // URL inválida
        }
        return '';
    }
}
