import type { PoolConfig } from 'mariadb';
import { resolveDatabaseUrlForMariaDb } from './database-url.util';

const DEFAULT_MYSQL_PORT = 3306;

export function resolveMariaDbPoolConfig(rawDatabaseUrl: string): PoolConfig {
    const resolvedUrl = resolveDatabaseUrlForMariaDb(rawDatabaseUrl);
    const parsedUrl = new URL(resolvedUrl.connectionUrl);
    const searchParams = parsedUrl.searchParams;

    const config: PoolConfig = {
        host: parsedUrl.hostname,
        port: parsedUrl.port ? Number(parsedUrl.port) : DEFAULT_MYSQL_PORT,
        user: decodeURIComponent(parsedUrl.username),
        password: decodeURIComponent(parsedUrl.password),
        database: decodeURIComponent(parsedUrl.pathname.replace(/^\//, '')),
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
