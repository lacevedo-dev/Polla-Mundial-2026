import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

export class BrandingUploadFile {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
}

function resolveUploadsRoot(): string {
    if (process.env.UPLOADS_DIR?.trim()) {
        return path.resolve(process.env.UPLOADS_DIR.trim());
    }
    return path.resolve(process.cwd(), 'uploads');
}

@Injectable()
export class BrandingStorageService {
    private readonly uploadDir = process.env.BRANDING_UPLOAD_DIR?.trim()
        ? path.resolve(process.env.BRANDING_UPLOAD_DIR.trim())
        : path.join(resolveUploadsRoot(), 'branding');

    async save(file: BrandingUploadFile): Promise<string> {
        const extension = path.extname(file.originalname || '').toLowerCase() || this.extensionFromMime(file.mimetype);
        const filename = `${randomUUID()}${extension}`;

        await fs.mkdir(this.uploadDir, { recursive: true });
        await fs.writeFile(path.join(this.uploadDir, filename), file.buffer);

        return `/uploads/branding/${filename}`;
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
            case 'image/svg+xml':
                return '.svg';
            case 'image/x-icon':
            case 'image/vnd.microsoft.icon':
                return '.ico';
            default:
                return '';
        }
    }
}
