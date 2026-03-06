import { resolveDatabaseUrlForMariaDb } from '../prisma/database-url.util';

export type StartupDiagnostics = {
    nodeEnv: string;
    port: number;
    missingEnv: string[];
    databaseHost?: string;
    usesLoopbackDatabaseHost: boolean;
};

const REQUIRED_ENV_KEYS = ['DATABASE_URL', 'JWT_SECRET'];

export function resolveStartupDiagnostics(env: NodeJS.ProcessEnv = process.env): StartupDiagnostics {
    const rawPort = env.PORT?.trim();
    const port = rawPort ? Number(rawPort) : 3000;
    const rawDatabaseUrl = env.DATABASE_URL?.trim();

    if (!Number.isInteger(port) || port <= 0) {
        throw new Error(`PORT must be a positive integer. Received "${rawPort ?? ''}".`);
    }

    const missingEnv = REQUIRED_ENV_KEYS.filter((key) => !env[key]?.trim());
    const databaseResolution = rawDatabaseUrl
        ? resolveDatabaseUrlForMariaDb(rawDatabaseUrl)
        : undefined;

    return {
        nodeEnv: env.NODE_ENV?.trim() || 'development',
        port,
        missingEnv,
        databaseHost: databaseResolution?.hostname,
        usesLoopbackDatabaseHost: databaseResolution?.usesLoopbackHost ?? false,
    };
}

export function assertRequiredEnv(diagnostics: StartupDiagnostics): void {
    if (diagnostics.missingEnv.length > 0) {
        throw new Error(`Missing required environment variable(s): ${diagnostics.missingEnv.join(', ')}`);
    }

    if (diagnostics.nodeEnv !== 'development' && diagnostics.usesLoopbackDatabaseHost) {
        throw new Error('DATABASE_URL must not target localhost, 127.0.0.1, or ::1 outside development.');
    }
}
