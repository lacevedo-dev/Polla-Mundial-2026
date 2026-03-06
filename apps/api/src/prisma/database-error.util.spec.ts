import { classifyDatabaseConnectivityError } from './database-error.util';

describe('classifyDatabaseConnectivityError', () => {
    it('classifies malformed database configuration errors', () => {
        const result = classifyDatabaseConnectivityError(
            new Error('DATABASE_URL must use mariadb:// (preferred) or mysql:// scheme.'),
        );

        expect(result).toMatchObject({
            ok: false,
            category: 'config',
        });
    });

    it('classifies refused network connections', () => {
        const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3306'), {
            code: 'ECONNREFUSED',
        });

        const result = classifyDatabaseConnectivityError(error);

        expect(result).toMatchObject({
            ok: false,
            category: 'network',
        });
    });

    it('classifies invalid credentials errors', () => {
        const error = Object.assign(new Error('Access denied for user'), {
            code: 'ER_ACCESS_DENIED_ERROR',
            errno: 1045,
        });

        const result = classifyDatabaseConnectivityError(error);

        expect(result).toMatchObject({
            ok: false,
            category: 'credentials',
        });
    });

    it('classifies provider quota/resource-limit errors', () => {
        const error = Object.assign(
            new Error("User 'polla' has exceeded the 'max_connections_per_hour' resource"),
            {
                code: 'ER_USER_LIMIT_REACHED',
                errno: 1226,
            },
        );

        const result = classifyDatabaseConnectivityError(error);

        expect(result).toMatchObject({
            ok: false,
            category: 'quota',
        });
    });

    it('classifies Prisma pool timeouts as quota/resource pressure', () => {
        const error = Object.assign(
            new Error(
                'Raw query failed. Code: `45028`. Message: `pool timeout: failed to retrieve a connection from pool after 10012ms (pool connections: active=0 idle=0 limit=10)`',
            ),
            {
                code: 'P2010',
            },
        );

        const result = classifyDatabaseConnectivityError(error);

        expect(result).toMatchObject({
            ok: false,
            category: 'quota',
        });
    });

    it('falls back to unknown for unclassified errors', () => {
        const result = classifyDatabaseConnectivityError(new Error('Unexpected DB issue'));

        expect(result).toMatchObject({
            ok: false,
            category: 'unknown',
        });
    });
});
