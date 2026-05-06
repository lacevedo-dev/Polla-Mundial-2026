import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Building2, Users, Trophy, CheckCircle2, Clock, XCircle, PauseCircle,
    Palette, Settings, Mail, UserPlus, RefreshCw, Save, Send, RotateCcw, Zap,
} from 'lucide-react';
import { request } from '../../api';

/* ─── Types ─────────────────────────────────────────────── */
type PlanTier = 'STARTER' | 'BUSINESS' | 'ENTERPRISE';
type TenantStatus = 'PENDING_SETUP' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
type TenantRole = 'OWNER' | 'ADMIN' | 'PLAYER';
type InvitationStatus = 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

interface TenantDetail {
    id: string; slug: string; name: string; legalName: string | null;
    contactEmail: string; status: TenantStatus; planTier: PlanTier;
    maxUsers: number; maxLeagues: number; customDomain: string | null;
    createdAt: string; updatedAt: string;
    branding: { primaryColor: string; secondaryColor: string; accentColor: string; fontFamily: string; companyDisplayName: string | null; logoUrl: string | null; faviconUrl: string | null; customCss: string | null; } | null;
    config: { enablePayments: boolean; enableAiInsights: boolean; enablePublicLeagues: boolean; enableUserSelfRegister: boolean; requireInvitation: boolean; enableEmailNotif: boolean; enablePushNotif: boolean; enableStageFees: boolean; } | null;
    _count: { members: number; leagues: number };
}

interface Member { id: string; role: TenantRole; status: string; joinedAt: string | null; user: { id: string; name: string; email: string; }; }
interface Invitation { id: string; email: string; role: TenantRole; status: InvitationStatus; sentAt: string | null; expiresAt: string | null; resendCount: number; }

/* ─── Constants ─────────────────────────────────────────── */
const TABS = ['Info', 'Branding', 'Config', 'Miembros', 'Invitaciones'] as const;
type Tab = typeof TABS[number];

const STATUS_CONFIG: Record<TenantStatus, { label: string; color: string; icon: any }> = {
    PENDING_SETUP: { label: 'Configurando', color: 'bg-amber-100 text-amber-700', icon: Clock },
    ACTIVE:        { label: 'Activo',       color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    SUSPENDED:     { label: 'Suspendido',   color: 'bg-rose-100 text-rose-700', icon: PauseCircle },
    CANCELLED:     { label: 'Cancelado',    color: 'bg-slate-100 text-slate-500', icon: XCircle },
};

const PLAN_DEFAULTS: Record<PlanTier, { label: string; maxUsers: number; maxLeagues: number }> = {
    STARTER:    { label: 'Starter',    maxUsers: 50,   maxLeagues: 3  },
    BUSINESS:   { label: 'Business',   maxUsers: 300,  maxLeagues: 10 },
    ENTERPRISE: { label: 'Enterprise', maxUsers: 5000, maxLeagues: 50 },
};

const ROLE_COLORS: Record<TenantRole, string> = {
    OWNER:  'bg-amber-100 text-amber-700',
    ADMIN:  'bg-blue-100 text-blue-700',
    PLAYER: 'bg-slate-100 text-slate-600',
};

/* ─── Helpers ────────────────────────────────────────────── */
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <label className="flex items-center justify-between py-2 cursor-pointer group">
            <span className="text-sm text-slate-700 group-hover:text-slate-900">{label}</span>
            <button
                type="button"
                onClick={() => onChange(!value)}
                className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-amber-400' : 'bg-slate-200'}`}
            >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
        </label>
    );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function AdminTenantDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [tab, setTab] = useState<Tab>('Info');
    const [tenant, setTenant] = useState<TenantDetail | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    /* drafts */
    const [infoDraft, setInfoDraft] = useState<Partial<TenantDetail>>({});
    const [brandingDraft, setBrandingDraft] = useState<NonNullable<TenantDetail['branding']>>({
        primaryColor: '#16a34a', secondaryColor: '#15803d', accentColor: '#bbf7d0',
        fontFamily: 'Inter', companyDisplayName: null, logoUrl: null, faviconUrl: null, customCss: null,
    });
    const [configDraft, setConfigDraft] = useState<NonNullable<TenantDetail['config']>>({
        enablePayments: true, enableAiInsights: false, enablePublicLeagues: false,
        enableUserSelfRegister: false, requireInvitation: true,
        enableEmailNotif: true, enablePushNotif: true, enableStageFees: false,
    });
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<TenantRole>('PLAYER');
    const [bulkEmails, setBulkEmails] = useState('');
    const [inviting, setInviting] = useState(false);
    const [inviteMsg, setInviteMsg] = useState('');

    const load = async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const [t, m, inv] = await Promise.all([
                request<TenantDetail>(`/admin/tenants/${id}`),
                request<Member[]>(`/admin/tenants/${id}/members`),
                request<Invitation[]>(`/tenants/${id}/invitations`).catch(() => [] as Invitation[]),
            ]);
            setTenant(t);
            setInfoDraft({ name: t.name, legalName: t.legalName, contactEmail: t.contactEmail, planTier: t.planTier, maxUsers: t.maxUsers, maxLeagues: t.maxLeagues, customDomain: t.customDomain });
            if (t.branding) {
                const { primaryColor, secondaryColor, accentColor, fontFamily, companyDisplayName, logoUrl, faviconUrl, customCss, emailHeaderHtml, emailFooterHtml, emailInviteTemplate } = t.branding as any;
                setBrandingDraft({ primaryColor, secondaryColor, accentColor, fontFamily, companyDisplayName: companyDisplayName ?? null, logoUrl: logoUrl ?? null, faviconUrl: faviconUrl ?? null, customCss: customCss ?? null });
            }
            if (t.config) {
                const { enablePayments, enableAiInsights, enablePublicLeagues, enableUserSelfRegister, requireInvitation, enableEmailNotif, enablePushNotif, enableStageFees } = t.config as any;
                setConfigDraft({ enablePayments, enableAiInsights, enablePublicLeagues, enableUserSelfRegister, requireInvitation, enableEmailNotif, enablePushNotif, enableStageFees });
            }
            setMembers(m);
            setInvitations(inv);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);

    const flash = (msg: string) => { setSaveMsg(msg); setTimeout(() => setSaveMsg(''), 3000); };

    const saveInfo = async () => {
        setSaving(true);
        try {
            const body = Object.fromEntries(
                Object.entries(infoDraft).filter(([, v]) => v !== null && v !== undefined && v !== '')
            );
            await request(`/admin/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
            flash('✓ Datos guardados');
            await load();
        } catch (e: any) { flash(`Error: ${e?.message}`); } finally { setSaving(false); }
    };

    const saveBranding = async () => {
        setSaving(true);
        try {
            const body = Object.fromEntries(
                Object.entries(brandingDraft).filter(([, v]) => v !== null && v !== undefined)
            );
            await request(`/admin/tenants/${id}/branding`, { method: 'PATCH', body: JSON.stringify(body) });
            flash('✓ Branding guardado');
        } catch (e: any) { flash(`Error: ${e?.message}`); } finally { setSaving(false); }
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            await request(`/admin/tenants/${id}/config`, { method: 'PATCH', body: JSON.stringify(configDraft) }); // booleans nunca son null, no necesita filtrado
            flash('✓ Configuración guardada');
        } catch (e: any) { flash(`Error: ${e?.message}`); } finally { setSaving(false); }
    };

    const handleStatusToggle = async () => {
        if (!tenant) return;
        const action = tenant.status === 'ACTIVE' ? 'suspend' : 'activate';
        await request(`/admin/tenants/${id}/${action}`, { method: 'POST' });
        await load();
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        setInviting(true); setInviteMsg('');
        try {
            await request(`/tenants/${id}/invitations/invite`, { method: 'POST', body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }) });
            setInviteEmail('');
            setInviteMsg('✓ Invitación enviada');
            await load();
        } catch (e: any) { setInviteMsg(`Error: ${e?.message}`); } finally { setInviting(false); }
    };

    const handleBulkInvite = async () => {
        const emails = bulkEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
        if (!emails.length) return;
        setInviting(true); setInviteMsg('');
        try {
            const res = await request<{ total: number; queued: number; skipped: number; failed: number }>(`/tenants/${id}/invitations/invite/bulk`, { method: 'POST', body: JSON.stringify({ emails, role: inviteRole }) });
            setBulkEmails('');
            setInviteMsg(`✓ ${res.queued} enviadas · ${res.skipped} duplicadas · ${res.failed} fallidas`);
            await load();
        } catch (e: any) { setInviteMsg(`Error: ${e?.message}`); } finally { setInviting(false); }
    };

    const handleResend = async (invId: string) => {
        await request(`/tenants/${id}/invitations/${invId}/resend`, { method: 'POST' });
        setInviteMsg('✓ Reenviado');
        await load();
    };

    const handlePlanChange = (plan: PlanTier) => {
        const d = PLAN_DEFAULTS[plan];
        setInfoDraft(f => ({ ...f, planTier: plan, maxUsers: d.maxUsers, maxLeagues: d.maxLeagues }));
    };

    if (isLoading) return (
        <div className="space-y-4">
            <div className="h-8 w-48 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
    );
    if (!tenant) return <p className="text-slate-500">Tenant no encontrado</p>;

    const statusCfg = STATUS_CONFIG[tenant.status];
    const StatusIcon = statusCfg.icon;

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/admin/tenants')} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all">
                    <ArrowLeft size={16} className="text-slate-600" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-black text-slate-900">{tenant.name}</h1>
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                            <StatusIcon size={10} /> {statusCfg.label}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">{tenant.slug}.zonapronosticos.com</p>
                </div>
                <div className="flex items-center gap-2">
                    {saveMsg && <span className="text-xs text-emerald-600 font-semibold">{saveMsg}</span>}
                    <button onClick={load} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all">
                        <RefreshCw size={15} className="text-slate-500" />
                    </button>
                    <button
                        onClick={handleStatusToggle}
                        className={`text-xs font-bold px-3 py-2 rounded-xl transition-all ${tenant.status === 'ACTIVE' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                    >
                        {tenant.status === 'ACTIVE' ? 'Suspender' : 'Activar'}
                    </button>
                </div>
            </div>

            {/* Usage bar */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'Usuarios', current: tenant._count.members, max: tenant.maxUsers, icon: Users },
                    { label: 'Pollas', current: tenant._count.leagues, max: tenant.maxLeagues, icon: Trophy },
                ].map(({ label, current, max, icon: Icon }) => {
                    const pct = Math.min(100, Math.round((current / max) * 100));
                    return (
                        <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Icon size={12} />{label}</span>
                                <span className="text-xs font-black text-slate-900">{current}/{max}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full">
                                <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-rose-400' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">{pct}% usado</p>
                        </div>
                    );
                })}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {TABS.map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Tab: Info */}
            {tab === 'Info' && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Nombre comercial', key: 'name', placeholder: 'Bavaria' },
                            { label: 'Razón social', key: 'legalName', placeholder: 'Bavaria S.A.' },
                            { label: 'Email de contacto', key: 'contactEmail', placeholder: 'admin@bavaria.com' },
                            { label: 'Dominio propio', key: 'customDomain', placeholder: 'polla.bavaria.com' },
                        ].map(({ label, key, placeholder }) => (
                            <div key={key}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">{label}</label>
                                <input
                                    value={(infoDraft as any)[key] ?? ''}
                                    onChange={e => setInfoDraft(f => ({ ...f, [key]: e.target.value || null }))}
                                    placeholder={placeholder}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                            </div>
                        ))}
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Plan</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['STARTER', 'BUSINESS', 'ENTERPRISE'] as PlanTier[]).map(plan => {
                                const p = PLAN_DEFAULTS[plan];
                                const active = infoDraft.planTier === plan;
                                return (
                                    <button key={plan} type="button" onClick={() => handlePlanChange(plan)}
                                        className={`text-left p-3 rounded-xl border-2 transition-all ${active ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <p className={`text-[10px] font-black uppercase ${active ? 'text-amber-700' : 'text-slate-500'}`}>{p.label}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">{p.maxUsers} usuarios · {p.maxLeagues} pollas</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Límite usuarios</label>
                            <input type="number" min={1} value={infoDraft.maxUsers ?? 50}
                                onChange={e => setInfoDraft(f => ({ ...f, maxUsers: Number(e.target.value) }))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Límite pollas</label>
                            <input type="number" min={1} value={infoDraft.maxLeagues ?? 3}
                                onChange={e => setInfoDraft(f => ({ ...f, maxLeagues: Number(e.target.value) }))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                    </div>

                    <button onClick={saveInfo} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-500 disabled:opacity-60 transition-all">
                        <Save size={14} /> {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            )}

            {/* Tab: Branding */}
            {tab === 'Branding' && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Nombre de empresa (display)</label>
                            <input value={brandingDraft.companyDisplayName ?? ''}
                                onChange={e => setBrandingDraft(b => ({ ...b, companyDisplayName: e.target.value || null }))}
                                placeholder="Bavaria" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Fuente</label>
                            <select value={brandingDraft.fontFamily}
                                onChange={e => setBrandingDraft(b => ({ ...b, fontFamily: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                                {['Inter', 'Roboto', 'Poppins', 'Montserrat', 'Open Sans', 'Lato'].map(f => <option key={f}>{f}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Color primario', key: 'primaryColor' },
                            { label: 'Color secundario', key: 'secondaryColor' },
                            { label: 'Color acento', key: 'accentColor' },
                        ].map(({ label, key }) => (
                            <div key={key}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">{label}</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={(brandingDraft as any)[key]}
                                        onChange={e => setBrandingDraft(b => ({ ...b, [key]: e.target.value }))}
                                        className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer" />
                                    <input value={(brandingDraft as any)[key]}
                                        onChange={e => setBrandingDraft(b => ({ ...b, [key]: e.target.value }))}
                                        className="flex-1 border border-slate-200 rounded-xl px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">URL Logo</label>
                            <input value={brandingDraft.logoUrl ?? ''}
                                onChange={e => setBrandingDraft(b => ({ ...b, logoUrl: e.target.value || null }))}
                                placeholder="https://..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">URL Favicon</label>
                            <input value={brandingDraft.faviconUrl ?? ''}
                                onChange={e => setBrandingDraft(b => ({ ...b, faviconUrl: e.target.value || null }))}
                                placeholder="https://..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">CSS personalizado</label>
                        <textarea rows={4} value={brandingDraft.customCss ?? ''}
                            onChange={e => setBrandingDraft(b => ({ ...b, customCss: e.target.value || null }))}
                            placeholder=":root { --custom-radius: 12px; }"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                    </div>

                    {/* Preview */}
                    <div className="rounded-xl border border-slate-100 p-4 bg-slate-50">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Vista previa</p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg" style={{ background: brandingDraft.primaryColor }}>
                                {(brandingDraft.companyDisplayName || 'T').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-black text-sm" style={{ color: brandingDraft.primaryColor }}>{brandingDraft.companyDisplayName || 'Tu Empresa'}</p>
                                <p className="text-xs text-slate-400" style={{ fontFamily: brandingDraft.fontFamily }}>Polla Mundial 2026</p>
                            </div>
                            <div className="ml-auto flex gap-2">
                                <div className="w-6 h-6 rounded" style={{ background: brandingDraft.primaryColor }} title="Primario" />
                                <div className="w-6 h-6 rounded" style={{ background: brandingDraft.secondaryColor }} title="Secundario" />
                                <div className="w-6 h-6 rounded" style={{ background: brandingDraft.accentColor }} title="Acento" />
                            </div>
                        </div>
                    </div>

                    <button onClick={saveBranding} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-500 disabled:opacity-60 transition-all">
                        <Palette size={14} /> {saving ? 'Guardando...' : 'Guardar branding'}
                    </button>
                </div>
            )}

            {/* Tab: Config */}
            {tab === 'Config' && (
                <div className="bg-white rounded-2xl p-5 border border-slate-100 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Funcionalidades</p>
                    {([
                        { key: 'enablePayments', label: 'Pollas con pagos (cuotas de inscripción)' },
                        { key: 'enableStageFees', label: 'Cuotas por fase (cobros adicionales)' },
                        { key: 'enableAiInsights', label: 'Análisis IA de pronósticos' },
                        { key: 'enablePublicLeagues', label: 'Pollas públicas (visibles sin invitación)' },
                    ] as { key: keyof typeof configDraft; label: string }[]).map(({ key, label }) => (
                        <Toggle key={key} value={configDraft[key]} onChange={v => setConfigDraft(c => ({ ...c, [key]: v }))} label={label} />
                    ))}

                    <div className="h-px bg-slate-100 my-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Acceso y registro</p>
                    {([
                        { key: 'requireInvitation', label: 'Requerir invitación para unirse' },
                        { key: 'enableUserSelfRegister', label: 'Permitir auto-registro de usuarios' },
                    ] as { key: keyof typeof configDraft; label: string }[]).map(({ key, label }) => (
                        <Toggle key={key} value={configDraft[key]} onChange={v => setConfigDraft(c => ({ ...c, [key]: v }))} label={label} />
                    ))}

                    <div className="h-px bg-slate-100 my-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Notificaciones</p>
                    {([
                        { key: 'enableEmailNotif', label: 'Notificaciones por email' },
                        { key: 'enablePushNotif', label: 'Notificaciones push' },
                    ] as { key: keyof typeof configDraft; label: string }[]).map(({ key, label }) => (
                        <Toggle key={key} value={configDraft[key]} onChange={v => setConfigDraft(c => ({ ...c, [key]: v }))} label={label} />
                    ))}

                    <div className="pt-4">
                        <button onClick={saveConfig} disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-500 disabled:opacity-60 transition-all">
                            <Settings size={14} /> {saving ? 'Guardando...' : 'Guardar configuración'}
                        </button>
                    </div>
                </div>
            )}

            {/* Tab: Miembros */}
            {tab === 'Miembros' && (
                <div className="space-y-3">
                    {members.length === 0
                        ? <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center text-slate-400 text-sm">Sin miembros aún</div>
                        : members.map(m => (
                            <div key={m.id} className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-black text-slate-500">{m.user.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 truncate">{m.user.name}</p>
                                    <p className="text-xs text-slate-400 truncate">{m.user.email}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role]}`}>{m.role}</span>
                                {m.joinedAt && <p className="text-[10px] text-slate-400 hidden sm:block">{new Date(m.joinedAt).toLocaleDateString('es-CO')}</p>}
                            </div>
                        ))
                    }
                </div>
            )}

            {/* Tab: Invitaciones */}
            {tab === 'Invitaciones' && (
                <div className="space-y-4">
                    {/* Invite form */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Invitar individualmente</p>
                        <div className="flex gap-2">
                            <input
                                type="email" value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                placeholder="correo@empresa.com"
                                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as TenantRole)}
                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                                <option value="PLAYER">Jugador</option>
                                <option value="ADMIN">Admin</option>
                                <option value="OWNER">Owner</option>
                            </select>
                            <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-500 disabled:opacity-60 transition-all">
                                <Send size={14} /> Invitar
                            </button>
                        </div>

                        <div className="h-px bg-slate-100" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carga masiva (hasta 500)</p>
                        <textarea rows={3} value={bulkEmails} onChange={e => setBulkEmails(e.target.value)}
                            placeholder={"correo1@empresa.com\ncorreo2@empresa.com\ncorreo3@empresa.com"}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">{bulkEmails.split(/[\n,;]+/).filter(e => e.trim()).length} emails detectados · Rol: {inviteRole}</span>
                            <button onClick={handleBulkInvite} disabled={inviting || !bulkEmails.trim()}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-60 transition-all">
                                <UserPlus size={14} /> Enviar masivo
                            </button>
                        </div>
                        {inviteMsg && <p className={`text-xs font-semibold ${inviteMsg.startsWith('✓') ? 'text-emerald-600' : 'text-rose-500'}`}>{inviteMsg}</p>}
                    </div>

                    {/* Invitations list */}
                    {invitations.length === 0
                        ? <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center text-slate-400 text-sm">No hay invitaciones enviadas</div>
                        : (
                            <div className="space-y-2">
                                {invitations.map(inv => (
                                    <div key={inv.id} className="bg-white rounded-xl p-3 border border-slate-100 flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{inv.email}</p>
                                            <p className="text-[10px] text-slate-400">
                                                {inv.role} · {inv.resendCount > 0 ? `${inv.resendCount + 1} envíos` : '1 envío'}
                                                {inv.expiresAt && ` · Expira ${new Date(inv.expiresAt).toLocaleDateString('es-CO')}`}
                                            </p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            inv.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' :
                                            inv.status === 'EXPIRED' ? 'bg-slate-100 text-slate-500' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>{inv.status}</span>
                                        {inv.status === 'SENT' && (
                                            <button onClick={() => handleResend(inv.id)}
                                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-all" title="Reenviar">
                                                <RotateCcw size={13} className="text-slate-500" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    }
                </div>
            )}
        </div>
    );
}
