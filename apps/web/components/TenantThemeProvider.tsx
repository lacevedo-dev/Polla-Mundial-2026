import React, { createContext, useContext, useEffect, useState } from 'react';
import { TenantContext } from '@polla-2026/shared';
import { useTenantStore, detectTenantSlug } from '../stores/tenant.store';

interface TenantThemeContextValue {
    tenant: TenantContext | null;
    isLoading: boolean;
    isCorporate: boolean;
    isB2BLanding: boolean;
}

const TenantThemeContext = createContext<TenantThemeContextValue>({
    tenant: null,
    isLoading: false,
    isCorporate: false,
    isB2BLanding: false,
});

export function useTenantTheme() {
    return useContext(TenantThemeContext);
}

interface TenantThemeProviderProps {
    children: React.ReactNode;
}

export function TenantThemeProvider({ children }: TenantThemeProviderProps) {
    const { activeTenant, isLoading, loadTenant } = useTenantStore();
    const [slug, setSlug] = useState<string | null>(null);

    const hostname = window.location.hostname;
    const isB2BLanding =
        (hostname === 'zonapronosticos.com' || hostname === 'www.zonapronosticos.com') && !slug;
    const isCorporate = !!slug;

    useEffect(() => {
        const detected = detectTenantSlug();
        if (detected) {
            setSlug(detected);
            loadTenant(detected);
        }
    }, [loadTenant]);

    useEffect(() => {
        if (!activeTenant?.branding) return;

        const { branding } = activeTenant;
        const root = document.documentElement;

        root.style.setProperty('--color-primary', branding.primaryColor);
        root.style.setProperty('--color-secondary', branding.secondaryColor);
        root.style.setProperty('--color-accent', branding.accentColor);
        root.style.setProperty('--font-brand', branding.fontFamily);

        if (branding.companyDisplayName) {
            document.title = branding.companyDisplayName;
        }

        if (branding.faviconUrl) {
            let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = branding.faviconUrl;
        }

        if (branding.customCss) {
            const id = 'tenant-custom-css';
            let style = document.getElementById(id) as HTMLStyleElement | null;
            if (!style) {
                style = document.createElement('style');
                style.id = id;
                document.head.appendChild(style);
            }
            style.textContent = branding.customCss;
        }

        return () => {
            root.style.removeProperty('--color-primary');
            root.style.removeProperty('--color-secondary');
            root.style.removeProperty('--color-accent');
            root.style.removeProperty('--font-brand');
        };
    }, [activeTenant?.branding]);

    return (
        <TenantThemeContext.Provider
            value={{
                tenant: activeTenant,
                isLoading,
                isCorporate,
                isB2BLanding,
            }}
        >
            {children}
        </TenantThemeContext.Provider>
    );
}
