import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { useAuthStore } from './auth.store';

vi.mock('../api', async () => {
    const actual = await vi.importActual<typeof import('../api')>('../api');
    return {
        ...actual,
        request: vi.fn(),
    };
});

const requestMock = vi.mocked(request);

describe('useAuthStore', () => {
    beforeEach(() => {
        requestMock.mockReset();
        localStorage.clear();
        useAuthStore.setState({
            user: null,
            token: null,
            isLoading: false,
            sessionChecked: true,
            emailVerified: false,
        });
    });

    it('sends a JSON register payload when no avatar file exists', async () => {
        requestMock.mockResolvedValueOnce({
            accessToken: 'token-json',
            user: {
                id: 'user-1',
                name: 'Ana Gomez',
                email: 'ana@mail.com',
                username: 'anagomez',
                avatar: null,
                emailVerified: false,
            },
        });

        await useAuthStore.getState().register({
            name: 'Ana Gomez',
            email: 'ana@mail.com',
            username: 'anagomez',
            password: 'Password1',
            phone: '3101234568',
            countryCode: '+57',
        });

        expect(requestMock).toHaveBeenCalledWith('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Ana Gomez',
                email: 'ana@mail.com',
                username: 'anagomez',
                password: 'Password1',
                phone: '3101234568',
                countryCode: '+57',
            }),
        });
        expect(useAuthStore.getState().user?.avatar).toBeUndefined();
        expect(localStorage.getItem('token')).toBe('token-json');
    });

    it('uses FormData and normalizes avatar references when an avatar file exists', async () => {
        const avatarFile = new File(['avatar'], 'profile-photo.webp', { type: 'image/webp' });
        requestMock.mockResolvedValueOnce({
            accessToken: 'token-form-data',
            user: {
                id: 'user-2',
                name: 'Ana Gomez',
                email: 'ana@mail.com',
                username: 'anagomez',
                avatar: '/uploads/avatars/profile-photo.webp',
                emailVerified: false,
            },
        });

        await useAuthStore.getState().register({
            name: 'Ana Gomez',
            email: 'ana@mail.com',
            username: 'anagomez',
            password: 'Password1',
            phone: '3101234568',
            countryCode: '+57',
            avatarFile,
        });

        const [, options] = requestMock.mock.calls[0];
        expect(options?.method).toBe('POST');
        expect(options?.body).toBeInstanceOf(FormData);

        const body = options?.body as FormData;
        expect(body.get('name')).toBe('Ana Gomez');
        expect(body.get('email')).toBe('ana@mail.com');
        expect(body.get('username')).toBe('anagomez');
        expect(body.get('phone')).toBe('3101234568');
        expect(body.get('countryCode')).toBe('+57');
        expect(body.get('avatar')).toBe(avatarFile);
        expect(useAuthStore.getState().user?.avatar).toBe(
            'http://localhost:3004/uploads/avatars/profile-photo.webp',
        );
    });

    it('rehydrates and normalizes avatar references during checkAuth', async () => {
        localStorage.setItem('token', 'token-profile');
        requestMock.mockResolvedValueOnce({
            id: 'user-3',
            name: 'Luisa',
            email: 'luisa@mail.com',
            username: 'luisa',
            avatar: '/uploads/avatars/luisa.png',
            emailVerified: true,
        });

        await useAuthStore.getState().checkAuth();

        expect(requestMock).toHaveBeenCalledWith('/auth/profile');
        expect(useAuthStore.getState().user?.avatar).toBe('http://localhost:3004/uploads/avatars/luisa.png');
        expect(useAuthStore.getState().emailVerified).toBe(true);
    });

    it('clears stale session state when checkAuth fails', async () => {
        localStorage.setItem('token', 'stale-token');
        useAuthStore.setState({
            user: {
                id: 'user-stale',
                name: 'Stale User',
                email: 'stale@mail.com',
                username: 'stale',
                role: 'PLAYER',
                avatar: 'http://localhost:3004/uploads/avatars/stale.png',
            },
            token: 'stale-token',
            isLoading: false,
            sessionChecked: false,
            emailVerified: true,
        });
        requestMock.mockRejectedValueOnce(new Error('Unauthorized'));

        await useAuthStore.getState().checkAuth();

        expect(localStorage.getItem('token')).toBeNull();
        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().token).toBeNull();
        expect(useAuthStore.getState().sessionChecked).toBe(true);
        expect(useAuthStore.getState().emailVerified).toBe(false);
    });
});
