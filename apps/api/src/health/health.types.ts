import type { DatabaseFailureCategory } from '../prisma/database-error.util';

export type HealthStatus = 'ok' | 'degraded' | 'down';
export type CheckStatus = 'up' | 'down' | 'unknown';

export type HealthResponse = {
    service: 'polla-api';
    status: HealthStatus;
    timestamp: string;
    checks: {
        app: CheckStatus;
        database: CheckStatus;
    };
    diagnostics?: {
        databaseFailureCategory?: DatabaseFailureCategory;
    };
};
