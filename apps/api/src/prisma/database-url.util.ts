export type DatabaseUrlResolution = {
    connectionUrl: string;
    normalizedFromMysqlScheme: boolean;
};

const MARIADB_SCHEME_PREFIX = 'mariadb://';
const MYSQL_SCHEME_PREFIX = 'mysql://';

export function resolveDatabaseUrlForMariaDb(rawDatabaseUrl: string): DatabaseUrlResolution {
    const trimmed = rawDatabaseUrl.trim();

    if (!trimmed) {
        throw new Error('DATABASE_URL is required for Prisma runtime initialization.');
    }

    if (trimmed.startsWith(MARIADB_SCHEME_PREFIX)) {
        return {
            connectionUrl: trimmed,
            normalizedFromMysqlScheme: false,
        };
    }

    if (trimmed.startsWith(MYSQL_SCHEME_PREFIX)) {
        return {
            connectionUrl: `${MARIADB_SCHEME_PREFIX}${trimmed.slice(MYSQL_SCHEME_PREFIX.length)}`,
            normalizedFromMysqlScheme: true,
        };
    }

    throw new Error('DATABASE_URL must use mariadb:// (preferred) or mysql:// scheme.');
}
