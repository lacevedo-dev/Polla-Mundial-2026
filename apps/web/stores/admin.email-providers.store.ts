import { create } from 'zustand';
import { request } from '../api';

export interface EmailProviderUsageToday {
    sentCount?: number;
    blockedUntil?: string | null;
    lastError?: string | null;
}

export interface AdminEmailProvider {
    id: string;
    key: string;
    name: string;
    fromEmail: string;
    fromName?: string | null;
    smtpHost: string;
    smtpPort: number;
    secure: boolean;
    smtpUser?: string | null;
    hasPassword?: boolean;
    dailyLimit: number;
    reservedHighPriority: number;
    maxRecipientsPerMessage: number;
    maxEmailSizeMb: number;
    maxAttachmentSizeMb: number;
    active: boolean;
    blockedUntil?: string | null;
    lastError?: string | null;
    lastUsedAt?: string | null;
    updatedAt?: string | null;
    usageToday?: EmailProviderUsageToday;
}

export interface EmailProviderFormData {
    key: string;
    name: string;
    fromEmail: string;
    fromName?: string;
    smtpHost: string;
    smtpPort: number;
    secure: boolean;
    smtpUser?: string;
    smtpPass?: string;
    dailyLimit: number;
    reservedHighPriority: number;
    maxRecipientsPerMessage: number;
    maxEmailSizeMb: number;
    maxAttachmentSizeMb: number;
    active?: boolean;
}

interface EmailProviderFilters {
    active?: 'all' | 'true' | 'false';
    search: string;
}

interface AdminEmailProvidersState {
    accounts: AdminEmailProvider[];
    selectedAccount: AdminEmailProvider | null;
    filters: EmailProviderFilters;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    fetchAccounts: () => Promise<void>;
    fetchAccount: (id: string) => Promise<void>;
    createAccount: (data: EmailProviderFormData) => Promise<AdminEmailProvider>;
    updateAccount: (id: string, data: Partial<EmailProviderFormData>) => Promise<AdminEmailProvider>;
    activateAccount: (id: string) => Promise<void>;
    deactivateAccount: (id: string) => Promise<void>;
    deleteAccount: (id: string) => Promise<void>;
    setFilters: (filters: Partial<EmailProviderFilters>) => void;
    setSelectedAccount: (account: AdminEmailProvider | null) => void;
    clearError: () => void;
}

function buildQuery(filters: EmailProviderFilters) {
    const params = new URLSearchParams();
    if (filters.search.trim()) params.set('search', filters.search.trim());
    if (filters.active === 'true' || filters.active === 'false') params.set('active', filters.active);
    return params.toString();
}

export const useAdminEmailProvidersStore = create<AdminEmailProvidersState>((set, get) => ({
    accounts: [],
    selectedAccount: null,
    filters: { active: 'all', search: '' },
    isLoading: false,
    isSaving: false,
    error: null,

    fetchAccounts: async () => {
        set({ isLoading: true, error: null });
        try {
            const query = buildQuery(get().filters);
            const path = query ? `/admin/email-providers?${query}` : '/admin/email-providers';
            const accounts = await request<AdminEmailProvider[]>(path);
            set({ accounts, isLoading: false });
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Error al cargar cuentas SMTP',
            });
        }
    },

    fetchAccount: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const account = await request<AdminEmailProvider>(`/admin/email-providers/${id}`);
            set({ selectedAccount: account, isLoading: false });
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Error al cargar la cuenta SMTP',
            });
        }
    },

    createAccount: async (data) => {
        set({ isSaving: true, error: null });
        try {
            const created = await request<AdminEmailProvider>('/admin/email-providers', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            set((state) => ({
                accounts: [created, ...state.accounts],
                selectedAccount: created,
                isSaving: false,
            }));
            return created;
        } catch (error) {
            set({
                isSaving: false,
                error: error instanceof Error ? error.message : 'Error al crear la cuenta SMTP',
            });
            throw error;
        }
    },

    updateAccount: async (id, data) => {
        set({ isSaving: true, error: null });
        try {
            const updated = await request<AdminEmailProvider>(`/admin/email-providers/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            set((state) => ({
                accounts: state.accounts.map((account) => (account.id === id ? updated : account)),
                selectedAccount: state.selectedAccount?.id === id ? updated : state.selectedAccount,
                isSaving: false,
            }));
            return updated;
        } catch (error) {
            set({
                isSaving: false,
                error: error instanceof Error ? error.message : 'Error al actualizar la cuenta SMTP',
            });
            throw error;
        }
    },

    activateAccount: async (id) => {
        set({ isSaving: true, error: null });
        try {
            const updated = await request<AdminEmailProvider>(`/admin/email-providers/${id}/activate`, {
                method: 'PATCH',
            });
            set((state) => ({
                accounts: state.accounts.map((account) => (account.id === id ? updated : account)),
                selectedAccount: state.selectedAccount?.id === id ? updated : state.selectedAccount,
                isSaving: false,
            }));
        } catch (error) {
            set({
                isSaving: false,
                error: error instanceof Error ? error.message : 'Error al activar la cuenta SMTP',
            });
            throw error;
        }
    },

    deactivateAccount: async (id) => {
        set({ isSaving: true, error: null });
        try {
            const updated = await request<AdminEmailProvider>(`/admin/email-providers/${id}/deactivate`, {
                method: 'PATCH',
            });
            set((state) => ({
                accounts: state.accounts.map((account) => (account.id === id ? updated : account)),
                selectedAccount: state.selectedAccount?.id === id ? updated : state.selectedAccount,
                isSaving: false,
            }));
        } catch (error) {
            set({
                isSaving: false,
                error: error instanceof Error ? error.message : 'Error al desactivar la cuenta SMTP',
            });
            throw error;
        }
    },

    deleteAccount: async (id) => {
        set({ isSaving: true, error: null });
        try {
            await request(`/admin/email-providers/${id}`, { method: 'DELETE' });
            set((state) => ({
                accounts: state.accounts.filter((account) => account.id !== id),
                selectedAccount: state.selectedAccount?.id === id ? null : state.selectedAccount,
                isSaving: false,
            }));
        } catch (error) {
            set({
                isSaving: false,
                error: error instanceof Error ? error.message : 'Error al eliminar la cuenta SMTP',
            });
            throw error;
        }
    },

    setFilters: (filters) => {
        set((state) => ({ filters: { ...state.filters, ...filters } }));
    },

    setSelectedAccount: (account) => set({ selectedAccount: account }),
    clearError: () => set({ error: null }),
}));
