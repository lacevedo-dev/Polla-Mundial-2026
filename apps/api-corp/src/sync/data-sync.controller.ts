import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { DataSyncService } from './data-sync.service';

@Controller('internal')
export class DataSyncController {
    constructor(private readonly dataSync: DataSyncService) {}

    @Post('sync')
    async syncAll(@Headers('x-internal-api-key') apiKey: string) {
        this.assertApiKey(apiKey);
        return this.dataSync.syncAll();
    }

    private assertApiKey(key: string | undefined): void {
        const expected = process.env.INTERNAL_API_KEY?.trim();
        if (!expected) throw new UnauthorizedException('INTERNAL_API_KEY no configurada');
        if (key !== expected) throw new UnauthorizedException('API key interna invalida');
    }
}