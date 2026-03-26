import { ApiError } from '../api';

export const REGISTER_TEMPORARILY_UNAVAILABLE_MESSAGE =
    'El registro está temporalmente no disponible. Intenta nuevamente en unos minutos.';
export const LOGIN_TEMPORARILY_UNAVAILABLE_MESSAGE =
    'El inicio de sesión está temporalmente no disponible. Intenta nuevamente en unos minutos.';

const GENERIC_OPERATIONAL_MESSAGES = new Set([
    'internal server error',
    'error de red',
    'failed to fetch',
    'network error',
]);

export type AuthAction = 'register' | 'login' | 'verifyEmail' | 'resendVerification';

export function normalizeAuthError(error: unknown, action: AuthAction): Error {
    if (error instanceof ApiError) {
        if (shouldPreserveApiError(error, action)) {
            return new Error(error.message);
        }

        if (isOperationalApiError(error, action)) {
            return new Error(getOperationalMessage(action));
        }
    }

    if (error instanceof Error) {
        const normalizedMessage = error.message.trim().toLowerCase();
        if (normalizedMessage === 'credenciales inválidas') {
            return error;
        }

        if (GENERIC_OPERATIONAL_MESSAGES.has(normalizedMessage)) {
            return new Error(getOperationalMessage(action));
        }

        return error;
    }

    return new Error(getOperationalMessage(action));
}

function shouldPreserveApiError(error: ApiError, action: AuthAction): boolean {
    if (action === 'login' && error.status === 401) {
        return true;
    }

    return error.status !== undefined
        && error.status < 500
        && error.code !== 'NETWORK_ERROR';
}

function isOperationalApiError(error: ApiError, action: AuthAction): boolean {
    const normalizedMessage = error.message.trim().toLowerCase();

    if (action === 'register' && error.code === 'REGISTER_TEMPORARILY_UNAVAILABLE') {
        return true;
    }

    return error.code === 'NETWORK_ERROR'
        || (error.status !== undefined && error.status >= 500)
        || GENERIC_OPERATIONAL_MESSAGES.has(normalizedMessage);
}

function getOperationalMessage(action: AuthAction): string {
    return action === 'register'
        ? REGISTER_TEMPORARILY_UNAVAILABLE_MESSAGE
        : LOGIN_TEMPORARILY_UNAVAILABLE_MESSAGE;
}
