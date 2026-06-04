import { Injectable } from '@nestjs/common';

export interface AvatarUploadFile {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
}

@Injectable()
export class AvatarStorageService {
    async save(file: AvatarUploadFile): Promise<string> {
        console.warn('[api-corp] AvatarStorageService.save() no implementado - retornando placeholder');
        return '/uploads/avatars/placeholder.jpg';
    }

    async remove(publicPath: string): Promise<void> {
        console.warn('[api-corp] AvatarStorageService.remove() no implementado');
    }
}
