import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    Clock,
    Coins,
    Copy,
    ListChecks,
    PlusCircle,
    Settings,
    Share2,
    Trophy,
    Users,
    X,
    Zap,
} from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore } from '../stores/prediction.store';
import { useDashboardStore } from '../stores/dashboard.store';
import { useAuthStore } from '../stores/auth.store';
import { ErrorBanner } from '../components/dashboard/ErrorBanner';

/* ─── helpers ─────────────────────────────────────────────────── */

function formatCurrency(amount?: number | null, currency = 'COP'): string {
    if (!amount) return 'Gratis';
    try {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${currency} ${amount}`;
    }
}

function safeText(value?: string | null, fallback = 'Sin datos'): string {
    return value?.trim() || fallback;
}

const fade = (delay = 0) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: 'easeOut' as const, delay },
});

/* ─── Invite Modal ─────────────────────────────────────────────── */

const InviteModal: React.FC<{
    open: boolean;
    onClose: () => void;
    code?: string;
    leagueName?: string;
}> = ({ open, onClose, code, leagueName }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!code) return;
        void navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const shareText = `Únete a mi polla "${leagueName}" con el código: ${code}`;

    const handleShare = () => {
        if (navigator.share) {
            void navigator.share({ title: leagueName, text: shareText });
        } else {
            void navigator.clipboard.writeText(shareText).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 10 }}
                        transition={{ duration: 0.28, ease: 'easeOut' as const }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm mx-4"
                    >
                        <div className="bg-white rounded-[2rem] shadow-2xl p-6 space-y-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Invitar a la polla</h2>
                                    <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[220px]">{leagueName}</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="rounded-2xl bg-slate-950 p-5 text-center">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 mb-3">Código de invitación</p>
                                <p className="text-4xl font-black tracking-[0.25em] text-white font-brand">
                                    {code || '------'}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-2">Comparte este código con tus amigos</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
                                >
                                    {copied ? (
                                        <>
                                            <CheckCircle2 size={16} className="text-lime-500" />
                                            Copiado
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={16} />
                                            Copiar código
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleShare}
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-lime-400 text-slate-950 text-sm font-bold hover:bg-lime-500 transition-all"
                                >
                                    <Share2 size={16} />
                                    Compartir
                                </button>
                            </div>

                            <p className="text-[11px] text-slate-400 text-center">
                                Los amigos pueden unirse desde <span className="font-bold text-slate-600">/join</span> en la app
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

/* ─── League Switcher ─────────────────────────────────────────── */

const LeagueSwitcher: React.FC<{
    leagues: { id: string; name: string }[];
    activeId?: string;
    onChange: (id: string) => void;
}> = ({ leagues, activeId, onChange }) => {
    const [open, setOpen] = useState(false);
    const active = leagues.find((l) => l.id === activeId) ?? leagues[0];

    return (
        <div className="relative min-w-[220px]">
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:border-lime-400 transition-colors"
            >
                <span className="truncate">{active?.name ?? 'Sin polla activa'}</span>
                <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
                </motion.div>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.18, ease: 'easeOut' as const }}
                        className="absolute top-full mt-2 left-0 right-0 z-30 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
                    >
                        {leagues.map((league) => (
                            <button
                                key={league.id}
                                onClick={() => {
                                    onChange(league.id);
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${
                                    league.id === activeId
                                        ? 'bg-lime-50 text-lime-700'
                                        : 'text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                {league.name}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {open && (
                <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            )}
        </div>
    );
};

/* ─── Stat Card ────────────────────────────────────────────────── */

const StatCard: React.FC<{
    label: string;
    value: string | number;
    sub?: string;
    accent: string;
    bg: string;
    delay?: number;
}> = ({ label, value, sub, accent, bg, delay = 0 }) => (
    <motion.div {...fade(delay)} className={`rounded-[1.75rem] p-5 ${bg}`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${accent} opacity-70`}>{label}</p>
        <p className={`text-3xl font-black mt-2 ${accent}`}>{value}</p>
        {sub && <p className={`text-[10px] font-bold mt-1 ${accent} opacity-60`}>{sub}</p>}
    </motion.div>
);

/* ─── Dashboard ────────────────────────────────────────────────── */

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const activeLeague = useLeagueStore((state) => state.activeLeague);
    const myLeagues = useLeagueStore((state) => state.myLeagues);
    const leagueLoading = useLeagueStore((state) => state.isLoading);
    const fetchMyLeagues = useLeagueStore((state) => state.fetchMyLeagues);
    const fetchLeagueDetails = useLeagueStore((state) => state.fetchLeagueDetails);
    const setActiveLeague = useLeagueStore((state) => state.setActiveLeague);
    const matches = usePredictionStore((state) => state.matches);
    const leaderboard = usePredictionStore((state) => state.leaderboard);
    const fetchLeagueMatches = usePredictionStore((state) => state.fetchLeagueMatches);
    const fetchLeaderboard = usePredictionStore((state) => state.fetchLeaderboard);
    const resetLeagueData = usePredictionStore((state) => state.resetLeagueData);
    const stats = useDashboardStore((state) => state.stats);
    const leagues = useDashboardStore((state) => state.leagues);
    const predictions = useDashboardStore((state) => state.predictions);
    const dashboardLoading = useDashboardStore((state) => state.loading);
    const dashboardError = useDashboardStore((state) => state.error);
    const fetchDashboardData = useDashboardStore((state) => state.fetchDashboardData);

    const [error, setError] = useState<string | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);

    const isLoading = leagueLoading || dashboardLoading;
    const isAdmin = activeLeague?.role === 'ADMIN';

    const upcomingMatches = useMemo(() => matches.slice(0, 3), [matches]);
    const topPlayers = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);
    const totalPredictions = (stats?.aciertos || 0) + (stats?.errores || 0);
    const currentAccuracy = stats?.tasa || 0;

    const handleDashboardRetry = useCallback(() => {
        void fetchDashboardData(true);
    }, [fetchDashboardData]);

    useEffect(() => {
        if (user) void fetchDashboardData().catch(() => {});
    }, [user, fetchDashboardData]);

    useEffect(() => {
        if (myLeagues.length > 0) return;
        void fetchMyLeagues().catch((e) => {
            setError(e instanceof Error ? e.message : 'No fue posible cargar tus ligas.');
        });
    }, [fetchMyLeagues, myLeagues.length]);

    useEffect(() => {
        if (!activeLeague?.id) {
            resetLeagueData();
            return;
        }
        setError(null);
        void Promise.all([
            fetchLeagueDetails(activeLeague.id),
            fetchLeagueMatches(activeLeague.id),
            fetchLeaderboard(activeLeague.id),
        ]).catch((e) => {
            setError(e instanceof Error ? e.message : 'No fue posible cargar la liga activa.');
        });
    }, [activeLeague?.id, fetchLeagueDetails, fetchLeagueMatches, fetchLeaderboard, resetLeagueData]);

    /* ── Empty state ── */
    if (!isLoading && myLeagues.length === 0 && !error) {
        return (
            <motion.div {...fade()} className="space-y-5">
                <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
                    <motion.div
                        animate={{ y: [0, -6, 0] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-lime-100 text-lime-600"
                    >
                        <Trophy size={28} />
                    </motion.div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Aún no tienes ligas</h1>
                    <p className="mx-auto mt-3 max-w-xs text-sm text-slate-500">
                        Crea tu primera polla o únete con un código para comenzar.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <button
                            className="rounded-2xl bg-lime-400 px-6 py-3 text-sm font-black uppercase tracking-wide text-slate-900 hover:bg-lime-500 transition-colors"
                            onClick={() => navigate('/create-league')}
                        >
                            Crear liga
                        </button>
                        <button
                            className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50 transition-colors"
                            onClick={() => navigate('/join')}
                        >
                            Unirme con código
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="space-y-5 pb-10">
            {/* ── Header ── */}
            <motion.header {...fade(0)} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-lime-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-lime-700">
                            Panel principal
                        </span>
                        {activeLeague?.settings.plan && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                                Plan {activeLeague.settings.plan}
                            </span>
                        )}
                        {isAdmin && (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
                                Admin
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl font-black font-brand uppercase tracking-tight text-slate-900 sm:text-3xl">
                        Hola, {user?.name?.split(' ')[0] || 'usuario'} 👋
                    </h1>
                    {activeLeague?.name && (
                        <p className="text-sm text-slate-500">{activeLeague.name}</p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Liga activa
                        </label>
                        <LeagueSwitcher
                            leagues={myLeagues}
                            activeId={activeLeague?.id}
                            onChange={(id) => setActiveLeague(id)}
                        />
                    </div>
                    {activeLeague?.code && (
                        <button
                            onClick={() => setInviteOpen(true)}
                            className="mt-5 flex items-center gap-2 rounded-2xl bg-lime-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-lime-500 transition-colors"
                        >
                            <Users size={16} />
                            <span className="hidden sm:inline">Invitar</span>
                        </button>
                    )}
                </div>
            </motion.header>

            {/* ── Error banners ── */}
            {dashboardError && (
                <ErrorBanner message={dashboardError} onRetry={handleDashboardRetry} dismissable={true} />
            )}
            {error && (
                <motion.div {...fade()} className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{error}</span>
                </motion.div>
            )}

            {/* ── Stats row ── */}
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard
                    label="Aciertos"
                    value={stats?.aciertos || 0}
                    sub={`de ${totalPredictions} predicciones`}
                    accent="text-lime-700"
                    bg="bg-lime-50"
                    delay={0.05}
                />
                <StatCard
                    label="Errores"
                    value={stats?.errores || 0}
                    accent="text-rose-600"
                    bg="bg-rose-50"
                    delay={0.1}
                />
                <StatCard
                    label="Racha"
                    value={stats?.racha || 0}
                    sub="consecutivos"
                    accent="text-amber-700"
                    bg="bg-amber-50"
                    delay={0.15}
                />
                <StatCard
                    label="Tasa"
                    value={`${currentAccuracy.toFixed(1)}%`}
                    sub="de acierto"
                    accent="text-blue-700"
                    bg="bg-blue-50"
                    delay={0.2}
                />
            </section>

            {/* ── Main grid ── */}
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_0.95fr_1.1fr]">

                {/* ── Left column ── */}
                <div className="space-y-5">
                    {/* Financial / Admin card */}
                    <motion.article {...fade(0.1)} className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-5 space-y-4 text-white shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                {isAdmin ? 'Finanzas de la liga' : 'Estado financiero'}
                            </p>
                            <Coins className="h-4 w-4 text-lime-400" />
                        </div>
                        <div>
                            <p className="text-3xl font-black font-brand leading-none text-white">
                                {activeLeague?.stats.totalPrize || formatCurrency(activeLeague?.settings.baseFee, activeLeague?.settings.currency)}
                            </p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                Bolsa estimada
                            </p>
                        </div>
                        <div className="space-y-2 border-t border-white/10 pt-3 text-[11px] font-bold">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Mi rol</span>
                                <span>{isAdmin ? 'Administrador' : 'Participante'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Participantes</span>
                                <span>
                                    {activeLeague?.stats.memberCount ?? 0}
                                    {activeLeague?.settings.maxParticipants ? ` / ${activeLeague.settings.maxParticipants}` : ''}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Cuota base</span>
                                <span>{formatCurrency(activeLeague?.settings.baseFee, activeLeague?.settings.currency)}</span>
                            </div>
                            {activeLeague?.code && (
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Código</span>
                                    <span className="font-black tracking-wider">{activeLeague.code}</span>
                                </div>
                            )}
                        </div>
                        {isAdmin ? (
                            <button
                                onClick={() => navigate('/create-league')}
                                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-lime-400 text-[10px] font-black uppercase tracking-[0.2em] text-slate-950 hover:bg-lime-500 transition-colors"
                            >
                                <Settings className="h-4 w-4" /> Gestionar liga
                            </button>
                        ) : (
                            <button
                                onClick={() => setInviteOpen(true)}
                                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/20 transition-colors"
                            >
                                <Users className="h-4 w-4" /> Invitar amigos
                            </button>
                        )}
                    </motion.article>

                    {/* Rules card */}
                    <motion.article {...fade(0.15)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Reglas de puntos</h2>
                            <ListChecks className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="space-y-2">
                            {[
                                { label: 'Marcador exacto', value: '5 pts' },
                                { label: 'Ganador acertado', value: '2 pts' },
                                { label: 'Gol acertado', value: '1 pt' },
                            ].map((rule) => (
                                <div key={rule.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">{rule.label}</span>
                                    <span className="text-sm font-black text-lime-600">{rule.value}</span>
                                </div>
                            ))}
                        </div>
                    </motion.article>

                    {/* Prizes card */}
                    <motion.article {...fade(0.2)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Premios</h2>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                {activeLeague?.stats.totalPrize || 'Sin bolsa'}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {[
                                { label: '1er puesto', width: '60%', value: '60%', color: 'bg-lime-400' },
                                { label: '2do puesto', width: '30%', value: '30%', color: 'bg-amber-400' },
                                { label: '3er puesto', width: '10%', value: '10%', color: 'bg-slate-400' },
                            ].map((prize) => (
                                <div key={prize.label} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                        <span>{prize.label}</span>
                                        <span className="text-slate-700">{prize.value}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: prize.width }}
                                            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                                            className={`h-full rounded-full ${prize.color}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.article>
                </div>

                {/* ── Center column ── */}
                <div className="space-y-5">
                    {/* My leagues */}
                    <motion.article {...fade(0.1)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Tus ligas</h2>
                            <Users className="h-4 w-4 text-slate-400" />
                        </div>
                        {leagues && leagues.length > 0 ? (
                            <div className="space-y-2">
                                {leagues.slice(0, 4).map((league, i) => (
                                    <motion.div
                                        key={league.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + i * 0.05 }}
                                        className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black uppercase text-slate-900">{league.nombre}</p>
                                                <p className="mt-0.5 text-[10px] font-bold text-slate-400">{league.participantes} participantes</p>
                                            </div>
                                            <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm flex-shrink-0">
                                                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Pos.</p>
                                                <p className="text-sm font-black text-lime-600">#{league.posicion}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                                No participas en ligas
                            </div>
                        )}
                    </motion.article>

                    {/* Performance summary */}
                    <motion.article {...fade(0.15)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Mi rendimiento</h2>
                            <Clock className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-4 text-slate-950">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">Racha</p>
                                <p className="mt-2 text-3xl font-black">{stats?.racha || 0}</p>
                            </div>
                            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">Tasa</p>
                                <p className="mt-2 text-3xl font-black">{currentAccuracy.toFixed(1)}%</p>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Total predicciones</p>
                            <p className="mt-1 text-2xl font-black text-slate-900">{totalPredictions}</p>
                        </div>

                        {/* Accuracy progress bar */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                <span>Precisión global</span>
                                <span>{currentAccuracy.toFixed(1)}%</span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${currentAccuracy}%` }}
                                    transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
                                    className="h-full rounded-full bg-gradient-to-r from-lime-400 to-lime-500"
                                />
                            </div>
                        </div>
                    </motion.article>
                </div>

                {/* ── Right column ── */}
                <div className="space-y-5">
                    {/* Top ranking */}
                    <motion.article {...fade(0.1)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                                <Trophy className="h-4 w-4 text-lime-500" /> Top actual
                            </h2>
                            <button
                                className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 hover:text-lime-600 transition-colors"
                                onClick={() => navigate('/ranking')}
                            >
                                Ver más
                            </button>
                        </div>
                        {topPlayers.length > 0 ? (
                            <div className="space-y-2">
                                {topPlayers.map((player, i) => (
                                    <motion.div
                                        key={player.id}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + i * 0.07 }}
                                        className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
                                            i === 0
                                                ? 'border-amber-200 bg-amber-50'
                                                : 'border-slate-100 bg-slate-50'
                                        }`}
                                    >
                                        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[11px] font-black ${
                                            i === 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-white'
                                        }`}>
                                            #{player.rank}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-black uppercase text-slate-900">{player.name}</p>
                                            <p className="text-[10px] text-slate-400">@{player.username}</p>
                                        </div>
                                        <span className={`text-sm font-black ${i === 0 ? 'text-amber-700' : 'text-lime-600'}`}>
                                            {player.points} pts
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                                El ranking todavía no tiene datos.
                            </div>
                        )}
                    </motion.article>

                    {/* Upcoming matches */}
                    <motion.article {...fade(0.15)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Próximos partidos</h2>
                            <Link
                                to="/predictions"
                                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 hover:text-lime-600 transition-colors"
                            >
                                Ver todos <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                        {upcomingMatches.length > 0 ? (
                            <div className="space-y-2">
                                {upcomingMatches.map((match, i) => (
                                    <motion.div
                                        key={match.id}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 + i * 0.06 }}
                                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                    {safeText(match.displayDate, match.date)}
                                                </p>
                                                <p className="mt-1 text-sm font-black uppercase text-slate-900">
                                                    {match.homeTeam} vs {match.awayTeam}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-500">{safeText(match.venue, 'Por definir')}</p>
                                            </div>
                                            {match.saved ? (
                                                <div className="flex-shrink-0 flex items-center gap-1 rounded-full bg-lime-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-lime-700">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Ok
                                                </div>
                                            ) : (
                                                <Link
                                                    to="/predictions"
                                                    className="flex-shrink-0 flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 hover:bg-amber-200 transition-colors"
                                                >
                                                    <Zap className="h-3.5 w-3.5" /> Predecir
                                                </Link>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                                No hay partidos próximos.
                            </div>
                        )}
                    </motion.article>

                    {/* Recent predictions */}
                    <motion.article {...fade(0.2)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Predicciones recientes</h2>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                {predictions?.length || 0}
                            </span>
                        </div>
                        {predictions && predictions.length > 0 ? (
                            <div className="space-y-2">
                                {predictions.slice(0, 3).map((p, i) => (
                                    <motion.div
                                        key={p.id}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + i * 0.06 }}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-slate-900">{p.match}</p>
                                            <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                                                Pronóstico: {p.tuPrediccion}
                                            </p>
                                        </div>
                                        <div className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                            p.acierto ? 'bg-lime-100 text-lime-700' : 'bg-rose-100 text-rose-700'
                                        }`}>
                                            {p.acierto ? 'Acierto' : 'Error'}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                                <p className="text-sm text-slate-500">Aún no haces predicciones</p>
                                <Link
                                    to="/predictions"
                                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-sm font-bold uppercase text-slate-900 hover:bg-lime-500 transition-colors"
                                >
                                    Ir a pronósticos <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        )}
                    </motion.article>
                </div>
            </section>

            {/* ── Action bar ── */}
            {activeLeague && (
                <motion.section {...fade(0.25)} className="grid gap-3 sm:grid-cols-4">
                    <button
                        className="flex items-center justify-between rounded-[1.5rem] bg-slate-900 px-5 py-4 text-left text-white hover:bg-slate-800 transition-colors"
                        onClick={() => navigate('/create-league')}
                    >
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-300">Crear</p>
                            <p className="mt-1 text-sm font-black uppercase">Nueva liga</p>
                        </div>
                        <PlusCircle className="h-5 w-5 text-lime-400" />
                    </button>

                    <button
                        className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                        onClick={() => navigate('/predictions')}
                    >
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Pronósticos</p>
                            <p className="mt-1 text-sm font-black uppercase text-slate-900">Guardar</p>
                        </div>
                        <Trophy className="h-5 w-5 text-lime-600" />
                    </button>

                    <Link
                        className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                        to="/join"
                    >
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Unirme</p>
                            <p className="mt-1 text-sm font-black uppercase text-slate-900">Con código</p>
                        </div>
                        <Users className="h-5 w-5 text-slate-600" />
                    </Link>

                    <button
                        className="flex items-center justify-between rounded-[1.5rem] border border-lime-200 bg-lime-50 px-5 py-4 text-left hover:bg-lime-100 transition-colors"
                        onClick={() => setInviteOpen(true)}
                    >
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-600">Invitar</p>
                            <p className="mt-1 text-sm font-black uppercase text-slate-900">Amigos</p>
                        </div>
                        <Share2 className="h-5 w-5 text-lime-600" />
                    </button>
                </motion.section>
            )}

            {/* ── Invite modal ── */}
            <InviteModal
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                code={activeLeague?.code}
                leagueName={activeLeague?.name}
            />
        </div>
    );
};

export default Dashboard;
