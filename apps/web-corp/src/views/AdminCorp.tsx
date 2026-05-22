import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Trophy, BarChart2, Shield, ChevronRight, TrendingUp, ArrowUpRight } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request } from '../api';
import { useTenantStore } from '../stores/tenant.store';

interface AdminStats {
    totalMembers: number;
    myLeagues: { id: string; name: string; participantsCount: number; myPoints: number }[];
    globalRank: number | null;
    predictionsPending: number;
    tenantRole: string;
}

export default function AdminCorp() {
    const tenant = useTenantStore((s) => s.tenant);
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'tu organización';

    useEffect(() => {
        request<AdminStats>('/corp/dashboard')
            .then(setStats)
            .catch(() => setStats(null))
            .finally(() => setLoading(false));
    }, []);

    return (
        <CorpLayout>
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <Shield size={20} className="text-violet-600" />
                    <h1 className="text-2xl font-black text-slate-900">Panel de administración</h1>
                </div>
                <p className="text-slate-500 text-sm">Gestión de {orgName}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    {
                        label: 'Miembros activos',
                        value: loading ? '—' : (stats?.totalMembers ?? 0),
                        icon: Users,
                        color: 'text-sky-600',
                        bg: 'bg-sky-50',
                        link: '/admin/members',
                    },
                    {
                        label: 'Pollas activas',
                        value: loading ? '—' : (stats?.myLeagues.length ?? 0),
                        icon: Trophy,
                        color: 'text-amber-600',
                        bg: '',
                        link: '/pollas',
                        style: { backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 12%, white)' },
                    },
                    {
                        label: 'Ranking global',
                        value: loading ? '—' : (stats?.globalRank != null ? `#${stats.globalRank}` : '—'),
                        icon: BarChart2,
                        color: 'text-emerald-600',
                        bg: 'bg-emerald-50',
                        link: '/ranking',
                    },
                    {
                        label: 'Pronósticos pendientes',
                        value: loading ? '—' : (stats?.predictionsPending ?? 0),
                        icon: TrendingUp,
                        color: 'text-violet-600',
                        bg: 'bg-violet-50',
                        link: null,
                    },
                ].map(({ label, value, icon: Icon, color, bg, link, style }) => (
                    <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${bg} ${color}`}
                            style={style}
                        >
                            <Icon size={17} />
                        </div>
                        <div className="text-2xl font-black text-slate-900">{value}</div>
                        <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs text-slate-500 font-medium">{label}</span>
                            {link && (
                                <Link to={link} className={`text-xs font-bold ${color} hover:underline flex items-center gap-0.5`}>
                                    Ver <ArrowUpRight size={11} />
                                </Link>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Admin actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-black text-slate-900">Acciones rápidas</h2>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {[
                            {
                                label: 'Gestionar miembros',
                                desc: 'Ver, invitar y administrar usuarios',
                                icon: Users,
                                link: '/admin/members',
                                color: 'text-sky-600',
                                bg: 'bg-sky-50',
                            },
                            {
                                label: 'Ver pollas',
                                desc: 'Explorar todas las pollas del tenant',
                                icon: Trophy,
                                link: '/pollas',
                                color: 'text-amber-600',
                                bg: '',
                            },
                            {
                                label: 'Ranking general',
                                desc: 'Clasificación de todos los miembros',
                                icon: BarChart2,
                                link: '/ranking',
                                color: 'text-emerald-600',
                                bg: 'bg-emerald-50',
                            },
                        ].map(({ label, desc, icon: Icon, link, color, bg }) => (
                            <Link
                                key={link}
                                to={link}
                                className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                            >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg} ${color}`}
                                    style={bg === '' ? { backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 12%, white)' } : {}}
                                >
                                    <Icon size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm">{label}</p>
                                    <p className="text-xs text-slate-400">{desc}</p>
                                </div>
                                <ChevronRight size={14} className="text-slate-300 shrink-0" />
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Top pollas */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-black text-slate-900">Pollas del tenant</h2>
                        <Link to="/pollas" className="text-xs font-bold hover:underline flex items-center gap-0.5" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                            Ver todas <ChevronRight size={12} />
                        </Link>
                    </div>
                    {loading ? (
                        <div className="p-8 flex justify-center">
                            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary, #f59e0b)', borderTopColor: 'transparent' }} />
                        </div>
                    ) : !stats?.myLeagues.length ? (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            No hay pollas creadas aún.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {stats.myLeagues.slice(0, 4).map((league) => (
                                <Link
                                    key={league.id}
                                    to={`/pollas/${league.id}`}
                                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 12%, white)' }}
                                    >
                                        <Trophy size={14} style={{ color: 'var(--color-primary, #f59e0b)' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 text-sm truncate">{league.name}</p>
                                        <p className="text-xs text-slate-400">{league.participantsCount} participantes</p>
                                    </div>
                                    <ChevronRight size={13} className="text-slate-300 shrink-0" />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </CorpLayout>
    );
}
