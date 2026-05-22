import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, BarChart2, TrendingUp, ChevronRight, Calendar, Shield } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { useTenantStore } from '../stores/tenant.store';
import { useAuthStore } from '../stores/auth.store';
import { request } from '../api';

interface DashboardData {
    myLeagues: { id: string; name: string; participantsCount: number; myPoints: number }[];
    globalRank: number | null;
    totalMembers: number;
    predictionsPending: number;
    tenantRole: string;
}

export default function Dashboard() {
    const tenant = useTenantStore((s) => s.tenant);
    const { user, setTenantRole } = useAuthStore();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'tu organización';
    const isAdmin = user?.tenantRole === 'OWNER' || user?.tenantRole === 'ADMIN';

    useEffect(() => {
        setLoading(true);
        request<DashboardData>('/corp/dashboard')
            .then((d) => {
                setData(d);
                if (d.tenantRole) setTenantRole(d.tenantRole);
            })
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    return (
        <CorpLayout>
            {/* Greeting */}
            <div className="mb-6">
                <h1 className="text-2xl font-black text-slate-900">
                    Hola, {user?.name?.split(' ')[0]} 👋
                </h1>
                <p className="text-slate-500 text-sm mt-1">Bienvenido al portal de {orgName}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    {
                        label: 'Mis pollas',
                        value: loading ? '—' : (data?.myLeagues.length ?? 0),
                        icon: Trophy,
                        color: 'bg-amber-50 text-amber-600',
                    },
                    {
                        label: 'Mi posición',
                        value: loading ? '—' : (data?.globalRank != null ? `#${data.globalRank}` : '—'),
                        icon: TrendingUp,
                        color: 'bg-emerald-50 text-emerald-600',
                    },
                    {
                        label: 'Miembros',
                        value: loading ? '—' : (data?.totalMembers ?? 0),
                        icon: Users,
                        color: 'bg-sky-50 text-sky-600',
                    },
                    {
                        label: 'Pendientes',
                        value: loading ? '—' : (data?.predictionsPending ?? 0),
                        icon: Calendar,
                        color: 'bg-rose-50 text-rose-600',
                    },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                            <Icon size={17} />
                        </div>
                        <div className="text-2xl font-black text-slate-900">{value}</div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
                    </div>
                ))}
            </div>

            {/* My leagues */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h2 className="font-black text-slate-900">Mis pollas</h2>
                    <Link to="/pollas" className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1">
                        Ver todas <ChevronRight size={13} />
                    </Link>
                </div>

                {loading ? (
                    <div className="p-8 flex justify-center">
                        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : !data?.myLeagues.length ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        Aún no estás en ninguna polla.{' '}
                        <Link to="/pollas" className="text-amber-600 hover:underline font-semibold">
                            Explorar pollas
                        </Link>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {data.myLeagues.slice(0, 5).map((league) => (
                            <Link key={league.id} to={`/pollas/${league.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, white)' }}>
                                    <Trophy size={16} style={{ color: 'var(--color-primary, #f59e0b)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate">{league.name}</p>
                                    <p className="text-xs text-slate-400">{league.participantsCount} participantes</p>
                                </div>
                                <div className="text-right shrink-0">
                                    {league.myPoints > 0 && (
                                        <span className="text-xs font-black" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                                            {league.myPoints} pts
                                        </span>
                                    )}
                                    <ChevronRight size={14} className="text-slate-300 ml-1 inline" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick links */}
            <div className={`grid gap-3 mt-4 ${isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
                <Link
                    to="/pollas"
                    className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:opacity-80 transition-opacity" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, white)' }}>
                        <Trophy size={18} style={{ color: 'var(--color-primary, #f59e0b)' }} />
                    </div>
                    <div>
                        <p className="font-black text-slate-800 text-sm">Pollas</p>
                        <p className="text-xs text-slate-400">Ver y unirse</p>
                    </div>
                </Link>
                <Link
                    to="/ranking"
                    className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                        <BarChart2 size={18} className="text-emerald-600" />
                    </div>
                    <div>
                        <p className="font-black text-slate-800 text-sm">Ranking</p>
                        <p className="text-xs text-slate-400">Tabla general</p>
                    </div>
                </Link>
                {isAdmin && (
                    <>
                        <Link
                            to="/admin"
                            className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                                <Shield size={18} className="text-violet-600" />
                            </div>
                            <div>
                                <p className="font-black text-slate-800 text-sm">Admin</p>
                                <p className="text-xs text-slate-400">Panel general</p>
                            </div>
                        </Link>
                        <Link
                            to="/admin/members"
                            className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center group-hover:bg-sky-100 transition-colors">
                                <Users size={18} className="text-sky-600" />
                            </div>
                            <div>
                                <p className="font-black text-slate-800 text-sm">Miembros</p>
                                <p className="text-xs text-slate-400">Gestionar</p>
                            </div>
                        </Link>
                    </>
                )}
            </div>
        </CorpLayout>
    );
}
