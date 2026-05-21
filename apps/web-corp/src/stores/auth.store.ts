import { create } from 'zustand';
import { request, ApiError } from '../api';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    username: string;
    avatar?: string | null;
    plan?: string;
    systemRole?: string;
    emailVerified?: boolean;
    mustChangePassword?: boolean;
}

interface LoginResponse {
    accessToken: string;
    user: AuthUser;
}

interface AuthStoreState {
    user: AuthUser | null;
    isLoading: boolean;
    error: string | null;
    login: (identifier: string, password: string) => Promise<AuthUser>;
    logout: () => void;
    restoreSession: () => Promise<void>;
    setMustChangePassword: (value: boolean) => void;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
    user: null,
    isLoading: false,
    error: null,

    login: async (identifier, password) => {
        set({ isLoading: true, error: null });
        try {
            const res = await request<LoginResponse>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ identifier, password }),
            });
            localStorage.setItem('corp_token', res.accessToken);
            set({ user: res.user, isLoading: false });
            return res.user;
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
            const user = await request<AuthUser>('/auth/profile');
            set({ user });
        } catch {
            localStorage.removeItem('corp_token');
            set({ user: null });
        }
    },

    setMustChangePassword: (value) => {
        const user = get().user;
        if (user) set({ user: { ...user, mustChangePassword: value } });
    },
}));
