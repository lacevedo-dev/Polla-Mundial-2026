import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { classifyDatabaseConnectivityError } from '../prisma/database-error.util';

export const REGISTER_TEMPORARILY_UNAVAILABLE_CODE = 'REGISTER_TEMPORARILY_UNAVAILABLE';
export const REGISTER_TEMPORARILY_UNAVAILABLE_MESSAGE =
    'El registro está temporalmente no disponible. Intenta nuevamente en unos minutos.';

export function mapRegisterOperationalError(error: unknown): Error {
    if (error instanceof ConflictException || error instanceof ServiceUnavailableException) {
        return error;
    }

    const classification = classifyDatabaseConnectivityError(error);
    if (classification.category === 'unknown') {
        return error instanceof Error ? error : new Error(String(error));
    }

    return new ServiceUnavailableException({
        statusCode: 503,
        code: REGISTER_TEMPORARILY_UNAVAILABLE_CODE,
        message: REGISTER_TEMPORARILY_UNAVAILABLE_MESSAGE,
    });
}
