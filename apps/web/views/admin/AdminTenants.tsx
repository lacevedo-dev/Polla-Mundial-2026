import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Plus, Users, Trophy, CheckCircle2, Clock,
    XCircle, PauseCircle, ChevronRight, RefreshCw, Zap, Info,
} from 'lucide-react';
import { request } from '../../api';

type PlanTier = 'STARTER' | 'BUSINESS' | 'ENTERPRISE';

interface TenantRow {
    id: string;
    slug: string;
    name: string;
    contactEmail: string;
    status: 'PENDING_SETUP' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
    planTier: PlanTier;
    maxUsers: number;
    maxLeagues: number;
    createdAt: string;
    _count: { members: number; leagues: number };
    subscription?: { status: string; priceMonthly: number; currency: string } | null;
}

interface CreateTenantForm {
    slug: string;
    name: string;
    legalName: string;
    contactEmail: string;
    planTier: PlanTier;
    maxUsers: number;
    maxLeagues: number;
}

const PLAN_DEFAULTS: Record<PlanTier, { maxUsers: number; maxLeagues: number; label: string; price: string; features: string[] }> = {
    STARTER:    { maxUsers: 50,   maxLeagues: 3,  label: 'Starter',    price: '250k COP/mes',  features: ['Hasta 50 usuarios', 'Hasta 3 pollas', 'Branding básico', 'Soporte email'] },
    BUSINESS:   { maxUsers: 300,  maxLeagues: 10, label: 'Business',   price: '600k COP/mes',  features: ['Hasta 300 usuarios', 'Hasta 10 pollas', 'Branding completo', 'Dominio propio', 'Soporte prioritario'] },
    ENTERPRISE: { maxUsers: 5000, maxLeagues: 50, label: 'Enterprise', price: 'Precio a medida', features: ['Usuarios ilimitados', 'Pollas ilimitadas', 'SSO', 'SLA garantizado', 'Gerente de cuenta'] },
};

const STATUS_CONFIG = {
    PENDING_SETUP: { label: 'Configurando', color: 'bg-amber-100 text-amber-700', icon: Clock },
    ACTIVE:        { label: 'Activo',       color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    SUSPENDED:     { label: 'Suspendido',   color: 'bg-rose-100 text-rose-700',    icon: PauseCircle },
    CANCELLED:     { label: 'Cancelado',    color: 'bg-slate-100 text-slate-500',  icon: XCircle },
};

const PLAN_COLORS: Record<PlanTier, string> = {
    STARTER:    'bg-slate-100 text-slate-600',
    BUSINESS:   'bg-lime-100 text-lime-700',
    ENTERPRISE: 'bg-cyan-100 text-cyan-700',
};

function formatPrice(amount: number, currency: string) {
    if (amount === 0) return 'Sin facturación';
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M ${currency}`;
    if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k ${currency}`;
    return `$${amount} ${currency}`;
}

export default function AdminTenants() {
    const navigate = useNavigate();
    const [tenants, setTenants] = useState<TenantRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<CreateTenantForm>({
        slug: '',
        name: '',
        legalName: '',
        contactEmail: '',
        planTier: 'STARTER',
        maxUsers: PLAN_DEFAULTS.STARTER.maxUsers,
        maxLeagues: PLAN_DEFAULTS.STARTER.maxLeagues,
    });
    const [createError, setCreateError] = useState<string | null>(null);

    const handlePlanChange = (plan: PlanTier) => {
        const defaults = PLAN_DEFAULTS[plan];
        setForm(f => ({ ...f, planTier: plan, maxUsers: defaults.maxUsers, maxLeagues: defaults.maxLeagues }));
    };

    const load = async () => {
        setIsLoading(true);
        try {
            const data = await request<TenantRow[]>('/admin/tenants');
            setTenants(data);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setCreateError(null);
        try {
            await request('/admin/tenants', {
                method: 'POST',
                body: JSON.stringify(form),
            });
            setShowCreate(false);
            setForm({ slug: '', name: '', legalName: '', contactEmail: '', planTier: 'STARTER', maxUsers: PLAN_DEFAULTS.STARTER.maxUsers, maxLeagues: PLAN_DEFAULTS.STARTER.maxLeagues });
            await load();
        } catch (err: any) {
            setCreateError(err?.message ?? 'Error al crear tenant');
        } finally {
            setCreating(false);
        }
    };

    const handleStatusChange = async (id: string, action: 'activate' | 'suspend') => {
        await request(`/admin/tenants/${id}/${action}`, { method: 'POST' });
        await load();
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-8 bg-slate-200 rounded-xl animate-pulse w-48" />
                {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">
                        Tenants B2B
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Organizaciones corporativas en zonapronosticos.com
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-500 transition-all"
                    >
                        <Plus size={16} />
                        Nuevo Tenant
                    </button>
                </div>
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total', value: tenants.length },
                    { label: 'Activos', value: tenants.filter(t => t.status === 'ACTIVE').length },
                    { label: 'Configurando', value: tenants.filter(t => t.status === 'PENDING_SETUP').length },
                    { label: 'Suspendidos', value: tenants.filter(t => t.status === 'SUSPENDED').length },
                ].map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <p className="text-2xl font-black text-slate-900">{value}</p>
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Create form modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <form
                        onSubmit={handleCreate}
                        className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl"
                    >
                        <h2 className="text-lg font-black text-slate-900">Nuevo Tenant Corporativo</h2>
                        <p className="text-xs text-slate-400 -mt-2">Completa los datos para crear una organización B2B</p>

                        {createError && (
                            <div className="text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2">{createError}</div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Slug (subdominio)</label>
                                <input
                                    required
                                    value={form.slug}
                                    onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                                    placeholder="bavaria"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">→ bavaria.zonapronosticos.com</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Nombre comercial</label>
                                    <input
                                        required
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="Bavaria"
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Razón social</label>
                                    <input
                                        value={form.legalName}
                                        onChange={e => setForm(f => ({ ...f, legalName: e.target.value }))}
                                        placeholder="Bavaria S.A."
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Email de Contacto</label>
                                <input
                                    required
                                    type="email"
                                    value={form.contactEmail}
                                    onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                                    placeholder="admin@bavaria.com.co"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Plan</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['STARTER', 'BUSINESS', 'ENTERPRISE'] as PlanTier[]).map(plan => {
                                        const p = PLAN_DEFAULTS[plan];
                                        const active = form.planTier === plan;
                                        return (
                                            <button
                                                key={plan}
                                                type="button"
                                                onClick={() => handlePlanChange(plan)}
                                                className={`text-left p-3 rounded-xl border-2 transition-all ${
                                                    active ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <p className={`text-[10px] font-black uppercase tracking-wide ${ active ? 'text-amber-700' : 'text-slate-500'}`}>{p.label}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{p.price}</p>
                                                <p className="text-[10px] text-slate-500 mt-1">{p.maxUsers} usuarios · {p.maxLeagues} pollas</p>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 mt-2 space-y-1">
                                    {PLAN_DEFAULTS[form.planTier].features.map(f => (
                                        <p key={f} className="text-[11px] text-slate-500">✓ {f}</p>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Límite usuarios <span className="text-slate-300">(personalizar)</span></label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.maxUsers}
                                        onChange={e => setForm(f => ({ ...f, maxUsers: Number(e.target.value) }))}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Límite pollas <span className="text-slate-300">(personalizar)</span></label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.maxLeagues}
                                        onChange={e => setForm(f => ({ ...f, maxLeagues: Number(e.target.value) }))}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={creating}
                                className="flex-1 py-2 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-500 disabled:opacity-60 transition-all"
                            >
                                {creating ? 'Creando...' : 'Crear Tenant'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tenant list */}
            {tenants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Building2 size={40} className="text-slate-300 mb-3" />
                    <p className="text-slate-500 font-semibold">No hay tenants creados</p>
                    <p className="text-xs text-slate-400 mt-1">Crea el primero para comenzar</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {tenants.map((tenant) => {
                        const statusCfg = STATUS_CONFIG[tenant.status];
                        const StatusIcon = statusCfg.icon;
                        return (
                            <div
                                key={tenant.id}
                                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
                                onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                        <Building2 size={18} className="text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-slate-900 text-sm">{tenant.name}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${PLAN_COLORS[tenant.planTier]}`}>
                                                {PLAN_DEFAULTS[tenant.planTier].label}
                                            </span>
                                            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                                                <StatusIcon size={10} />
                                                {statusCfg.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 font-mono mt-0.5">{tenant.slug}.zonapronosticos.com</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{tenant.contactEmail}</p>
                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="flex items-center gap-1 text-xs text-slate-500">
                                                <Users size={11} />
                                                {tenant._count.members}/{tenant.maxUsers} usuarios
                                            </span>
                                            <span className="flex items-center gap-1 text-xs text-slate-500">
                                                <Trophy size={11} />
                                                {tenant._count.leagues}/{tenant.maxLeagues} pollas
                                            </span>
                                            {tenant.subscription && (
                                                <span className="flex items-center gap-1 text-xs text-slate-500">
                                                    <Zap size={11} />
                                                    {formatPrice(tenant.subscription.priceMonthly, tenant.subscription.currency)}/mes
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                        {tenant.status === 'ACTIVE' && (
                                            <button
                                                onClick={() => handleStatusChange(tenant.id, 'suspend')}
                                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
                                            >
                                                Suspender
                                            </button>
                                        )}
                                        {(tenant.status === 'SUSPENDED' || tenant.status === 'PENDING_SETUP') && (
                                            <button
                                                onClick={() => handleStatusChange(tenant.id, 'activate')}
                                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all"
                                            >
                                                Activar
                                            </button>
                                        )}
                                        <ChevronRight size={16} className="text-slate-300" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
