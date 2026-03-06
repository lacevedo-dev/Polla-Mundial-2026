export type DatabaseFailureCategory = 'config' | 'network' | 'credentials' | 'quota' | 'unknown';

export type DatabaseConnectivityResult =
    | { ok: true }
    | {
        ok: false;
        category: DatabaseFailureCategory;
        message: string;
    };

type ErrorSignal = {
    code?: string;
    errno?: number;
    message: string;
};

const NETWORK_ERROR_CODES = new Set([
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'EAI_AGAIN',
    'ECONNRESET',
]);

const CREDENTIAL_ERROR_CODES = new Set([
    'ER_ACCESS_DENIED_ERROR',
    'ER_DBACCESS_DENIED_ERROR',
    'ER_ACCESS_DENIED_NO_PASSWORD_ERROR',
]);

const QUOTA_ERROR_CODES = new Set([
    'ER_USER_LIMIT_REACHED',
    'ER_TOO_MANY_USER_CONNECTIONS',
    'ER_CON_COUNT_ERROR',
]);

const DATABASE_URL_PATTERN = /\b(?:mariadb|mysql):\/\/[^\s'"]+/gi;

export function classifyDatabaseConnectivityError(error: unknown): Extract<DatabaseConnectivityResult, { ok: false }> {
    const signals = collectErrorSignals(error);

    if (matchesConfigError(signals)) {
        return {
            ok: false,
            category: 'config',
            message: 'Database configuration is invalid or incomplete.',
        };
    }

    if (matchesQuotaError(signals)) {
        return {
            ok: false,
            category: 'quota',
            message: 'Database provider quota or connection limit was reached.',
        };
    }

    if (matchesCredentialError(signals)) {
        return {
            ok: false,
            category: 'credentials',
            message: 'Database credentials were rejected.',
        };
    }

    if (matchesNetworkError(signals)) {
        return {
            ok: false,
            category: 'network',
            message: 'Database host is unreachable or timed out.',
        };
    }

    return {
        ok: false,
        category: 'unknown',
        message: sanitizeDatabaseErrorMessage(signals[0]?.message || 'Database connectivity failed for an unknown reason.'),
    };
}

function matchesConfigError(signals: ErrorSignal[]): boolean {
    return signals.some((signal) => {
        const normalized = signal.message.toLowerCase();

        return normalized.includes('database_url is required')
            || normalized.includes('database_url must use mariadb://')
            || normalized.includes('invalid format for mariadb adapter')
            || normalized.includes('error parsing connection string')
            || normalized.includes('received "')
            || normalized.includes('missing required environment variable');
    });
}

function matchesNetworkError(signals: ErrorSignal[]): boolean {
    return signals.some((signal) => {
        const normalized = signal.message.toLowerCase();

        return (signal.code ? NETWORK_ERROR_CODES.has(signal.code) : false)
            || normalized.includes('econnrefused')
            || normalized.includes('timed out')
            || normalized.includes('timeout')
            || normalized.includes('enotfound')
            || normalized.includes('ehostunreach')
            || normalized.includes('econnreset');
    });
}

function matchesCredentialError(signals: ErrorSignal[]): boolean {
    return signals.some((signal) => {
        const normalized = signal.message.toLowerCase();

        return (signal.code ? CREDENTIAL_ERROR_CODES.has(signal.code) : false)
            || signal.errno === 1045
            || signal.errno === 1044
            || normalized.includes('access denied')
            || normalized.includes('authentication failed');
    });
}

function matchesQuotaError(signals: ErrorSignal[]): boolean {
    return signals.some((signal) => {
        const normalized = signal.message.toLowerCase();

        return (signal.code ? QUOTA_ERROR_CODES.has(signal.code) : false)
            || signal.errno === 1226
            || normalized.includes('max_connections_per_hour')
            || normalized.includes('pool timeout')
            || normalized.includes('failed to retrieve a connection from pool')
            || normalized.includes('resource')
            || normalized.includes('too many connections')
            || normalized.includes('user limit reached');
    });
}

function collectErrorSignals(error: unknown): ErrorSignal[] {
    const visited = new Set<unknown>();
    const queue: unknown[] = [error];
    const signals: ErrorSignal[] = [];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || visited.has(current)) {
            continue;
        }
        visited.add(current);

        if (current instanceof Error) {
            signals.push({
                code: getStringCode(current),
                errno: getNumberErrno(current),
                message: sanitizeDatabaseErrorMessage(current.message),
            });
        } else if (typeof current === 'object') {
            const record = current as Record<string, unknown>;
            signals.push({
                code: getStringCode(record),
                errno: getNumberErrno(record),
                message: sanitizeDatabaseErrorMessage(typeof record.message === 'string' ? record.message : String(current)),
            });

            if (record.cause) {
                queue.push(record.cause);
            }

            if (Array.isArray(record.errors)) {
                queue.push(...record.errors);
            }
        } else {
            signals.push({
                message: sanitizeDatabaseErrorMessage(String(current)),
            });
        }
    }

    return signals;
}

function getStringCode(value: Error | Record<string, unknown>): string | undefined {
    const code = 'code' in value ? value.code : undefined;
    return typeof code === 'string' ? code : undefined;
}

function getNumberErrno(value: Error | Record<string, unknown>): number | undefined {
    const errno = 'errno' in value ? value.errno : undefined;
    return typeof errno === 'number' ? errno : undefined;
}

function sanitizeDatabaseErrorMessage(message: string): string {
    return message.replace(DATABASE_URL_PATTERN, '<redacted-database-url>');
}
