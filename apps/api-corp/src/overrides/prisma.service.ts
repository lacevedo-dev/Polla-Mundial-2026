import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client-corp';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const MARIADB_SCHEME_PREFIX = 'mariadb://';
const MYSQL_SCHEME_PREFIX = 'mysql://';

function resolveMariaDbUrl(raw: string): string {
    const trimmed = raw.trim();
    let url: string;
    if (trimmed.startsWith(MARIADB_SCHEME_PREFIX)) {
        url = trimmed;
    } else if (trimmed.startsWith(MYSQL_SCHEME_PREFIX)) {
        url = `${MARIADB_SCHEME_PREFIX}${trimmed.slice(MYSQL_SCHEME_PREFIX.length)}`;
    } else {
        throw new Error('CORP_DATABASE_URL must use mariadb:// or mysql:// scheme.');
    }
    if (!url.includes('timezone=')) {
        const sep = url.includes('?') ? '&' : '?';
        url = `${url}${sep}timezone=Z`;
    }
    return url;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        const rawUrl = process.env.CORP_DATABASE_URL || process.env.DATABASE_URL;
        if (!rawUrl?.trim()) {
            throw new Error('CORP_DATABASE_URL is required for Prisma corporate runtime initialization.');
        }
        const connectionUrl = resolveMariaDbUrl(rawUrl);
        const adapter = new PrismaMariaDb(connectionUrl);
        super({ adapter: adapter as any });
    }

    async onModuleInit() {
        console.log('[PrismaService] Conectando a BD corporativa...');
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    async checkDatabaseConnectivity(): Promise<{ ok: boolean; error?: string }> {
        try {
            await this.$queryRawUnsafe('SELECT 1');
            return { ok: true };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
