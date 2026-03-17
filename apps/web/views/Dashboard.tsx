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
    Eye,
    EyeOff,
    ListChecks,
    Settings,
    Share2,
    TrendingUp,
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

const ADMIN_COMMISSION = 0.1;

function calcPrizes(baseFee: number | null | undefined, memberCount: number | undefined, currency = 'COP') {
    const raw = (baseFee ?? 0) * (memberCount ?? 0);
    const net = Math.round(raw * (1 - ADMIN_COMMISSION));
    const commission = raw - net;
    const fmt = (n: number) => (n > 0 ? formatCurrency(n, currency) : '—');
    return {
        raw, net, commission,
        first: Math.round(net * 0.6),
        second: Math.round(net * 0.3),
        third: Math.round(net * 0.1),
        fmt,
    };
}

const fade = (delay = 0) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: 'easeOut' as const, delay },
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

    const handleShare = () => {
        const text = `Únete a mi polla "${leagueName}" con el código: ${code}`;
        if (navigator.share) {
            void navigator.share({ title: leagueName, text });
        } else {
            void navigator.clipboard.writeText(text).then(() => {
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
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 10 }}
                        transition={{ duration: 0.26, ease: 'easeOut' as const }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm px-4"
                    >
                        <div className="bg-white rounded-[2rem] shadow-2xl p-6 space-y-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900">Invitar a la polla</h2>
                                    <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[220px]">{leagueName}</p>
                                </div>
                                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="rounded-2xl bg-slate-950 p-5 text-center">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 mb-3">Código de invitación</p>
                                <p className="text-4xl font-black tracking-[0.25em] text-white font-brand">{code || '------'}</p>
                                <p className="text-[10px] text-slate-500 mt-2">Comparte este código con tus amigos</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={handleCopy} className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all">
                                    {copied ? <><CheckCircle2 size={16} className="text-lime-500" /> Copiado</> : <><Copy size={16} /> Copiar código</>}
                                </button>
                                <button onClick={handleShare} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-lime-400 text-slate-950 text-sm font-bold hover:bg-lime-500 transition-all">
                                    <Share2 size={16} /> Compartir
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
    const savePrediction = usePredictionStore((state) => state.savePrediction);
    const fetchLeagueMatches = usePredictionStore((state) => state.fetchLeagueMatches);
    const fetchLeaderboard = usePredictionStore((state) => state.fetchLeaderboard);
    const resetLeagueData = usePredictionStore((state) => state.resetLeagueData);
    const stats = useDashboardStore((state) => state.stats);
    const predictions = useDashboardStore((state) => state.predictions);
    const dashboardLoading = useDashboardStore((state) => state.loading);
    const dashboardError = useDashboardStore((state) => state.error);
    const fetchDashboardData = useDashboardStore((state) => state.fetchDashboardData);

    const [error, setError] = useState<string | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [spectatorMode, setSpectatorMode] = useState(false);
    const [leagueDropOpen, setLeagueDropOpen] = useState(false);
    const [quickPreds, setQuickPreds] = useState<Record<string, { home: string; away: string }>>({});
    const [savingMatchId, setSavingMatchId] = useState<string | null>(null);

    const isLoading = leagueLoading || dashboardLoading;
    const isRealAdmin = activeLeague?.role === 'ADMIN';
    const isAdmin = isRealAdmin && !spectatorMode;

    const upcomingMatches = useMemo(() => matches.filter(m => m.status === 'open').slice(0, 3), [matches]);
    const nextUnsaved = useMemo(() => matches.find(m => m.status === 'open' && !m.saved), [matches]);
    const topPlayers = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);

    // My position in leaderboard
    const myEntry = useMemo(
        () => leaderboard.find((p) => p.id === user?.id || p.username === user?.username),
        [leaderboard, user],
    );

    // Last correct prediction
    const lastHit = useMemo(
        () => predictions?.find((p) => p.acierto),
        [predictions],
    );

    const prizes = useMemo(() => calcPrizes(
        activeLeague?.settings.baseFee,
        activeLeague?.stats.memberCount,
        activeLeague?.settings.currency ?? 'COP',
    ), [activeLeague]);

    const memberCount = activeLeague?.stats.memberCount ?? 0;
    const maxParticipants = activeLeague?.settings.maxParticipants ?? 0;
    const occupancyPct = maxParticipants > 0 ? Math.min(100, Math.round((memberCount / maxParticipants) * 100)) : 0;

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
        if (!activeLeague?.id) { resetLeagueData(); return; }
        setError(null);
        void Promise.all([
            fetchLeagueDetails(activeLeague.id),
            fetchLeagueMatches(activeLeague.id),
            fetchLeaderboard(activeLeague.id),
        ]).catch((e) => {
            setError(e instanceof Error ? e.message : 'No fue posible cargar la liga activa.');
        });
    }, [activeLeague?.id, fetchLeagueDetails, fetchLeagueMatches, fetchLeaderboard, resetLeagueData]);

    const handleQuickSave = async (matchId: string) => {
        if (!activeLeague?.id) return;
        const pred = quickPreds[matchId];
        const home = parseInt(pred?.home ?? '0', 10);
        const away = parseInt(pred?.away ?? '0', 10);
        if (isNaN(home) || isNaN(away)) return;
        setSavingMatchId(matchId);
        try {
            await savePrediction(activeLeague.id, matchId, home, away);
            await fetchLeagueMatches(activeLeague.id);
            setQuickPreds((p) => { const n = { ...p }; delete n[matchId]; return n; });
        } finally {
            setSavingMatchId(null);
        }
    };

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
                        <button className="rounded-2xl bg-lime-400 px-6 py-3 text-sm font-black uppercase tracking-wide text-slate-900 hover:bg-lime-500 transition-colors" onClick={() => navigate('/create-league')}>
                            Crear liga
                        </button>
                        <button className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50 transition-colors" onClick={() => navigate('/join')}>
                            Unirme con código
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="space-y-5 pb-10">

            {/* ── Spectator banner ── */}
            <AnimatePresence>
                {spectatorMode && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25, ease: 'easeOut' as const }}
                        className="flex items-center justify-between gap-4 rounded-2xl bg-violet-600 px-5 py-3"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <Eye size={16} className="text-violet-200 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">Modo espectador activo</p>
                                <p className="text-[11px] text-violet-200 hidden sm:block">Estás viendo la liga como un participante.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSpectatorMode(false)}
                            className="flex-shrink-0 rounded-xl border border-violet-400 bg-white/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white hover:bg-white/20 transition-colors"
                        >
                            Volver a admin
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Header ── */}
            <motion.header {...fade(0)} className="space-y-3">
                {/* Badge row */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Role badge */}
                    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                        isAdmin ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                        {isAdmin ? 'Administrador' : 'Participante'}
                    </span>

                    {/* Spectator toggle */}
                    {isRealAdmin && (
                        <button
                            onClick={() => setSpectatorMode((v) => !v)}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                                spectatorMode
                                    ? 'border-violet-300 bg-violet-50 text-violet-700'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-600'
                            }`}
                        >
                            {spectatorMode ? <><EyeOff size={11} /> Salir de espectador</> : <><Eye size={11} /> Ver como espectador</>}
                        </button>
                    )}

                    {/* Plan badge */}
                    {activeLeague?.settings.plan && (
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                            activeLeague.settings.plan === 'DIAMOND'
                                ? 'border-purple-200 bg-purple-50 text-purple-700'
                                : activeLeague.settings.plan === 'GOLD'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}>
                            Plan {activeLeague.settings.plan}
                        </span>
                    )}
                </div>

                {/* Title + action row */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* League name dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setLeagueDropOpen((v) => !v)}
                            className="flex items-center gap-2 group"
                        >
                            <h1 className="text-3xl font-black font-brand uppercase tracking-tight text-slate-900 sm:text-4xl group-hover:text-lime-700 transition-colors leading-none">
                                {activeLeague?.name || 'Sin liga'}
                            </h1>
                            <motion.div animate={{ rotate: leagueDropOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="mt-1">
                                <ChevronDown size={20} className="text-slate-400 group-hover:text-lime-600 transition-colors" />
                            </motion.div>
                        </button>

                        <AnimatePresence>
                            {leagueDropOpen && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setLeagueDropOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                        transition={{ duration: 0.16, ease: 'easeOut' as const }}
                                        className="absolute top-full mt-2 left-0 z-30 min-w-[240px] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
                                    >
                                        {myLeagues.map((league) => (
                                            <button
                                                key={league.id}
                                                onClick={() => { setActiveLeague(league.id); setLeagueDropOpen(false); setSpectatorMode(false); }}
                                                className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${
                                                    league.id === activeLeague?.id ? 'bg-lime-50 text-lime-700' : 'text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                {league.name}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Header action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Quick predict button */}
                        {nextUnsaved && (
                            <button
                                onClick={() => navigate('/predictions')}
                                className="flex items-center gap-2 rounded-2xl bg-lime-400 px-4 py-2.5 text-sm font-black uppercase tracking-wide text-slate-950 hover:bg-lime-500 transition-all"
                            >
                                <Zap size={15} />
                                Pronosticar
                            </button>
                        )}
                        {activeLeague?.code && (
                            <button
                                onClick={() => setInviteOpen(true)}
                                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black uppercase tracking-wide text-slate-700 hover:border-slate-300 transition-all"
                            >
                                <Share2 size={15} />
                                Invitar
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                onClick={() => navigate('/create-league')}
                                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black uppercase tracking-wide text-slate-700 hover:border-slate-300 transition-all"
                            >
                                <Settings size={15} />
                                Configurar
                            </button>
                        )}
                    </div>
                </div>

                {/* Spectator sub-banner */}
                <AnimatePresence>
                    {spectatorMode && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="flex items-center justify-between gap-3 rounded-xl bg-violet-600 px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                    <Eye size={13} className="text-violet-200" />
                                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white">Modo espectador activo</p>
                                </div>
                                <button
                                    onClick={() => setSpectatorMode(false)}
                                    className="rounded-lg border border-violet-400 px-3 py-1 text-[10px] font-black uppercase text-white hover:bg-white/10 transition-colors"
                                >
                                    Volver
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.header>

            {/* ── Error banners ── */}
            {dashboardError && <ErrorBanner message={dashboardError} onRetry={handleDashboardRetry} dismissable />}
            {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* ── Main grid ── */}
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">

                {/* ── Left column ── */}
                <div className="space-y-5">
                    <AnimatePresence mode="wait">
                        {spectatorMode ? (
                            /* ── SPECTATOR: Mi desempeño ── */
                            <motion.div key="spectator-left" {...fade(0.05)} className="space-y-5">
                                {/* Performance card */}
                                <article className="rounded-[1.75rem] overflow-hidden shadow-sm">
                                    <div className="bg-gradient-to-br from-indigo-900 via-violet-900 to-slate-900 p-5 space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Mi desempeño</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Puntos acumulados</p>
                                            </div>
                                            {myEntry && (
                                                <span className="rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white">
                                                    Puesto #{myEntry.rank}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-end gap-4">
                                            <div>
                                                <p className="text-5xl font-black text-white leading-none">
                                                    {myEntry?.points ?? stats?.aciertos ?? 0}
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-1">pts totales</p>
                                            </div>
                                            <motion.div
                                                animate={{ y: [0, -4, 0] }}
                                                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                                            >
                                                <TrendingUp size={48} className="text-lime-400 opacity-80" />
                                            </motion.div>
                                        </div>

                                        {lastHit && (
                                            <div className="rounded-xl bg-lime-400 px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded-lg bg-lime-600 px-2 py-0.5 text-[11px] font-black text-white">
                                                        +{lastHit.tuPrediccion.includes('-') ? '5' : '2'}
                                                    </span>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-lime-800">Último acierto</p>
                                                        <p className="text-[11px] font-black text-slate-900">{lastHit.match}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </article>

                                {/* Tu próximo reto */}
                                {nextUnsaved ? (
                                    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Tu próximo reto</p>
                                            <Clock size={14} className="text-slate-300" />
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-center flex-1">
                                                <p className="text-2xl font-black uppercase text-slate-900">{nextUnsaved.homeTeam?.slice(0, 3)}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{nextUnsaved.homeTeam}</p>
                                            </div>
                                            <span className="text-xs font-bold text-slate-300">vs</span>
                                            <div className="text-center flex-1">
                                                <p className="text-2xl font-black uppercase text-slate-900">{nextUnsaved.awayTeam?.slice(0, 3)}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{nextUnsaved.awayTeam}</p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => navigate('/predictions')}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3 text-sm font-black uppercase tracking-wide text-slate-950 hover:bg-lime-500 transition-colors"
                                        >
                                            <Zap size={15} /> Pronosticar
                                        </button>

                                        <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
                                            <Clock size={11} />
                                            <span className="font-bold">{safeText(nextUnsaved.displayDate, nextUnsaved.date)}</span>
                                        </div>
                                    </article>
                                ) : (
                                    <article className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-center space-y-2">
                                        <CheckCircle2 size={24} className="text-lime-500 mx-auto" />
                                        <p className="text-sm font-black text-slate-700">¡Todos los pronósticos guardados!</p>
                                        <p className="text-[11px] text-slate-400">No tienes partidos pendientes.</p>
                                    </article>
                                )}

                                {/* Stats grid */}
                                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Mis estadísticas</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-xl bg-lime-50 p-3 text-center">
                                            <p className="text-xs font-black text-lime-700">Aciertos</p>
                                            <p className="text-2xl font-black text-lime-900">{stats?.aciertos || 0}</p>
                                        </div>
                                        <div className="rounded-xl bg-rose-50 p-3 text-center">
                                            <p className="text-xs font-black text-rose-700">Errores</p>
                                            <p className="text-2xl font-black text-rose-900">{stats?.errores || 0}</p>
                                        </div>
                                        <div className="rounded-xl bg-amber-50 p-3 text-center">
                                            <p className="text-xs font-black text-amber-700">Racha</p>
                                            <p className="text-2xl font-black text-amber-900">{stats?.racha || 0}</p>
                                        </div>
                                        <div className="rounded-xl bg-blue-50 p-3 text-center">
                                            <p className="text-xs font-black text-blue-700">Tasa</p>
                                            <p className="text-2xl font-black text-blue-900">{(stats?.tasa || 0).toFixed(0)}%</p>
                                        </div>
                                    </div>
                                </article>
                            </motion.div>
                        ) : (
                            /* ── ADMIN: Financial column ── */
                            <motion.div key="admin-left" {...fade(0.05)} className="space-y-5">
                                {/* Financial card */}
                                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Estado financiero</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-600">
                                                {activeLeague?.status === 'ACTIVE' ? 'En curso' : (activeLeague?.status ?? '—')}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 mb-1">Recaudo total</p>
                                        <p className="text-3xl font-black font-brand text-slate-900 leading-none">
                                            {prizes.raw > 0 ? prizes.fmt(prizes.raw) : (activeLeague?.stats.totalPrize || '—')}
                                        </p>
                                    </div>
                                    <div className="space-y-2 border-t border-slate-100 pt-4">
                                        <div className="flex items-center justify-between text-[11px] font-bold">
                                            <span className="text-slate-500">Bolsa premios (neto)</span>
                                            <span className="text-lime-600 font-black">{prizes.net > 0 ? prizes.fmt(prizes.net) : '—'}</span>
                                        </div>
                                        {prizes.commission > 0 && (
                                            <div className="flex items-center justify-between text-[11px] font-bold">
                                                <span className="text-slate-500">Comisión admin ({Math.round(ADMIN_COMMISSION * 100)}%)</span>
                                                <span className="text-rose-500 font-black">{prizes.fmt(prizes.commission)}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-[11px] font-bold">
                                            <span className="text-slate-500">Cuota base</span>
                                            <span className="text-slate-700">{formatCurrency(activeLeague?.settings.baseFee, activeLeague?.settings.currency)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => navigate('/create-league')}
                                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-lime-400 text-[10px] font-black uppercase tracking-[0.2em] text-slate-950 hover:bg-lime-500 transition-colors"
                                    >
                                        <Coins size={14} /> Gestionar pagos
                                    </button>
                                </article>

                                {/* Cupos de liga */}
                                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Cupos de liga</p>
                                        <Users size={14} className="text-slate-300" />
                                    </div>
                                    <div>
                                        <div className="flex items-baseline justify-between mb-2">
                                            <span className="text-2xl font-black text-slate-900">
                                                {memberCount}
                                                {maxParticipants > 0 && <span className="text-base font-bold text-slate-400"> / {maxParticipants}</span>}
                                            </span>
                                            {maxParticipants > 0 && <span className="text-[10px] font-black text-slate-400">{occupancyPct}%</span>}
                                        </div>
                                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: maxParticipants > 0 ? `${occupancyPct}%` : '0%' }}
                                                transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' as const }}
                                                className="h-full rounded-full bg-lime-400"
                                            />
                                        </div>
                                        {maxParticipants === 0 && <p className="mt-1 text-[10px] text-slate-400">Sin límite de participantes</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => navigate('/create-league')}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50 transition-colors"
                                        >
                                            <Settings size={13} /> Configurar
                                        </button>
                                        {activeLeague?.code && (
                                            <button
                                                onClick={() => setInviteOpen(true)}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 text-[11px] font-black uppercase tracking-wide text-white hover:bg-slate-800 transition-colors"
                                            >
                                                <Share2 size={13} /> Invitar
                                            </button>
                                        )}
                                    </div>
                                </article>

                                {/* Rules */}
                                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Reglas de puntos</h2>
                                        <ListChecks className="h-4 w-4 text-slate-300" />
                                    </div>
                                    {[
                                        { label: 'Marcador exacto', value: '5', icon: '🎯' },
                                        { label: 'Ganador acertado', value: '2', icon: '✅' },
                                        { label: 'Gol acertado', value: '1', icon: '⚽' },
                                    ].map((rule) => (
                                        <div key={rule.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <span>{rule.icon}</span>
                                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">{rule.label}</span>
                                            </div>
                                            <span className="text-sm font-black text-lime-600">{rule.value}</span>
                                        </div>
                                    ))}
                                </article>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Center column ── */}
                <div className="space-y-5">
                    {/* Prizes */}
                    <motion.article {...fade(0.08)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Premios</h2>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                                Bolsa: {prizes.net > 0 ? prizes.fmt(prizes.net) : (activeLeague?.stats.totalPrize || '—')}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {[
                                { label: '1er puesto (60%)', width: 60, amount: prizes.first, color: 'bg-lime-400' },
                                { label: '2do puesto (30%)', width: 30, amount: prizes.second, color: 'bg-amber-400' },
                                { label: '3er puesto (10%)', width: 10, amount: prizes.third, color: 'bg-slate-400' },
                            ].map((prize) => (
                                <div key={prize.label} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{prize.label}</span>
                                        <span className="text-[11px] font-black text-lime-700">{prize.amount > 0 ? prizes.fmt(prize.amount) : '—'}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${prize.width}%` }}
                                            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' as const }}
                                            className={`h-full rounded-full ${prize.color}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.article>

                    {/* My stats (center, for non-spectator) */}
                    {!spectatorMode && (
                        <motion.article {...fade(0.12)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Mi rendimiento</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-gradient-to-br from-lime-400 to-lime-500 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-900 opacity-70">Aciertos</p>
                                    <p className="mt-1.5 text-3xl font-black text-lime-950">{stats?.aciertos || 0}</p>
                                </div>
                                <div className="rounded-2xl bg-gradient-to-br from-rose-400 to-rose-500 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-950 opacity-70">Errores</p>
                                    <p className="mt-1.5 text-3xl font-black text-rose-950">{stats?.errores || 0}</p>
                                </div>
                                <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-950 opacity-70">Racha</p>
                                    <p className="mt-1.5 text-3xl font-black text-amber-950">{stats?.racha || 0}</p>
                                </div>
                                <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white opacity-70">Tasa</p>
                                    <p className="mt-1.5 text-3xl font-black text-white">{(stats?.tasa || 0).toFixed(1)}%</p>
                                </div>
                            </div>
                        </motion.article>
                    )}

                    {/* Recent predictions */}
                    <motion.article {...fade(0.16)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Predicciones recientes</h2>
                            <Link to="/predictions" className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 hover:text-lime-600 transition-colors">
                                Ver todas
                            </Link>
                        </div>
                        {predictions && predictions.length > 0 ? (
                            <div className="space-y-2">
                                {predictions.slice(0, 3).map((p, i) => (
                                    <motion.div
                                        key={p.id}
                                        initial={{ opacity: 0, x: 8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + i * 0.06 }}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-slate-900">{p.match}</p>
                                            <p className="mt-0.5 text-[10px] font-bold text-slate-400">Pronóstico: {p.tuPrediccion}</p>
                                        </div>
                                        <div className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${p.acierto ? 'bg-lime-100 text-lime-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {p.acierto ? 'Acierto' : 'Error'}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                                <p className="text-sm text-slate-500">Aún no haces predicciones</p>
                                <Link to="/predictions" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-sm font-bold uppercase text-slate-900 hover:bg-lime-500 transition-colors">
                                    Ir a pronósticos <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        )}
                    </motion.article>
                </div>

                {/* ── Right column ── */}
                <div className="space-y-5">
                    {/* Top ranking */}
                    <motion.article {...fade(0.08)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                                <Trophy className="h-4 w-4 text-lime-500" /> Top actual
                            </h2>
                        </div>
                        {topPlayers.length > 0 ? (
                            <div className="space-y-2">
                                {topPlayers.map((player, i) => {
                                    const prizeAmt = i === 0 ? prizes.first : i === 1 ? prizes.second : prizes.third;
                                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                                    return (
                                        <motion.div
                                            key={player.id}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.1 + i * 0.08 }}
                                            className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${i === 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}
                                        >
                                            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                                                i === 0 ? 'bg-amber-400 text-slate-950' : i === 1 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {medal}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-black uppercase text-slate-900">{player.name}</p>
                                                <p className="text-[10px] text-slate-400">{player.points} pts</p>
                                            </div>
                                            {prizeAmt > 0 && (
                                                <span className="flex-shrink-0 text-[11px] font-black text-lime-700">{prizes.fmt(prizeAmt)}</span>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                                El ranking todavía no tiene datos.
                            </div>
                        )}
                        <button
                            onClick={() => navigate('/ranking')}
                            className="flex w-full items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-lime-600 transition-colors py-1"
                        >
                            Ver ranking completo <ArrowRight size={12} />
                        </button>
                    </motion.article>

                    {/* Próximos partidos con inputs rápidos */}
                    <motion.article {...fade(0.12)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Próximos partidos</h2>
                            <Clock size={14} className="text-slate-300" />
                        </div>

                        {upcomingMatches.length > 0 ? (
                            <div className="space-y-3">
                                {upcomingMatches.map((match, i) => (
                                    <motion.div
                                        key={match.id}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 + i * 0.07 }}
                                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                {safeText(match.displayDate, match.date)}
                                            </p>
                                            {match.saved ? (
                                                <span className="flex items-center gap-1 rounded-full bg-lime-100 px-2 py-0.5 text-[9px] font-black uppercase text-lime-700">
                                                    <CheckCircle2 size={10} /> Ok
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">Activo</span>
                                            )}
                                        </div>

                                        {/* Teams + score inputs */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-center flex-1">
                                                <p className="text-xl font-black uppercase text-slate-900 leading-none">{match.homeTeam?.slice(0, 3) || '???'}</p>
                                                <p className="text-[9px] text-slate-400 mt-0.5 truncate">{match.homeTeam}</p>
                                            </div>

                                            {!match.saved ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        min={0} max={99}
                                                        value={quickPreds[match.id]?.home ?? '0'}
                                                        onChange={(e) => setQuickPreds((p) => ({ ...p, [match.id]: { home: e.target.value, away: p[match.id]?.away ?? '0' } }))}
                                                        className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-center text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
                                                    />
                                                    <span className="text-slate-300 font-bold">-</span>
                                                    <input
                                                        type="number"
                                                        min={0} max={99}
                                                        value={quickPreds[match.id]?.away ?? '0'}
                                                        onChange={(e) => setQuickPreds((p) => ({ ...p, [match.id]: { home: p[match.id]?.home ?? '0', away: e.target.value } }))}
                                                        className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-center text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-slate-400">
                                                    <span className="text-sm font-black">{match.prediction.home}</span>
                                                    <span className="text-xs">-</span>
                                                    <span className="text-sm font-black">{match.prediction.away}</span>
                                                </div>
                                            )}

                                            <div className="text-center flex-1">
                                                <p className="text-xl font-black uppercase text-slate-900 leading-none">{match.awayTeam?.slice(0, 3) || '???'}</p>
                                                <p className="text-[9px] text-slate-400 mt-0.5 truncate">{match.awayTeam}</p>
                                            </div>
                                        </div>

                                        {/* Save button + admin link */}
                                        <div className="flex items-center justify-between gap-2">
                                            {!match.saved ? (
                                                <button
                                                    onClick={() => handleQuickSave(match.id)}
                                                    disabled={savingMatchId === match.id}
                                                    className="flex-1 rounded-xl bg-lime-400 py-2 text-[10px] font-black uppercase tracking-wide text-slate-950 hover:bg-lime-500 disabled:opacity-60 transition-colors"
                                                >
                                                    {savingMatchId === match.id ? 'Guardando...' : 'Guardar'}
                                                </button>
                                            ) : (
                                                <div className="flex-1" />
                                            )}
                                            {isAdmin && (
                                                <Link
                                                    to="/predictions"
                                                    className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    <Settings size={11} /> Gestionar resultado
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
                </div>
            </section>

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
