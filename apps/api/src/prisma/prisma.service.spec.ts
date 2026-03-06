import { resolveDatabaseUrlForMariaDb } from './database-url.util';

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
