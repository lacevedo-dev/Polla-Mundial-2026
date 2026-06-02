import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@corp-api/prisma/prisma.service';

@Controller('health')
export class CorpHealthController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    async check() {
        const db = await this.prisma.checkDatabaseConnectivity();
        return {
            status: db.ok ? 'ok' : 'degraded',
            service: 'api-corp',
            version: process.env.npm_package_version ?? '0.0.1',
            timestamp: new Date().toISOString(),
            database: db.ok ? 'connected' : db.message,
            mainApiUrl: process.env.MAIN_API_URL ?? 'not configured',
        };
    }
}
