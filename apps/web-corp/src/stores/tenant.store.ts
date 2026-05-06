import { create } from 'zustand';
import { TenantContext } from '@polla-2026/shared';
import { request, ApiError } from '../api';

type TenantPhase = 'loading' | 'landing' | 'portal';

interface TenantStoreState {
    phase: TenantPhase;
    tenant: TenantContext | null;
    error: string | null;
    bootstrap: () => Promise<void>;
}

export const useTenantStore = create<TenantStoreState>((set) => ({
    phase: 'loading',
    tenant: null,
    error: null,

    bootstrap: async () => {
        const slug = detectTenantSlug();

        if (!slug) {
            set({ phase: 'landing', tenant: null });
            return;
        }

        try {
            const tenant = await request<TenantContext>(`/tenant/${slug}/context`);
            set({ phase: 'portal', tenant });
            applyTenantBranding(tenant);
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                set({ phase: 'landing', tenant: null });
            } else {
                set({ phase: 'landing', tenant: null, error: 'No se pudo conectar con el servidor' });
            }
        }
    },
}));

export function detectTenantSlug(): string | null {
    const hostname = window.location.hostname;

    const subdomainMatch = hostname.match(/^([^.]+)\.zonapronosticos\.com$/);
    if (subdomainMatch && subdomainMatch[1] !== 'www') {
        return subdomainMatch[1];
    }

    const isCustomDomain =
        !hostname.includes('zonapronosticos.com') &&
        !hostname.includes('tupollamundial.com') &&
        !hostname.includes('localhost') &&
        !hostname.includes('127.0.0.1');

    if (isCustomDomain) return hostname;

    return import.meta.env.VITE_TENANT_SLUG ?? null;
}

function applyTenantBranding(tenant: TenantContext) {
    const b = tenant.branding;
    if (!b) return;

    const root = document.documentElement;
    if (b.primaryColor) root.style.setProperty('--color-primary', b.primaryColor);
    if (b.secondaryColor) root.style.setProperty('--color-secondary', b.secondaryColor);
    if (b.accentColor) root.style.setProperty('--color-accent', b.accentColor);
    if (b.fontFamily) root.style.setProperty('--font-family', b.fontFamily);

    if (b.faviconUrl) {
        const link: HTMLLinkElement = document.querySelector("link[rel='icon']") ?? document.createElement('link');
        link.rel = 'icon';
        link.href = b.faviconUrl;
        document.head.appendChild(link);
    }

    document.title = b.companyDisplayName
        ? `${b.companyDisplayName} — Pronósticos`
        : (tenant.name ?? 'Portal Corporativo');
}
