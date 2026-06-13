import { create } from 'zustand';
import { request, ApiError, resolveApiAssetUrl } from '../api';

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
    needsAvatarUpdate?: boolean;
    tenantRole?: string;
}

interface LoginResponse {
    accessToken: string;
    user: AuthUser;
}

function normalizeAuthUser(user: AuthUser): AuthUser {
    return {
        ...user,
        avatar: resolveApiAssetUrl(user.avatar) ?? user.avatar,
    };
}

interface AuthStoreState {
    user: AuthUser | null;
    isLoading: boolean;
    error: string | null;
    login: (identifier: string, password: string, recaptchaToken?: string) => Promise<AuthUser>;
    logout: () => void;
    restoreSession: () => Promise<void>;
    setMustChangePassword: (value: boolean) => void;
    setNeedsAvatarUpdate: (value: boolean) => void;
    updateAvatarFromProfile: (avatar?: string | null, needsAvatarUpdate?: boolean) => void;
    setTenantRole: (role: string) => void;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
    user: null,
    isLoading: false,
    error: null,

    login: async (identifier, password, recaptchaToken) => {
        set({ isLoading: true, error: null });
        try {
            const res = await request<LoginResponse>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ identifier, password, recaptchaToken }),
            });
            localStorage.setItem('corp_token', res.accessToken);
            const user = normalizeAuthUser(res.user);
            set({ user, isLoading: false });
            return user;
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
            const user = normalizeAuthUser(await request<AuthUser>('/auth/profile'));
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

    setNeedsAvatarUpdate: (value) => {
        const user = get().user;
        if (user) {
            set({
                user: {
                    ...user,
                    needsAvatarUpdate: value,
                    avatar: value ? null : user.avatar,
                },
            });
        }
    },

    updateAvatarFromProfile: (avatar, needsAvatarUpdate = false) => {
        const user = get().user;
        if (!user) return;
        set({
            user: normalizeAuthUser({
                ...user,
                avatar,
                needsAvatarUpdate,
            }),
        });
    },

    setTenantRole: (role) => {
        const user = get().user;
        if (user) set({ user: { ...user, tenantRole: role } });
    },
}));
