import { create } from 'zustand';
import { request } from '../api';

export interface PlanConfig {
    maxLeagues: number;
    maxParticipants: number;
    features: string[];
    price: number;
    siCredits: number;
}

export interface AffiliationUser {
    id: string;
    name: string;
    email: string;
    username: string;
    avatar?: string;
    plan: string;
    systemRole: string;
    createdAt: string;
}

interface AdminPlansState {
    plans: Record<string, PlanConfig>;
    affiliations: AffiliationUser[];
    totalAffiliations: number;
    affiliationsPage: number;
    affiliationsSearch: string;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;

    fetchPlans: () => Promise<void>;
    updatePlan: (planName: string, config: PlanConfig) => Promise<void>;
    fetchAffiliations: (page?: number, search?: string, plan?: string) => Promise<void>;
    updateAffiliation: (userId: string, plan: string) => Promise<void>;
}

export const useAdminPlansStore = create<AdminPlansState>((set, get) => ({
    plans: {},
    affiliations: [],
    totalAffiliations: 0,
    affiliationsPage: 1,
    affiliationsSearch: '',
    isLoading: false,
    isSaving: false,
    error: null,

    fetchPlans: async () => {
        set({ isLoading: true, error: null });
        try {
            const plans = await request<Record<string, PlanConfig>>('/admin/plans');
            set({ plans, isLoading: false });
        } catch (error) {
            set({ isLoading: false, error: error instanceof Error ? error.message : 'Error al cargar planes' });
        }
    },

    updatePlan: async (planName, config) => {
        set({ isSaving: true });
        try {
            await request(`/admin/plans/${planName}`, {
                method: 'PATCH',
                body: JSON.stringify(config),
            });
            set((state) => ({
                plans: { ...state.plans, [planName]: config },
                isSaving: false,
            }));
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error al actualizar plan' });
            throw error;
        }
    },

    fetchAffiliations: async (page = 1, search = '', plan = '') => {
        const params = new URLSearchParams({
            page: String(page),
            limit: '20',
            ...(search && { search }),
            ...(plan && { plan }),
        });
        set({ isLoading: true, error: null });
        try {
            const response = await request<{ data: AffiliationUser[]; total: number }>(`/admin/affiliations?${params}`);
            set({
                affiliations: response.data,
                totalAffiliations: response.total,
                affiliationsPage: page,
                affiliationsSearch: search,
                isLoading: false,
            });
        } catch (error) {
            set({ isLoading: false, error: error instanceof Error ? error.message : 'Error' });
        }
    },

    updateAffiliation: async (userId, plan) => {
        set({ isSaving: true });
        try {
            await request(`/admin/affiliations/${userId}`, {
                method: 'PATCH',
                body: JSON.stringify({ plan }),
            });
            set((state) => ({
                affiliations: state.affiliations.map((u) =>
                    u.id === userId ? { ...u, plan } : u
                ),
                isSaving: false,
            }));
        } catch (error) {
            set({ isSaving: false, error: error instanceof Error ? error.message : 'Error' });
            throw error;
        }
    },
}));
