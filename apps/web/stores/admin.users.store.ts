import { create } from 'zustand';
import { request } from '../api';

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    username: string;
    avatar?: string;
    plan: string;
    systemRole: string;
    emailVerified: boolean;
    status?: string;
    createdAt: string;
    _count?: { leagues: number; predictions: number };
}

export interface UsersListResponse {
    data: AdminUser[];
    total: number;
    page: number;
    limit: number;
}

interface AdminUsersFilters {
    page: number;
    limit: number;
    search: string;
    plan?: string;
    systemRole?: string;
}

interface AdminUsersState {
    users: AdminUser[];
    selectedUser: AdminUser | null;
    total: number;
    filters: AdminUsersFilters;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    fetchUsers: () => Promise<void>;
    fetchUser: (id: string) => Promise<void>;
    updateUser: (id: string, data: Partial<{ plan: string; systemRole: string; emailVerified: boolean }>) => Promise<void>;
    banUser: (id: string) => Promise<void>;
    activateUser: (id: string) => Promise<void>;
    deleteUser: (id: string) => Promise<void>;
    resetUserCredits: (id: string) => Promise<void>;
    setFilters: (filters: Partial<AdminUsersFilters>) => void;
    setSelectedUser: (user: AdminUser | null) => void;
}

export const useAdminUsersStore = create<AdminUsersState>((set, get) => ({
    users: [],
    selectedUser: null,
    total: 0,
    filters: { page: 1, limit: 20, search: '' },
    isLoading: false,
    isSaving: false,
    error: null,

    fetchUsers: async () => {
        const { filters } = get();
        const params = new URLSearchParams({
            page: String(filters.page),
            limit: String(filters.limit),
            ...(filters.search && { search: filters.search }),
            ...(filters.plan && { plan: filters.plan }),
            ...(filters.systemRole && { systemRole: filters.systemRole }),
        });

        set({ isLoading: true, error: null });
        try {
            const response = await request<UsersListResponse>(`/admin/users?${params}`);
            set({ users: response.data, total: response.total, isLoading: false });
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Error al cargar usuarios',
            });
        }
    },

    fetchUser: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const user = await request<AdminUser>(`/admin/users/${id}`);
            set({ selectedUser: user, isLoading: false });
        } catch (error) {
            set({ isLoading: false, error: error instanceof Error ? error.message : 'Error' });
        }
    },

    updateUser: async (id, data) => {
        set({ isSaving: true, error: null });
        try {
            const updated = await request<AdminUser>(`/admin/users/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            set((state) => ({
                users: state.users.map((u) => (u.id === id ? { ...u, ...updated } : u)),
                selectedUser: state.selectedUser?.id === id ? { ...state.selectedUser, ...updated } : state.selectedUser,
                isSaving: false,
            }));
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error al actualizar' });
            throw error;
        }
    },

    banUser: async (id) => {
        set({ isSaving: true });
        try {
            await request(`/admin/users/${id}/ban`, { method: 'POST' });
            set({ isSaving: false });
            get().fetchUsers();
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    activateUser: async (id) => {
        set({ isSaving: true });
        try {
            await request(`/admin/users/${id}/activate`, { method: 'POST' });
            set({ isSaving: false });
            get().fetchUsers();
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    deleteUser: async (id) => {
        set({ isSaving: true });
        try {
            await request(`/admin/users/${id}`, { method: 'DELETE' });
            set((state) => ({
                users: state.users.filter((u) => u.id !== id),
                total: state.total - 1,
                isSaving: false,
            }));
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    resetUserCredits: async (id) => {
        set({ isSaving: true });
        try {
            await request(`/admin/users/${id}/credits/reset`, { method: 'POST' });
            set({ isSaving: false });
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },

    setFilters: (filters) => {
        set((state) => ({ filters: { ...state.filters, ...filters } }));
    },

    setSelectedUser: (user) => {
        set({ selectedUser: user });
    },
}));
