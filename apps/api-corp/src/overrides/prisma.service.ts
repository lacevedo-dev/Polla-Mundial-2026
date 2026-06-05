import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client-corp';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const MARIADB_SCHEME_PREFIX = 'mariadb://';
const MYSQL_SCHEME_PREFIX = 'mysql://';
const DEFAULT_MYSQL_PORT = 3306;
type MariaDbPoolConfig = Exclude<ConstructorParameters<typeof PrismaMariaDb>[0], string>;

function resolveMariaDbUrl(raw: string): URL {
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
    try {
        return new URL(url);
    } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        throw new Error(`CORP_DATABASE_URL has an invalid MariaDB URL format. Details: ${details}`);
    }
}

function resolveMariaDbPoolConfig(raw: string): MariaDbPoolConfig {
    const url = resolveMariaDbUrl(raw);
    const searchParams = url.searchParams;

    const config: MariaDbPoolConfig = {
        host: url.hostname,
        port: url.port ? Number(url.port) : DEFAULT_MYSQL_PORT,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    };

    const connectionLimit = parsePositiveInteger(searchParams.get('connectionLimit'));
    if (connectionLimit !== undefined) {
        config.connectionLimit = connectionLimit;
    }

    const minimumIdle = parsePositiveInteger(searchParams.get('minimumIdle'));
    if (minimumIdle !== undefined) {
        config.minimumIdle = minimumIdle;
    }

    const acquireTimeout = parsePositiveInteger(searchParams.get('acquireTimeout'));
    if (acquireTimeout !== undefined) {
        config.acquireTimeout = acquireTimeout;
    }

    return config;
}

function parsePositiveInteger(value: string | null): number | undefined {
    if (!value?.trim()) {
        return undefined;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return undefined;
    }

    return Math.trunc(parsed);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        const rawUrl = process.env.CORP_DATABASE_URL || process.env.DATABASE_URL;
        if (!rawUrl?.trim()) {
            throw new Error('CORP_DATABASE_URL is required for Prisma corporate runtime initialization.');
        }
        const poolConfig = resolveMariaDbPoolConfig(rawUrl);
        const adapter = new PrismaMariaDb(poolConfig);
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
