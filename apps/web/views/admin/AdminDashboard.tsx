import React from 'react';
import { Link } from 'react-router-dom';
import {
    Users, Trophy, Target, DollarSign, RefreshCw,
    Swords, CreditCard, TrendingUp, Clock, ChevronRight, AlertTriangle, Trash2, CheckCircle2,
} from 'lucide-react';
import { useAdminStore, type ResetOptions } from '../../stores/admin.store';
import AdminStatCard from '../../components/admin/AdminStatCard';
import StatusBadge from '../../components/admin/StatusBadge';
import ResetSystemDialog from '../../components/admin/ResetSystemDialog';

/* ─── constants ─── */
const planConfig = {
    FREE: { label: 'Free', color: 'bg-slate-300', textColor: 'text-slate-600', barColor: 'bg-slate-400' },
    GOLD: { label: 'Gold', color: 'bg-amber-300', textColor: 'text-amber-600', barColor: 'bg-amber-400' },
    DIAMOND: { label: 'Diamond', color: 'bg-purple-300', textColor: 'text-purple-600', barColor: 'bg-purple-400' },
} as const;

const quickActions = [
    { label: 'Usuarios', href: '/admin/users', icon: Users, color: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100' },
    { label: 'Pollas', href: '/admin/leagues', icon: Trophy, color: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100' },
    { label: 'Partidos', href: '/admin/matches', icon: Swords, color: 'bg-lime-50 text-lime-700 border-lime-100 hover:bg-lime-100' },
    { label: 'Planes', href: '/admin/plans', icon: CreditCard, color: 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100' },
    { label: 'Pronósticos', href: '/admin/predictions', icon: Target, color: 'bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100' },
    { label: 'Pagos', href: '/admin/payments', icon: DollarSign, color: 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100' },
];

/* ─── helpers ─── */
function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(amount);
}

function timeAgo(date: Date): string {
    const diff = Math.round((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'ahora mismo';
    if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
    return `hace ${Math.round(diff / 3600)} h`;
}

/* ─── Skeleton ─── */
const DashboardSkeleton: React.FC = () => (
    <div className="space-y-5 animate-pulse">
        <div className="flex items-center justify-between">
            <div className="space-y-2">
                <div className="h-7 w-48 bg-slate-200 rounded-xl" />
                <div className="h-4 w-64 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-9 w-28 bg-slate-200 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 bg-slate-200 rounded-[1.75rem]" />
            ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="h-52 bg-slate-200 rounded-[2rem]" />
            <div className="h-52 bg-slate-200 rounded-[2rem]" />
        </div>
    </div>
);

/* ─── Main component ─── */
const AdminDashboard: React.FC = () => {
    const { stats, isLoading, error, fetchStats, resetTestData, testMode, getTestMode, updateTestMode } = useAdminStore();
    const [lastRefreshed, setLastRefreshed] = React.useState<Date | null>(null);
    const [, forceRender] = React.useReducer((x: number) => x + 1, 0);
    const [showResetDialog, setShowResetDialog] = React.useState(false);
    const [resetSuccess, setResetSuccess] = React.useState<string | null>(null);
    const [testModeSuccess, setTestModeSuccess] = React.useState<string | null>(null);

    React.useEffect(() => {
        void fetchStats().then(() => setLastRefreshed(new Date()));
        void getTestMode();
    }, [fetchStats, getTestMode]);

    /* Update "hace X min" every 30 s */
    React.useEffect(() => {
        const id = window.setInterval(forceRender, 30_000);
        return () => clearInterval(id);
    }, []);

    const handleRefresh = async () => {
        await fetchStats();
        setLastRefreshed(new Date());
    };

    const handleResetSystem = async (options: ResetOptions) => {
        try {
            const result = await resetTestData(options);
            setResetSuccess(result.message);
            setShowResetDialog(false);
            // Actualizar estadísticas después del reinicio
            await fetchStats();
            setLastRefreshed(new Date());
            // Limpiar mensaje de éxito después de 5 segundos
            setTimeout(() => setResetSuccess(null), 5000);
        } catch (error) {
            console.error('Error al reiniciar el sistema:', error);
        }
    };

    const handleToggleTestMode = async () => {
        try {
            const newState = !testMode?.enabled;
            const result = await updateTestMode(newState);
            setTestModeSuccess(result.message);
            // Limpiar mensaje de éxito después de 5 segundos
            setTimeout(() => setTestModeSuccess(null), 5000);
        } catch (error) {
            console.error('Error al cambiar modo prueba:', error);
        }
    };

    if (isLoading && !stats) return <DashboardSkeleton />;

    if (error) {
        return (
            <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-rose-700">
                <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">Error al cargar estadísticas</p>
                        <p className="text-sm mt-1">{error}</p>
                        <button
                            onClick={handleRefresh}
                            className="mt-3 text-sm font-bold underline"
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-brand uppercase tracking-tight leading-tight">
                        Dashboard del Sistema
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <Clock size={12} />
                        {lastRefreshed ? `Actualizado ${timeAgo(lastRefreshed)}` : 'Vista general de la plataforma'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowResetDialog(true)}
                        disabled={isLoading || !testMode?.enabled}
                        className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
                        aria-label="Reiniciar sistema de pruebas"
                        title={!testMode?.enabled ? 'Activa el modo prueba para usar esta función' : 'Reiniciar sistema de pruebas'}
                    >
                        <Trash2 size={14} />
                        <span className="hidden sm:inline">Reiniciar Sistema</span>
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-all shrink-0"
                        aria-label="Actualizar estadísticas"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Actualizar</span>
                    </button>
                </div>
            </div>

            {/* ── Test Mode Banner ── */}
            <div className={`rounded-2xl border-2 p-4 transition-all ${
                testMode?.enabled 
                    ? 'bg-amber-50 border-amber-300' 
                    : 'bg-slate-50 border-slate-200'
            }`}>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            testMode?.enabled ? 'bg-amber-400' : 'bg-slate-300'
                        }`}>
                            <AlertTriangle size={20} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                Modo Prueba {testMode?.enabled ? 'ACTIVADO' : 'DESACTIVADO'}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5">
                                {testMode?.enabled 
                                    ? 'Puedes reiniciar el sistema las veces que necesites'
                                    : 'Activa el modo prueba para usar la función de reinicio'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleToggleTestMode}
                        disabled={isLoading}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                            testMode?.enabled 
                                ? 'bg-amber-500 focus:ring-amber-500' 
                                : 'bg-slate-300 focus:ring-slate-500'
                        }`}
                    >
                        <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                                testMode?.enabled ? 'translate-x-7' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {/* ── Success Messages ── */}
            {resetSuccess && (
                <div className="rounded-xl border border-lime-200 bg-lime-50 p-4 text-lime-700 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        <p className="text-sm font-bold">{resetSuccess}</p>
                    </div>
                </div>
            )}
            {testModeSuccess && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-700 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        <p className="text-sm font-bold">{testModeSuccess}</p>
                    </div>
                </div>
            )}

            {/* ── Stats Grid ── */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <AdminStatCard
                    label="Usuarios"
                    value={stats?.totalUsers?.toLocaleString('es-CO') ?? '—'}
                    icon={Users}
                    color="blue"
                />
                <AdminStatCard
                    label="Pollas"
                    value={stats?.totalLeagues?.toLocaleString('es-CO') ?? '—'}
                    icon={Trophy}
                    color="amber"
                />
                <AdminStatCard
                    label="Pronósticos"
                    value={stats?.totalPredictions?.toLocaleString('es-CO') ?? '—'}
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

            {/* ── Quick Actions ── */}
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mb-3">
                    Acceso Rápido
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {quickActions.map((action) => (
                        <Link
                            key={action.href}
                            to={action.href}
                            className={`rounded-2xl border p-3 flex flex-col items-center gap-2 text-center transition-all hover:shadow-sm active:scale-95 ${action.color}`}
                        >
                            <action.icon size={20} className="shrink-0" />
                            <span className="text-[11px] font-bold leading-tight">{action.label}</span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* ── Plans + League status ── */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                {/* Plan Breakdown */}
                <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                            Distribución de Planes
                        </p>
                        <Link
                            to="/admin/affiliations"
                            className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                        >
                            Ver todas <ChevronRight size={12} />
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {(['FREE', 'GOLD', 'DIAMOND'] as const).map((plan) => {
                            const entry = stats?.planBreakdown?.find((p) => p.plan === plan);
                            const count = entry?._count?._all ?? 0;
                            const total = Math.max(stats?.totalUsers ?? 1, 1);
                            const pct = Math.round((count / total) * 100);
                            const cfg = planConfig[plan];
                            return (
                                <div key={plan}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-block w-2 h-2 rounded-full ${cfg.barColor}`} />
                                            <span className={`text-sm font-black ${cfg.textColor}`}>{cfg.label}</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-700 tabular-nums">
                                            {count.toLocaleString('es-CO')}
                                            <span className="text-slate-400 font-normal text-xs ml-1">({pct}%)</span>
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${cfg.barColor}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* League Status */}
                <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                            Estado de Pollas
                        </p>
                        <Link
                            to="/admin/leagues"
                            className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                        >
                            Ver todas <ChevronRight size={12} />
                        </Link>
                    </div>
                    <div className="space-y-0.5">
                        {stats?.leagueStatusBreakdown?.map((entry) => (
                            <div key={entry.status} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                                <StatusBadge status={entry.status} size="md" />
                                <span className="font-black text-slate-700 tabular-nums text-sm">
                                    {entry._count._all}
                                </span>
                            </div>
                        ))}
                        {(!stats?.leagueStatusBreakdown || stats.leagueStatusBreakdown.length === 0) && (
                            <p className="text-sm text-slate-400 py-4 text-center">Sin datos disponibles</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Recent Users ── */}
            <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock size={15} className="text-slate-400" />
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                            Usuarios Recientes
                        </p>
                    </div>
                    <Link
                        to="/admin/users"
                        className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                        Ver todos <ChevronRight size={12} />
                    </Link>
                </div>
                <div className="divide-y divide-slate-100">
                    {stats?.recentUsers?.map((user) => (
                        <div key={user.id} className="px-5 py-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-sm font-black text-amber-700 flex-shrink-0 border border-amber-200">
                                {user.name?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <StatusBadge status={user.plan} />
                                <Link
                                    to={`/admin/users`}
                                    className="text-slate-300 hover:text-amber-500 transition-colors"
                                    aria-label={`Ver ${user.name}`}
                                >
                                    <ChevronRight size={16} />
                                </Link>
                            </div>
                        </div>
                    ))}
                    {(!stats?.recentUsers || stats.recentUsers.length === 0) && (
                        <p className="text-sm text-slate-400 py-6 text-center">Sin usuarios recientes</p>
                    )}
                </div>
            </div>

            {/* ── Bottom action row ── */}
            <div className="flex flex-wrap gap-3 justify-end">
                <Link
                    to="/admin/matches"
                    className="flex items-center gap-2 rounded-xl bg-lime-50 border border-lime-200 px-4 py-2.5 text-sm font-bold text-lime-700 hover:bg-lime-100 transition-colors"
                >
                    <TrendingUp size={16} />
                    Ver Partidos
                </Link>
                <Link
                    to="/admin/payments"
                    className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                    <DollarSign size={16} />
                    Ver Pagos
                </Link>
            </div>

            {/* ── Reset System Dialog ── */}
            <ResetSystemDialog
                isOpen={showResetDialog}
                onClose={() => setShowResetDialog(false)}
                onConfirm={handleResetSystem}
                isLoading={isLoading}
            />
        </div>
    );
};

export default AdminDashboard;
