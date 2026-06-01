import React, { useEffect, useState } from 'react';
import { Image, Loader2, Palette, Save, ShieldAlert } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request } from '../api';
import { useAuthStore } from '../stores/auth.store';
import { useTenantStore } from '../stores/tenant.store';

const COOPCANAPRO_LOGIN_BACKGROUND = 'https://coopcanapro.coop/wp-content/uploads/2026/05/Pagina-web.jpg';

type BrandingDraft = {
    companyDisplayName: string;
    logoUrl: string;
    faviconUrl: string;
    heroImageUrl: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
};

function trimValue(value: string) {
    return value.trim();
}

function optionalTrimmed(value: string) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export default function AdminCorpSettings() {
    const user = useAuthStore((s) => s.user);
    const tenant = useTenantStore((s) => s.tenant);
    const bootstrap = useTenantStore((s) => s.bootstrap);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isAdmin = user?.tenantRole === 'OWNER' || user?.tenantRole === 'ADMIN';

    const [draft, setDraft] = useState<BrandingDraft>({
        companyDisplayName: '',
        logoUrl: '',
        faviconUrl: '',
        heroImageUrl: '',
        primaryColor: '#f59e0b',
        secondaryColor: '#15803d',
        accentColor: '#bbf7d0',
        fontFamily: 'Inter',
    });

    useEffect(() => {
        if (!tenant?.branding) return;
        setDraft({
            companyDisplayName: tenant.branding.companyDisplayName ?? '',
            logoUrl: tenant.branding.logoUrl ?? '',
            faviconUrl: tenant.branding.faviconUrl ?? '',
            heroImageUrl: tenant.branding.heroImageUrl ?? (tenant.slug === 'coopcanapro' ? COOPCANAPRO_LOGIN_BACKGROUND : ''),
            primaryColor: tenant.branding.primaryColor ?? '#f59e0b',
            secondaryColor: tenant.branding.secondaryColor ?? '#15803d',
            accentColor: tenant.branding.accentColor ?? '#bbf7d0',
            fontFamily: tenant.branding.fontFamily ?? 'Inter',
        });
    }, [tenant]);

    const setField = (key: keyof BrandingDraft, value: string) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            await request('/corp/branding', {
                method: 'PATCH',
                body: JSON.stringify({
                    companyDisplayName: optionalTrimmed(draft.companyDisplayName),
                    logoUrl: optionalTrimmed(draft.logoUrl),
                    faviconUrl: optionalTrimmed(draft.faviconUrl),
                    heroImageUrl: optionalTrimmed(draft.heroImageUrl),
                    primaryColor: draft.primaryColor,
                    secondaryColor: draft.secondaryColor,
                    accentColor: draft.accentColor,
                    fontFamily: trimValue(draft.fontFamily) || 'Inter',
                }),
            });
            await bootstrap();
            setMessage('Configuración guardada. El fondo del login se actualizará para los usuarios del portal.');
        } catch (err: any) {
            setError(err?.message ?? 'No fue posible guardar la configuración.');
        } finally {
            setSaving(false);
        }
    };

    if (!isAdmin) {
        return (
            <CorpLayout>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 flex gap-3">
                    <ShieldAlert className="shrink-0" />
                    <div>
                        <h1 className="font-black">Permisos insuficientes</h1>
                        <p className="text-sm mt-1">Solo propietarios o administradores pueden modificar el branding del portal.</p>
                    </div>
                </div>
            </CorpLayout>
        );
    }

    return (
        <CorpLayout>
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <Palette size={20} style={{ color: 'var(--color-primary, #f59e0b)' }} />
                    <h1 className="text-2xl font-black text-slate-900">Configuración del portal</h1>
                </div>
                <p className="text-slate-500 text-sm">Personaliza la identidad visual y la imagen de fondo del login corporativo.</p>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
                    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}
                    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="space-y-1.5">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Nombre visible</span>
                            <input value={draft.companyDisplayName} onChange={(e) => setField('companyDisplayName', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-amber-400" placeholder={tenant?.name ?? 'Mi empresa'} />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Fuente</span>
                            <input value={draft.fontFamily} onChange={(e) => setField('fontFamily', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-amber-400" placeholder="Inter" />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Logo URL</span>
                            <input value={draft.logoUrl} onChange={(e) => setField('logoUrl', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-amber-400" placeholder="https://.../logo.png" />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Favicon URL</span>
                            <input value={draft.faviconUrl} onChange={(e) => setField('faviconUrl', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-amber-400" placeholder="https://.../favicon.ico" />
                        </label>
                    </div>

                    <label className="block space-y-1.5">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Image size={14} /> Fondo del login</span>
                        <input value={draft.heroImageUrl} onChange={(e) => setField('heroImageUrl', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-amber-400" placeholder={COOPCANAPRO_LOGIN_BACKGROUND} />
                        <span className="text-xs text-slate-400">Para Coopcanapro se prellenó la imagen solicitada; puedes reemplazarla por otra URL pública cuando sea necesario.</span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {([
                            ['primaryColor', 'Primario'],
                            ['secondaryColor', 'Secundario'],
                            ['accentColor', 'Acento'],
                        ] as [keyof BrandingDraft, string][]).map(([key, label]) => (
                            <label key={key} className="space-y-1.5">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
                                <div className="flex gap-2">
                                    <input type="color" value={draft[key]} onChange={(e) => setField(key, e.target.value)} className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1" />
                                    <input value={draft[key]} onChange={(e) => setField(key, e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none focus:border-amber-400" />
                                </div>
                            </label>
                        ))}
                    </div>

                    <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-black transition disabled:opacity-60" style={{ backgroundColor: 'var(--color-primary, #f59e0b)' }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Guardando...' : 'Guardar configuración'}
                    </button>
                </div>

                <aside className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-fit">
                    <h2 className="font-black text-slate-900 mb-3">Vista previa del login</h2>
                    <div className="rounded-2xl overflow-hidden min-h-[420px] bg-slate-950 p-5 flex items-center justify-center" style={draft.heroImageUrl.trim() ? { backgroundImage: `linear-gradient(rgba(2,6,23,0.50), rgba(2,6,23,0.75)), url(${draft.heroImageUrl.trim()})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                        <div className="w-full max-w-[260px] text-center">
                            {draft.logoUrl.trim() ? <img src={draft.logoUrl.trim()} alt="Logo" className="h-12 mx-auto object-contain mb-3" /> : <div className="w-12 h-12 mx-auto mb-3 rounded-2xl" style={{ backgroundColor: draft.primaryColor }} />}
                            <p className="font-black text-white text-lg">{draft.companyDisplayName || tenant?.name || 'Tu empresa'}</p>
                            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/95 p-4 text-left space-y-3">
                                <div className="h-10 rounded-xl bg-slate-800" />
                                <div className="h-10 rounded-xl bg-slate-800" />
                                <div className="h-10 rounded-xl" style={{ backgroundColor: draft.primaryColor }} />
                            </div>
                        </div>
                    </div>
                </aside>
            </form>
        </CorpLayout>
    );
}
