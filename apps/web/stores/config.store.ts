import { create } from 'zustand';
import { request } from '../api';

export interface PlanPublicConfig {
    siCredits: number;
}

interface ConfigState {
    planConfig: Record<string, PlanPublicConfig>;
    creditsResetAt: string | null;
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
    creditsResetAt: null,
    isFetched: false,

    fetchPlanConfig: async () => {
        if (get().isFetched) return;
        try {
            const data = await request<Record<string, unknown>>('/config/plans');
            const { _meta, ...plans } = data as { _meta?: { creditsResetAt?: string | null }; [key: string]: unknown };
            set({
                planConfig: plans as Record<string, PlanPublicConfig>,
                creditsResetAt: _meta?.creditsResetAt ?? null,
                isFetched: true,
            });
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
