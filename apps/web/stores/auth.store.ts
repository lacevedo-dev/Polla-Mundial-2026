import { create } from 'zustand';
import { request } from '../api';

interface User {
    id: string;
    name: string;
    email: string;
    username: string;
    role: string;
    plan?: string;
    avatar?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (data: any) => Promise<void>;
    register: (data: any) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: localStorage.getItem('token'),
    isLoading: false,

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
            set({
                user: response.user,
                token,
                isLoading: false
            });
        } catch (error) {
            set({ isLoading: false });
            throw error;
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
            set({
                user: response.user,
                token,
                isLoading: false
            });
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null });
    },

    checkAuth: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const user: any = await request('/auth/profile');
            set({ user, token });
        } catch (e) {
            localStorage.removeItem('token');
            set({ user: null, token: null });
        }
    }
}));
