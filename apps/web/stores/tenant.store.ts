import { create } from 'zustand';
import { TenantContext } from '@polla-2026/shared';
import { request } from '../api';

interface TenantStoreState {
    activeTenant: TenantContext | null;
    isLoading: boolean;
    error: string | null;
    resolvedSlug: string | null;

    loadTenant: (slug: string) => Promise<void>;
    clearTenant: () => void;
}

export const useTenantStore = create<TenantStoreState>((set, get) => ({
    activeTenant: null,
    isLoading: false,
    error: null,
    resolvedSlug: null,

    loadTenant: async (slug: string) => {
        if (get().resolvedSlug === slug && get().activeTenant) return;

        set({ isLoading: true, error: null });
        try {
            const tenant = await request<TenantContext>(`/tenant/${slug}/context`);
            set({ activeTenant: tenant, resolvedSlug: slug, isLoading: false });
        } catch (err: any) {
            set({ error: err?.message ?? 'Error al cargar el tenant', isLoading: false });
        }
    },

    clearTenant: () => {
        set({ activeTenant: null, resolvedSlug: null, error: null });
    },
}));

export function getSubdomain(hostname: string): string | null {
    const parts = hostname.split('.');
    if (parts.length >= 3 && parts.slice(1).join('.') === 'zonapronosticos.com') {
        return parts[0];
    }
    return null;
}

export function isCorporateDomain(hostname: string): boolean {
    return !hostname.includes('tupollamundial.com') &&
        !hostname.includes('zonapronosticos.com') &&
        !hostname.includes('localhost');
}

export function detectTenantSlug(): string | null {
    const hostname = window.location.hostname;
    const subdomain = getSubdomain(hostname);
    if (subdomain) return subdomain;
    if (isCorporateDomain(hostname)) return hostname;
    const devSlug = import.meta.env.VITE_TENANT_SLUG as string | undefined;
    return devSlug ?? null;
}
