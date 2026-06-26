import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ArrowRight, BadgeCheck, Banknote, Calendar, Globe2, Star, Trophy, Users } from 'lucide-react';
import { request } from '../api';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore, type MatchViewModel } from '../stores/prediction.store';
import { useDashboardStore } from '../stores/dashboard.store';
import { useAuthStore } from '../stores/auth.store';
import { ErrorBanner } from '../components/dashboard/ErrorBanner';
import { useLiveSyncEvents } from '../hooks/useLiveSyncEvents';
import { useLiveMatchEvents } from '../hooks/useLiveMatchEvents';
import { useLiveDisplaySettings } from '../hooks/useLiveDisplaySettings';
import { useGoalStickerSettings } from '../hooks/useGoalStickerSettings';
import { useDraggable } from '../hooks/useDraggable';
import { GoalToastContainer } from '../components/live/GoalToast';
import { PushNotificationCard } from '../components/PushNotificationPrompt';
import { calcPrizes, isPredictionWindowClosed, fade } from '../utils/dashboard';
import SpectatorBanner from '../components/dashboard/SpectatorBanner';
import OnboardingBanner from '../components/dashboard/OnboardingBanner';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import FinancialCard from '../components/dashboard/FinancialCard';
import LeagueOccupancyCard from '../components/dashboard/LeagueOccupancyCard';
import ScoringRulesCard from '../components/dashboard/ScoringRulesCard';
import PrizesCard from '../components/dashboard/PrizesCard';
import MyStatsCard from '../components/dashboard/MyStatsCard';
import PerformanceCard from '../components/dashboard/PerformanceCard';
import RecentPredictionsCard from '../components/dashboard/RecentPredictionsCard';
import TopRankingCard from '../components/dashboard/TopRankingCard';
import UpcomingMatchesCard from '../components/dashboard/UpcomingMatchesCard';
import LiveMatchesPanel from '../components/dashboard/LiveMatchesPanel';
import InviteModal from './modals/InviteModal';
import LeagueConfigModal from './modals/LeagueConfigModal';

/* ─── Dashboard ────────────────────────────────────────────────── */

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
    const activeLeague = useLeagueStore((state) => state.activeLeague);
    const myLeagues = useLeagueStore((state) => state.myLeagues);
    const publicLeagues = useLeagueStore((state) => state.publicLeagues);
    const leagueLoading = useLeagueStore((state) => state.isLoading);
    const fetchMyLeagues = useLeagueStore((state) => state.fetchMyLeagues);
    const fetchLeagueDetails = useLeagueStore((state) => state.fetchLeagueDetails);
    const fetchPublicLeagues = useLeagueStore((state) => state.fetchPublicLeagues);
    const joinLeague = useLeagueStore((state) => state.joinLeague);
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
    const [joiningPublicId, setJoiningPublicId] = useState<string | null>(null);
    const [onboardingVisible, setOnboardingVisible] = useState(
        () => localStorage.getItem('onboarding_dismissed') !== '1',
    );
    const [inviteOpen, setInviteOpen] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const [spectatorMode, setSpectatorMode] = useState(false);
    const [leagueDropOpen, setLeagueDropOpen] = useState(false);
    const [quickPreds, setQuickPreds] = useState<Record<string, { home: string; away: string }>>({});
    const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(() => Date.now());

    interface LiveStandingsData { hasLive: boolean; myProvisionalPosition: number | null; myPositionChange: number; myLivePoints: number; liveMatchCount: number; }

    const [liveStandings, setLiveStandings] = useState<LiveStandingsData | null>(null);

    const isLoading = leagueLoading || dashboardLoading;
    const isRealAdmin = activeLeague?.role === 'ADMIN' || isSuperAdmin();

    const isNewUser = (() => {
        if (!user?.createdAt) return true; // no createdAt → assume new
        const created = new Date(user.createdAt).getTime();
        return Date.now() - created < 24 * 60 * 60 * 1000; // less than 24h
    })();
    const isAdmin = isRealAdmin && !spectatorMode;

    const liveMatches = useMemo(() => matches.filter((m) => m.status === 'live'), [matches]);
    const liveMatchIds = useMemo(() => liveMatches.map((m) => m.id), [liveMatches]);
    const liveSync = useLiveSyncEvents();
    const { eventsByMatchId: matchEvents, loadingMatchIds: eventsLoadingMatchIds } =
        useLiveMatchEvents(liveMatchIds);
    const liveDisplay = useLiveDisplaySettings();
    const goalSticker = useGoalStickerSettings();
    const upcomingMatches = useMemo(() => matches.filter((m) => m.status === 'open').slice(0, 3), [matches]);
    const nextUnsaved = useMemo(() => matches.find((m) => m.status === 'open' && !m.saved), [matches]);

    const topPlayers = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);

    // Partido expandido en el panel de chips en vivo (3 estados: null → 1 → 2 → null)
    const [expandedMatchId, setExpandedMatchId] = React.useState<string | null>(null);
    const [expandLevel, setExpandLevel] = React.useState<1 | 2>(1);
    React.useEffect(() => {
        if (liveMatches.length === 0) { setExpandedMatchId(null); setExpandLevel(1); }
    }, [liveMatches]);

    const handleChipClick = React.useCallback((matchId: string) => {
        if (expandedMatchId !== matchId) {
            setExpandedMatchId(matchId);
            setExpandLevel(1);
            return;
        }
        if (expandLevel === 1) {
            setExpandLevel(2);
            return;
        }
        setExpandedMatchId(null);
        setExpandLevel(1);
    }, [expandedMatchId, expandLevel]);

    // Modo flotante para el panel de partidos en vivo
    const [isFloating, setIsFloating] = React.useState(() => {
        const stored = localStorage.getItem('livePanel_floating');
        return stored === 'true';
    });
    const [floatingExpanded, setFloatingExpanded] = React.useState(false);
    const draggable = useDraggable({
        initialPosition: { x: 20, y: 100 },
        storageKey: 'livePanel_position',
        bounds: 'window',
    });

    React.useEffect(() => {
        localStorage.setItem('livePanel_floating', String(isFloating));
    }, [isFloating]);

    // Desactivar modo flotante en móvil automáticamente
    React.useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768 && isFloating) {
                setIsFloating(false);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [isFloating]);

    // Sincronizar floatingExpanded con expandedMatchId
    React.useEffect(() => {
        setFloatingExpanded(!!expandedMatchId);
    }, [expandedMatchId]);

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
        activeLeague?.distributions,
    ), [activeLeague]);

    const memberCount = activeLeague?.stats.memberCount ?? 0;
    const maxParticipants = activeLeague?.settings.maxParticipants ?? 0;
    const occupancyPct = maxParticipants > 0 ? Math.min(100, Math.round((memberCount / maxParticipants) * 100)) : 0;

    const buildLeagueLabel = useCallback((league: {
        name: string;
        code?: string;
        stats?: { memberCount?: number; points?: number };
    }) => {
        const suffix: string[] = [];
        if (league.code) suffix.push(`Código ${league.code}`);
        if (typeof league.stats?.memberCount === 'number') suffix.push(`${league.stats.memberCount} participantes`);
        if (typeof league.stats?.points === 'number' && league.stats.points > 0) suffix.push(`${league.stats.points} pts`);
        return suffix.length > 0 ? `${league.name} · ${suffix.join(' · ')}` : league.name;
    }, []);

    const buildLeagueMeta = useCallback((league?: {
        code?: string;
        stats?: { memberCount?: number; points?: number };
    } | null) => {
        if (!league) return [] as string[];
        const meta: string[] = [];
        if (league.code) meta.push(`Código ${league.code}`);
        if (typeof league.stats?.memberCount === 'number') meta.push(`${league.stats.memberCount} participantes`);
        if (typeof league.stats?.points === 'number' && league.stats.points > 0) meta.push(`${league.stats.points} pts`);
        return meta;
    }, []);

    const getQuickDraft = useCallback((match: MatchViewModel) => {
        const draft = quickPreds[match.id];
        return {
            home: draft?.home ?? match.prediction.home ?? '',
            away: draft?.away ?? match.prediction.away ?? '',
        };
    }, [quickPreds]);

    const handleDashboardRetry = useCallback(() => {
        void fetchDashboardData(true, activeLeague?.id ?? null);
    }, [activeLeague?.id, fetchDashboardData]);

    useEffect(() => {
        if (user) void fetchDashboardData(false, activeLeague?.id ?? null).catch(() => {});
    }, [activeLeague?.id, fetchDashboardData, user]);

    useEffect(() => {
        if (myLeagues.length > 0) return;
        void fetchMyLeagues().catch((e) => {
            setError(e instanceof Error ? e.message : 'No fue posible cargar tus ligas.');
        });
        void fetchPublicLeagues();
    }, [fetchMyLeagues, fetchPublicLeagues, myLeagues.length]);

    useEffect(() => {
        const interval = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
        return () => window.clearInterval(interval);
    }, []);

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

    useEffect(() => {
        if (liveMatches.length === 0 || !activeLeague?.id) { setLiveStandings(null); return; }
        void request<LiveStandingsData>(`/predictions/live-standings/${activeLeague.id}`)
            .then((data) => setLiveStandings(data))
            .catch(() => setLiveStandings(null));
    }, [liveMatches.length, activeLeague?.id]);

    const handleQuickSave = async (match: MatchViewModel) => {
        if (!activeLeague?.id) return;
        const pred = getQuickDraft(match);
        const home = parseInt(pred?.home ?? '0', 10);
        const away = parseInt(pred?.away ?? '0', 10);
        if (isNaN(home) || isNaN(away)) return;
        if (isPredictionWindowClosed(match.date, activeLeague?.settings?.closePredictionMinutes, currentTime)) {
            setError('La ventana para cambiar este pronóstico ya cerró.');
            return;
        }

        setSavingMatchId(match.id);
        try {
            await savePrediction(activeLeague.id, match.id, home, away);
            await fetchLeagueMatches(activeLeague.id);
            setQuickPreds((p) => { const n = { ...p }; delete n[match.id]; return n; });
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No fue posible guardar el pronóstico.');
        } finally {
            setSavingMatchId(null);
        }
    };

    /* ── Empty state ── */
    if (!isLoading && myLeagues.length === 0 && !error) {
        const featuredLeague = publicLeagues[0] ?? null;

        const handleJoinFeatured = async () => {
            if (!featuredLeague) return;
            setJoiningPublicId(featuredLeague.id);
            try {
                await joinLeague(featuredLeague.code);
                await fetchLeagueDetails(
                    useLeagueStore.getState().myLeagues[0]?.id ?? featuredLeague.id,
                );
                setActiveLeague(useLeagueStore.getState().myLeagues[0]?.id ?? featuredLeague.id);
                navigate('/predictions');
            } catch {
                setJoiningPublicId(null);
            }
        };

        return (
            <motion.div {...fade()} className="space-y-5">
                {/* Featured public league card */}
                {featuredLeague && (
                    <div className="rounded-[2rem] overflow-hidden bg-slate-900 text-white">
                        {/* Header banner */}
                        <div className="bg-gradient-to-r from-lime-500 to-lime-400 px-6 py-3 flex items-center gap-2">
                            <Star size={13} className="text-slate-900" />
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-900">Polla oficial del Mundial · Únete ahora</span>
                        </div>

                        <div className="p-6">
                            {/* Title */}
                            <div className="flex items-start gap-4 mb-5">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-lime-400/10 border border-lime-400/30 text-lime-400">
                                    <Globe2 size={26} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-tight text-white leading-tight">{featuredLeague.name}</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">FIFA World Cup 2026 · México, Canadá y EE.UU.</p>
                                </div>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-slate-300 leading-5 mb-5">
                                {featuredLeague.description ||
                                    'Participa en la polla oficial del Mundial 2026. Pronostica los resultados de los 104 partidos y compite en el ranking general.'}
                            </p>

                            {/* Info grid */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-1">Valor inscripción</p>
                                    <p className="text-base font-black text-lime-400 flex items-center gap-1.5">
                                        <Banknote size={15} />
                                        {featuredLeague.baseFee
                                            ? `$${featuredLeague.baseFee.toLocaleString('es-CO')} ${featuredLeague.currency ?? 'COP'}`
                                            : 'Gratuito'}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-1">Participantes</p>
                                    <p className="text-base font-black text-white flex items-center gap-1.5">
                                        <Users size={15} />
                                        {featuredLeague.memberCount}
                                        {featuredLeague.maxParticipants ? ` / ${featuredLeague.maxParticipants}` : ''}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-1">Torneo</p>
                                    <p className="text-sm font-bold text-white flex items-center gap-1.5">
                                        <Calendar size={13} />
                                        104 partidos
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-1">Tipo</p>
                                    <p className="text-sm font-bold text-white flex items-center gap-1.5">
                                        <BadgeCheck size={13} className="text-lime-400" />
                                        Liga pública
                                    </p>
                                </div>
                            </div>

                            {/* Highlights */}
                            <ul className="space-y-2 mb-6">
                                {[
                                    'Pronostica resultado y marcador exacto de cada partido',
                                    'Gana puntos por aciertos: marcador exacto = 3 pts, resultado = 1 pt',
                                    'Compite en el ranking general contra todos los participantes',
                                    featuredLeague.baseFee
                                        ? `Inscripción única de $${featuredLeague.baseFee.toLocaleString('es-CO')} ${featuredLeague.currency ?? 'COP'} para participar`
                                        : 'Participación completamente gratuita',
                                ].map((item) => (
                                    <li key={item} className="flex items-start gap-2 text-xs text-slate-300">
                                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-lime-400/20 text-lime-400 text-[9px] font-black">
                                            ✓
                                        </span>
                                        {item}
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            <button
                                onClick={handleJoinFeatured}
                                disabled={joiningPublicId === featuredLeague.id}
                                className="w-full rounded-2xl bg-lime-400 py-3.5 text-sm font-black uppercase tracking-wide text-slate-900 hover:bg-lime-300 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {joiningPublicId === featuredLeague.id
                                    ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" /> Uniéndome...</>
                                    : <><Trophy size={15} /> Quiero participar en la Polla Mundial 2026 <ArrowRight size={14} /></>
                                }
                            </button>
                        </div>
                    </div>
                )}

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

            <SpectatorBanner visible={spectatorMode} onExit={() => setSpectatorMode(false)} />

            <OnboardingBanner
                visible={isNewUser && onboardingVisible}
                onDismiss={() => {
                    setOnboardingVisible(false);
                    localStorage.setItem('onboarding_dismissed', '1');
                }}
            />

            <PushNotificationCard />

            <DashboardHeader
                activeLeague={activeLeague}
                myLeagues={myLeagues}
                isAdmin={isAdmin}
                isRealAdmin={isRealAdmin}
                spectatorMode={spectatorMode}
                userPlan={user?.plan}
                nextUnsaved={!!nextUnsaved}
                leagueDropOpen={leagueDropOpen}
                onLeagueDropToggle={() => setLeagueDropOpen((v) => !v)}
                onLeagueSelect={(id) => { setActiveLeague(id); setLeagueDropOpen(false); setSpectatorMode(false); }}
                onSpectatorToggle={() => setSpectatorMode((v) => !v)}
                onSpectatorExit={() => setSpectatorMode(false)}
                onInviteOpen={() => setInviteOpen(true)}
                onConfigOpen={() => setConfigOpen(true)}
                buildLeagueMeta={buildLeagueMeta}
                buildLeagueLabel={buildLeagueLabel}
            />

            {dashboardError && <ErrorBanner message={dashboardError} onRetry={handleDashboardRetry} dismissable />}
            {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {liveMatches.length > 0 && (
                <LiveMatchesPanel
                    liveMatches={liveMatches}
                    matchEvents={matchEvents}
                    eventsLoadingMatchIds={eventsLoadingMatchIds}
                    liveDisplay={liveDisplay}
                    goalSticker={goalSticker}
                    liveSync={liveSync}
                    liveStandings={liveStandings}
                    expandedMatchId={expandedMatchId}
                    expandLevel={expandLevel}
                    isFloating={isFloating}
                    floatingExpanded={floatingExpanded}
                    draggable={draggable}
                    onChipClick={handleChipClick}
                    onSetFloating={setIsFloating}
                    onSetFloatingExpanded={setFloatingExpanded}
                />
            )}

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">

                {/* ── Left column ── */}
                <div className="space-y-5">
                    <AnimatePresence mode="wait">
                        {spectatorMode ? (
                            <motion.div key="spectator-left" {...fade(0.05)} className="space-y-5">
                                <MyStatsCard
                                    totalPoints={myEntry?.points ?? 0}
                                    exactPredictions={myEntry?.exactCount ?? 0}
                                    correctResults={myEntry?.winnerCount ?? 0}
                                    streak={stats?.racha ?? null}
                                    rate={stats?.tasa ?? null}
                                    rank={myEntry?.rank ?? null}
                                    totalPredictions={predictions?.length ?? 0}
                                />
                            </motion.div>
                        ) : (
                            <motion.div key="admin-left" {...fade(0.05)} className="space-y-5">
                                <FinancialCard
                                    prizes={prizes}
                                    leagueStatus={activeLeague?.status}
                                    baseFee={activeLeague?.settings.baseFee}
                                    currency={activeLeague?.settings.currency}
                                    isAdmin={isAdmin}
                                />
                                <LeagueOccupancyCard
                                    memberCount={memberCount}
                                    maxParticipants={maxParticipants}
                                    occupancyPct={occupancyPct}
                                    isAdmin={isAdmin}
                                    hasCode={!!activeLeague?.code}
                                    onConfigOpen={() => setConfigOpen(true)}
                                    onInviteOpen={() => setInviteOpen(true)}
                                />
                                <ScoringRulesCard scoringRules={activeLeague?.scoringRules} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Center column ── */}
                <div className="space-y-5">
                    <PrizesCard prizes={prizes} />
                    {!spectatorMode && <PerformanceCard stats={stats} />}
                    <RecentPredictionsCard predictions={predictions} />
                </div>

                {/* ── Right column ── */}
                <div className="space-y-5">
                    <TopRankingCard topPlayers={topPlayers} prizes={prizes} />
                    <GoalToastContainer />
                    <UpcomingMatchesCard
                        upcomingMatches={upcomingMatches}
                        closePredictionMinutes={activeLeague?.settings?.closePredictionMinutes}
                        currentTime={currentTime}
                        quickPreds={quickPreds}
                        savingMatchId={savingMatchId}
                        isAdmin={isAdmin}
                        onDraftChange={(matchId, side, value) =>
                            setQuickPreds((prev) => ({
                                ...prev,
                                [matchId]: {
                                    home: side === 'home' ? value : (prev[matchId]?.home ?? ''),
                                    away: side === 'away' ? value : (prev[matchId]?.away ?? ''),
                                },
                            }))
                        }
                        onSave={(match) => void handleQuickSave(match)}
                        getQuickDraft={getQuickDraft}
                    />
                </div>
            </section>

            <InviteModal
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                code={activeLeague?.code}
                leagueName={activeLeague?.name}
            />

            <LeagueConfigModal
                open={configOpen}
                onClose={() => setConfigOpen(false)}
                leagueId={activeLeague?.id}
                memberCount={activeLeague?.stats?.memberCount}
                onSaved={() => { if (activeLeague?.id) void fetchLeagueDetails(activeLeague.id); }}
                onInvite={() => setInviteOpen(true)}
            />
        </div>
    );
};

export default Dashboard;
