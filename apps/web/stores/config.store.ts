import { create } from 'zustand';
import { request } from '../api';

export interface PlanPublicConfig {
    siCredits: number;
}

interface ConfigState {
    planConfig: Record<string, PlanPublicConfig>;
    isFetched: boolean;
    fetchPlanConfig: () => Promise<void>;
    getSiCredits: (plan: string) => number;
}

const FALLBACK_SI_CREDITS: Record<string, number> = {
    FREE: 3,
    GOLD: 30,
    DIAMOND: 100,
};

export const useConfigStore = create<ConfigState>((set, get) => ({
    planConfig: {},
    isFetched: false,

    fetchPlanConfig: async () => {
        if (get().isFetched) return;
        try {
            const data = await request<Record<string, PlanPublicConfig>>('/config/plans');
            set({ planConfig: data, isFetched: true });
        } catch {
            // Keep fallback values if endpoint fails
            set({ isFetched: true });
        }
    },

    getSiCredits: (plan: string) => {
        const normalized = plan.toUpperCase();
        const config = get().planConfig[normalized];
        return config?.siCredits ?? FALLBACK_SI_CREDITS[normalized] ?? 3;
    },
}));
