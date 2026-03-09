import { Injectable } from '@nestjs/common';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface AvatarUploadFile {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
}

@Injectable()
export class AvatarStorageService {
    private readonly uploadDir = process.env.AVATAR_UPLOAD_DIR?.trim()
        ? path.resolve(process.env.AVATAR_UPLOAD_DIR.trim())
        : path.resolve(process.cwd(), 'uploads', 'avatars');

    async save(file: AvatarUploadFile): Promise<string> {
        const extension = path.extname(file.originalname || '').toLowerCase() || this.extensionFromMime(file.mimetype);
        const filename = `${randomUUID()}${extension}`;

        await fs.mkdir(this.uploadDir, { recursive: true });
        await fs.writeFile(path.join(this.uploadDir, filename), file.buffer);

        return `/uploads/avatars/${filename}`;
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
            default:
                return '';
        }
    }
}
