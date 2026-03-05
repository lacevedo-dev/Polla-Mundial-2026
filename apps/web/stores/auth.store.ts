import { create } from 'zustand';

interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
    plan: 'free' | 'gold' | 'diamond';
    avatar: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string) => void;
    logout: () => void;
    updateUser: (data: Partial<User>) => void;
}

const MOCK_ADMIN: User = {
    id: 'admin-123',
    name: 'Administrador',
    email: 'admin@polla2026.com',
    role: 'admin',
    plan: 'diamond',
    avatar: 'https://i.pravatar.cc/150?u=admin-123'
};

export const useAuthStore = create<AuthState>((set) => ({
    user: MOCK_ADMIN, // Por defecto siempre logueado como admin en la V1 mock
    isAuthenticated: true,
    login: (email) => set({
        user: { ...MOCK_ADMIN, email },
        isAuthenticated: true
    }),
    logout: () => set({ user: null, isAuthenticated: false }),
    updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
    }))
}));
