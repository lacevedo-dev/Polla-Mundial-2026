import { create } from 'zustand';
import { request, ApiError } from '../api';

interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: string;
}

interface AuthStoreState {
    user: AuthUser | null;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
    user: null,
    isLoading: false,
    error: null,

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const res = await request<{ access_token: string; user: AuthUser }>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            localStorage.setItem('corp_token', res.access_token);
            set({ user: res.user, isLoading: false });
        } catch (err) {
            const msg = err instanceof ApiError ? err.message : 'Error al iniciar sesión';
            set({ error: msg, isLoading: false });
            throw err;
        }
    },

    logout: () => {
        localStorage.removeItem('corp_token');
        set({ user: null });
    },

    restoreSession: async () => {
        const token = localStorage.getItem('corp_token');
        if (!token) return;
        try {
            const user = await request<AuthUser>('/auth/me');
            set({ user });
        } catch {
            localStorage.removeItem('corp_token');
        }
    },
}));
