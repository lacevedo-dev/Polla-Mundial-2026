import { resolveDatabaseUrlForMariaDb } from './database-url.util';
import { resolveMariaDbPoolConfig } from './database-pool.util';

describe('resolveDatabaseUrlForMariaDb', () => {
    it('returns mariadb URLs without normalization', () => {
        const result = resolveDatabaseUrlForMariaDb('mariadb://user:pass@db:3306/app');

        expect(result).toEqual({
            connectionUrl: 'mariadb://user:pass@db:3306/app',
            normalizedFromMysqlScheme: false,
            hostname: 'db',
            usesLoopbackHost: false,
        });
    });

    it('normalizes mysql URLs to mariadb scheme for adapter compatibility', () => {
        const result = resolveDatabaseUrlForMariaDb('mysql://user:pass@db:3306/app');

        expect(result).toEqual({
            connectionUrl: 'mariadb://user:pass@db:3306/app',
            normalizedFromMysqlScheme: true,
            hostname: 'db',
            usesLoopbackHost: false,
        });
    });

    it('throws when DATABASE_URL is empty', () => {
        expect(() => resolveDatabaseUrlForMariaDb('   ')).toThrow(
            'DATABASE_URL is required for Prisma runtime initialization.',
        );
    });

    it('throws for unsupported URL schemes', () => {
        expect(() => resolveDatabaseUrlForMariaDb('postgresql://user:pass@db:5432/app')).toThrow(
            'DATABASE_URL must use mariadb:// (preferred) or mysql:// scheme.',
        );
    });
});

describe('resolveMariaDbPoolConfig', () => {
    it('builds a pool config object from the normalized database URL', () => {
        const result = resolveMariaDbPoolConfig(
            'mysql://db_user:S0p0rt3%2A%2A26@srv813.hstgr.io:3306/u515832100_polla_ui_prod?connectionLimit=1&minimumIdle=0&acquireTimeout=10000',
        );

        expect(result).toMatchObject({
            host: 'srv813.hstgr.io',
            port: 3306,
            user: 'db_user',
            password: 'S0p0rt3**26',
            database: 'u515832100_polla_ui_prod',
            connectionLimit: 1,
            minimumIdle: 0,
            acquireTimeout: 10000,
        });
    });

    it('ignores invalid pool query params instead of passing bad values through', () => {
        const result = resolveMariaDbPoolConfig(
            'mysql://db_user:secret@srv813.hstgr.io:3306/u515832100_polla_ui_prod?connectionLimit=abc&minimumIdle=-1&acquireTimeout=',
        );

        expect(result).toMatchObject({
            host: 'srv813.hstgr.io',
            port: 3306,
            user: 'db_user',
            password: 'secret',
            database: 'u515832100_polla_ui_prod',
        });
        expect(result.connectionLimit).toBeUndefined();
        expect(result.minimumIdle).toBeUndefined();
        expect(result.acquireTimeout).toBeUndefined();
    });
});
