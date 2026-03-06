import { ApiError } from '../api';
import {
    LOGIN_TEMPORARILY_UNAVAILABLE_MESSAGE,
    REGISTER_TEMPORARILY_UNAVAILABLE_MESSAGE,
    normalizeAuthError,
} from './auth.error';

describe('normalizeAuthError', () => {
    it('rewrites generic register operational failures to a friendly message', () => {
        const error = new ApiError('Internal server error', {
            status: 503,
            code: 'REGISTER_TEMPORARILY_UNAVAILABLE',
        });

        expect(normalizeAuthError(error, 'register').message).toBe(
            REGISTER_TEMPORARILY_UNAVAILABLE_MESSAGE,
        );
    });

    it('preserves specific conflict messages for register', () => {
        const error = new ApiError('El correo electrónico ya está registrado', {
            status: 409,
        });

        expect(normalizeAuthError(error, 'register').message).toBe(
            'El correo electrónico ya está registrado',
        );
    });

    it('rewrites generic login failures without changing invalid-credentials copy', () => {
        const invalidCredentials = new ApiError('Credenciales inválidas', {
            status: 401,
        });
        const operationalFailure = new ApiError('Internal server error', {
            status: 500,
        });

        expect(normalizeAuthError(invalidCredentials, 'login').message).toBe('Credenciales inválidas');
        expect(normalizeAuthError(operationalFailure, 'login').message).toBe(
            LOGIN_TEMPORARILY_UNAVAILABLE_MESSAGE,
        );
    });
});
