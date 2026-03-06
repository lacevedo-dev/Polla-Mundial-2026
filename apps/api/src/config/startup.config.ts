export type StartupDiagnostics = {
    nodeEnv: string;
    port: number;
    missingEnv: string[];
};

const REQUIRED_ENV_KEYS = ['DATABASE_URL', 'JWT_SECRET'];

export function resolveStartupDiagnostics(env: NodeJS.ProcessEnv = process.env): StartupDiagnostics {
    const rawPort = env.PORT?.trim();
    const port = rawPort ? Number(rawPort) : 3000;

    if (!Number.isInteger(port) || port <= 0) {
        throw new Error(`PORT must be a positive integer. Received "${rawPort ?? ''}".`);
    }

    const missingEnv = REQUIRED_ENV_KEYS.filter((key) => !env[key]?.trim());

    return {
        nodeEnv: env.NODE_ENV?.trim() || 'development',
        port,
        missingEnv,
    };
}

export function assertRequiredEnv(diagnostics: StartupDiagnostics): void {
    if (diagnostics.missingEnv.length === 0) {
        return;
    }

    throw new Error(`Missing required environment variable(s): ${diagnostics.missingEnv.join(', ')}`);
}
