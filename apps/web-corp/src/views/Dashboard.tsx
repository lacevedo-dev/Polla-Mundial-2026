import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, BarChart2, TrendingUp, ChevronRight, Calendar } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { useTenantStore } from '../stores/tenant.store';
import { useAuthStore } from '../stores/auth.store';
import { request } from '../api';

interface DashboardData {
    myLeagues: { id: string; name: string; participantsCount: number; myRank: number | null }[];
    globalRank: number | null;
    totalMembers: number;
    predictionsPending: number;
}

export default function Dashboard() {
    const tenant = useTenantStore((s) => s.tenant);
    const user = useAuthStore((s) => s.user);
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'tu organización';

    useEffect(() => {
        setLoading(true);
        request<DashboardData>('/corp/dashboard')
            .then(setData)
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
                        value: loading ? '—' : (data?.globalRank ? `#${data.globalRank}` : '—'),
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
                            <div key={league.id} className="flex items-center gap-3 px-5 py-3.5">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                    <Trophy size={16} className="text-amber-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate">{league.name}</p>
                                    <p className="text-xs text-slate-400">{league.participantsCount} participantes</p>
                                </div>
                                {league.myRank && (
                                    <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                                        #{league.myRank}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-2 gap-3 mt-4">
                <Link
                    to="/pollas"
                    className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all group"
                >
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                        <Trophy size={18} className="text-amber-600" />
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
            </div>
        </CorpLayout>
    );
}
