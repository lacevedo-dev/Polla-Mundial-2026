export type DatabaseUrlResolution = {
    connectionUrl: string;
    normalizedFromMysqlScheme: boolean;
    hostname: string;
    usesLoopbackHost: boolean;
};

const MARIADB_SCHEME_PREFIX = 'mariadb://';
const MYSQL_SCHEME_PREFIX = 'mysql://';
export const DATABASE_URL_SCHEME_ERROR_MESSAGE = 'DATABASE_URL must use mariadb:// (preferred) or mysql:// scheme.';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function resolveDatabaseUrlForMariaDb(rawDatabaseUrl: string): DatabaseUrlResolution {
    const trimmed = rawDatabaseUrl.trim();

    if (!trimmed) {
        throw new Error('DATABASE_URL is required for Prisma runtime initialization.');
    }

    const connectionUrl = resolveConnectionUrl(trimmed);
    const hostname = resolveHostname(connectionUrl);

    if (trimmed.startsWith(MARIADB_SCHEME_PREFIX)) {
        return {
            connectionUrl,
            normalizedFromMysqlScheme: false,
            hostname,
            usesLoopbackHost: isLoopbackHost(hostname),
        };
    }

    if (trimmed.startsWith(MYSQL_SCHEME_PREFIX)) {
        return {
            connectionUrl,
            normalizedFromMysqlScheme: true,
            hostname,
            usesLoopbackHost: isLoopbackHost(hostname),
        };
    }

    throw new Error(DATABASE_URL_SCHEME_ERROR_MESSAGE);
}

function resolveConnectionUrl(rawDatabaseUrl: string): string {
    if (rawDatabaseUrl.startsWith(MARIADB_SCHEME_PREFIX)) {
        return rawDatabaseUrl;
    }

    if (rawDatabaseUrl.startsWith(MYSQL_SCHEME_PREFIX)) {
        return `${MARIADB_SCHEME_PREFIX}${rawDatabaseUrl.slice(MYSQL_SCHEME_PREFIX.length)}`;
    }

    throw new Error(DATABASE_URL_SCHEME_ERROR_MESSAGE);
}

function resolveHostname(connectionUrl: string): string {
    try {
        const parsedUrl = new URL(connectionUrl);
        return parsedUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid format for MariaDB adapter DATABASE_URL. Details: ${details}`);
    }
}

function isLoopbackHost(hostname: string): boolean {
    return LOOPBACK_HOSTS.has(hostname);
}
