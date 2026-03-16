import React from 'react';
import { Users, Trophy, Target, DollarSign, TrendingUp, Clock } from 'lucide-react';
import { useAdminStore } from '../../stores/admin.store';
import AdminStatCard from '../../components/admin/AdminStatCard';
import StatusBadge from '../../components/admin/StatusBadge';

const planColors: Record<string, string> = {
    FREE: 'text-slate-600',
    GOLD: 'text-amber-600',
    DIAMOND: 'text-purple-600',
};

const AdminDashboard: React.FC = () => {
    const { stats, isLoading, error, fetchStats } = useAdminStore();

    React.useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);

    if (isLoading && !stats) {
        return (
            <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 bg-slate-200 rounded-[1.75rem] animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-700">
                <p className="font-bold">Error al cargar estadísticas</p>
                <p className="text-sm mt-1">{error}</p>
                <button onClick={fetchStats} className="mt-3 text-sm font-bold underline">Reintentar</button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">
                    Dashboard del Sistema
                </h1>
                <p className="text-sm text-slate-500 mt-1">Vista general de toda la plataforma</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <AdminStatCard
                    label="Total Usuarios"
                    value={stats?.totalUsers?.toLocaleString() ?? '—'}
                    icon={Users}
                    color="blue"
                />
                <AdminStatCard
                    label="Total Pollas"
                    value={stats?.totalLeagues?.toLocaleString() ?? '—'}
                    icon={Trophy}
                    color="amber"
                />
                <AdminStatCard
                    label="Pronósticos"
                    value={stats?.totalPredictions?.toLocaleString() ?? '—'}
                    icon={Target}
                    color="lime"
                />
                <AdminStatCard
                    label="Ingresos"
                    value={stats ? formatCurrency(stats.totalRevenue) : '—'}
                    icon={DollarSign}
                    color="purple"
                />
            </div>

            {/* Two columns: Plans + League statuses */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* Plan Breakdown */}
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-4">
                        Distribución de Planes
                    </p>
                    <div className="space-y-3">
                        {(['FREE', 'GOLD', 'DIAMOND'] as const).map((plan) => {
                            const entry = stats?.planBreakdown?.find((p) => p.plan === plan);
                            const count = entry?._count?._all ?? 0;
                            const total = stats?.totalUsers ?? 1;
                            const pct = Math.round((count / total) * 100);
                            return (
                                <div key={plan}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-sm font-black ${planColors[plan]}`}>{plan}</span>
                                        <span className="text-sm font-bold text-slate-700">
                                            {count.toLocaleString()} <span className="text-slate-400 font-normal">({pct}%)</span>
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                plan === 'DIAMOND' ? 'bg-purple-400' : plan === 'GOLD' ? 'bg-amber-400' : 'bg-slate-400'
                                            }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* League Status Breakdown */}
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-4">
                        Estado de Pollas
                    </p>
                    <div className="space-y-2">
                        {stats?.leagueStatusBreakdown?.map((entry) => (
                            <div key={entry.status} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                                <StatusBadge status={entry.status} size="md" />
                                <span className="font-black text-slate-700">{entry._count._all}</span>
                            </div>
                        ))}
                        {(!stats?.leagueStatusBreakdown || stats.leagueStatusBreakdown.length === 0) && (
                            <p className="text-sm text-slate-400">Sin datos</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Users */}
            <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Clock size={16} className="text-slate-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                        Usuarios Recientes
                    </p>
                </div>
                <div className="divide-y divide-slate-100">
                    {stats?.recentUsers?.map((user) => (
                        <div key={user.id} className="px-6 py-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600 flex-shrink-0">
                                {user.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                            </div>
                            <StatusBadge status={user.plan} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: 'Ver Usuarios', href: '/admin/users', icon: Users, color: 'bg-blue-50 text-blue-700 border-blue-100' },
                    { label: 'Ver Pollas', href: '/admin/leagues', icon: Trophy, color: 'bg-amber-50 text-amber-700 border-amber-100' },
                    { label: 'Ver Partidos', href: '/admin/matches', icon: TrendingUp, color: 'bg-lime-50 text-lime-700 border-lime-100' },
                    { label: 'Ver Planes', href: '/admin/plans', icon: DollarSign, color: 'bg-purple-50 text-purple-700 border-purple-100' },
                ].map((action) => (
                    <a
                        key={action.href}
                        href={action.href}
                        className={`rounded-2xl border p-4 flex items-center gap-3 font-bold text-sm transition-all hover:shadow-sm ${action.color}`}
                    >
                        <action.icon size={18} />
                        {action.label}
                    </a>
                ))}
            </div>
        </div>
    );
};

export default AdminDashboard;
