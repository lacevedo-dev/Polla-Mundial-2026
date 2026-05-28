import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Trophy } from 'lucide-react';
import { request } from '../api';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore, type MatchViewModel } from '../stores/prediction.store';
import { useDashboardStore } from '../stores/dashboard.store';
import { useAuthStore } from '../stores/auth.store';
import { ErrorBanner } from '../components/dashboard/ErrorBanner';
import { useLiveSyncEvents } from '../hooks/useLiveSyncEvents';
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

const ADMIN_COMMISSION = 0.1;

/* ─── Dashboard ────────────────────────────────────────────────── */

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
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
    const [onboardingVisible, setOnboardingVisible] = useState(
        () => localStorage.getItem('onboarding_dismissed') !== '1',
    );
    const [inviteOpen, setInviteOpen] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const [spectatorMode, setSpectatorMode] = useState(false);
    const [leagueDropOpen, setLeagueDropOpen] = useState(false);
    const [quickPreds, setQuickPreds] = useState<Record<string, { home: string; away: string }>>({});
    const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
    const [scoringTab, setScoringTab] = useState<'resultado' | 'bonos' | 'desempate'>('resultado');
    const [currentTime, setCurrentTime] = useState(() => Date.now());

    interface MatchEventItem { type: string; detail: string | null; playerName: string | null; assistName: string | null; minute: number; extraMin: number | null; }
    interface LiveStandingsData { hasLive: boolean; myProvisionalPosition: number | null; myPositionChange: number; myLivePoints: number; liveMatchCount: number; }

    const [matchEvents, setMatchEvents] = useState<Map<string, MatchEventItem[]>>(new Map());
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
    const upcomingMatches = useMemo(() => matches.filter((m) => m.status === 'open').slice(0, 3), [matches]);
    const nextUnsaved = useMemo(() => matches.find((m) => m.status === 'open' && !m.saved), [matches]);
    const liveSync = useLiveSyncEvents();

    const topPlayers = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);

    // Partido expandido en el panel de chips en vivo (3 estados: null → 1 → 2 → null)
    const [expandedMatchId, setExpandedMatchId] = React.useState<string | null>(null);
    const [expandLevel, setExpandLevel] = React.useState<1 | 2>(1);
    React.useEffect(() => {
        if (liveMatches.length === 0) { setExpandedMatchId(null); setExpandLevel(1); }
    }, [liveMatches]);

    const handleChipClick = React.useCallback((matchId: string) => {
        setExpandedMatchId(prev => {
            if (prev !== matchId) {
                setExpandLevel(1);
                return matchId;
            }
            // Si ya está expandido, colapsarlo
            setExpandLevel(1);
            return null;
        });
    }, []);

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
    }, [fetchMyLeagues, myLeagues.length]);

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

    // Load events for all live matches on mount and whenever liveMatches changes
    useEffect(() => {
        if (liveMatches.length === 0) return;
        void Promise.all(
            liveMatches.map((m) =>
                request<MatchEventItem[]>(`/matches/${m.id}/events`)
                    .then((events) => ({ id: m.id, events }))
                    .catch(() => ({ id: m.id, events: [] as MatchEventItem[] })),
            ),
        ).then((results) => {
            setMatchEvents((prev) => {
                const next = new Map(prev);
                results.forEach((r) => next.set(r.id, r.events));
                return next;
            });
        });
    }, [liveMatches]);

    // Refresh events for all live matches whenever SSE fires match_updated events
    useEffect(() => {
        if (liveSync.matchesUpdatedCount === 0 || liveMatches.length === 0) return;
        void Promise.all(
            liveMatches.map((m) =>
                request<MatchEventItem[]>(`/matches/${m.id}/events`)
                    .then((events) => ({ id: m.id, events }))
                    .catch(() => ({ id: m.id, events: [] as MatchEventItem[] })),
            ),
        ).then((results) => {
            setMatchEvents((prev) => {
                const next = new Map(prev);
                results.forEach((r) => next.set(r.id, r.events));
                return next;
            });
        });
    }, [liveSync.matchesUpdatedCount, liveMatches]);

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
                    liveSync={liveSync}
                    liveStandings={liveStandings}
                    expandedMatchId={expandedMatchId}
                    expandLevel={expandLevel}
                    isFloating={isFloating}
                    floatingExpanded={floatingExpanded}
                    draggable={draggable}
                    onChipClick={handleChipClick}
                    onFloatingToggle={() => setIsFloating((v) => !v)}
                    onFloatingExpandedToggle={() => setFloatingExpanded((v) => !v)}
                />
            )}

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">

                {/* ── Left column ── */}
                <div className="space-y-5">
                    <AnimatePresence mode="wait">
                        {spectatorMode ? (
                            <motion.div key="spectator-left" {...fade(0.05)} className="space-y-5">
                                <MyStatsCard
                                    myEntry={myEntry ?? null}
                                    stats={stats}
                                    lastHit={lastHit ?? null}
                                    nextUnsaved={nextUnsaved ?? null}
                                />
                            </motion.div>
                        ) : (
                            <motion.div key="admin-left" {...fade(0.05)} className="space-y-5">
                                <FinancialCard
                                    prizes={prizes}
                                    activeLeague={activeLeague}
                                    isAdmin={isAdmin}
                                    adminCommission={ADMIN_COMMISSION}
                                />
                                <LeagueOccupancyCard
                                    memberCount={memberCount}
                                    maxParticipants={maxParticipants}
                                    leagueCode={activeLeague?.code}
                                    isAdmin={isAdmin}
                                    onConfigOpen={() => setConfigOpen(true)}
                                    onInviteOpen={() => setInviteOpen(true)}
                                />
                                <ScoringRulesCard
                                    activeTab={scoringTab}
                                    onTabChange={setScoringTab}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Center column ── */}
                <div className="space-y-5">
                    <PrizesCard prizes={prizes} activeLeague={activeLeague} />
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
