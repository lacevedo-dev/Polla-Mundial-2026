import { create } from 'zustand';
import { request } from '../api';
import { normalizeAuthError } from './auth.error';

interface User {
    id: string;
    name: string;
    email: string;
    username: string;
    role: string;
    plan?: string;
    avatar?: string;
    emailVerified?: boolean;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    emailVerified: boolean;
    login: (data: any) => Promise<void>;
    register: (data: any) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
    verifyEmail: (token: string) => Promise<void>;
    resendVerification: () => Promise<void>;
    isEmailVerified: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: localStorage.getItem('token'),
    isLoading: false,
    emailVerified: false,

    login: async (credentials) => {
        set({ isLoading: true });
        try {
            const response: any = await request('/auth/login', {
                method: 'POST',
                body: JSON.stringify(credentials),
            });
            const token = response.accessToken ?? response.access_token;
            if (!token) {
                throw new Error('La API no devolvió un token de acceso.');
            }
            localStorage.setItem('token', token);
            const emailVerified = response.user?.emailVerified ?? false;
            set({
                user: response.user,
                token,
                emailVerified,
                isLoading: false,
            });
        } catch (error) {
            set({ isLoading: false });
            throw normalizeAuthError(error, 'login');
        }
    },

    register: async (data) => {
        set({ isLoading: true });
        try {
            const response: any = await request('/auth/register', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            const token = response.accessToken ?? response.access_token;
            if (!token) {
                throw new Error('La API no devolvió un token de acceso.');
            }
            localStorage.setItem('token', token);
            const emailVerified = response.user?.emailVerified ?? false;
            set({
                user: response.user,
                token,
                emailVerified,
                isLoading: false,
            });
            return response;
        } catch (error) {
            set({ isLoading: false });
            throw normalizeAuthError(error, 'register');
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, emailVerified: false });
    },

    checkAuth: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const user: any = await request('/auth/profile');
            const emailVerified = user?.emailVerified ?? false;
            set({ user, token, emailVerified });
        } catch {
            localStorage.removeItem('token');
            set({ user: null, token: null, emailVerified: false });
        }
    },

    verifyEmail: async (token: string) => {
        set({ isLoading: true });
        try {
            const response: any = await request('/auth/verify-email', {
                method: 'POST',
                body: JSON.stringify({ token }),
            });
            const user = response.user ?? get().user;
            const emailVerified = response.user?.emailVerified ?? true;
            set({
                user: { ...user, emailVerified },
                emailVerified,
                isLoading: false,
            });
        } catch (error) {
            set({ isLoading: false });
            throw normalizeAuthError(error, 'verifyEmail');
        }
    },

    resendVerification: async () => {
        set({ isLoading: true });
        try {
            await request('/auth/resend-verification', {
                method: 'POST',
            });
            set({ isLoading: false });
        } catch (error) {
            set({ isLoading: false });
            throw normalizeAuthError(error, 'resendVerification');
        }
    },

    isEmailVerified: () => {
        const state = get();
        return state.user?.emailVerified ?? state.emailVerified;
    },
}));
