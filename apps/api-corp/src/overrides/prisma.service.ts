import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client-corp';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        super({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        });
    }

    async onModuleInit() {
        await this.$connect();
        console.log('[PrismaService] Conectado a BD corporativa');
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    async checkDatabaseConnectivity(): Promise<{ ok: boolean; error?: string }> {
        try {
            await this.$queryRaw`SELECT 1`;
            return { ok: true };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
