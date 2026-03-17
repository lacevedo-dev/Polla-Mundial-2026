
import React from 'react';
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    BarChart3,
    Brain,
    Calendar,
    CheckCircle2,
    Clock,
    ChevronRight,
    Globe,
    GitMerge,
    LayoutGrid,
    Lock,
    Medal,
    Save,
    Search,
    Shield,
    Sparkles,
    Ticket,
    Trophy,
    User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore, type MatchViewModel } from '../stores/prediction.store';
import { useConfigStore } from '../stores/config.store';
import { useAuthStore } from '../stores/auth.store';

type DraftMap = Record<string, { home: string; away: string }>;
type PhaseFilter = 'ALL' | 'GROUP' | 'KNOCKOUT';

interface SimulatorTeam {
    id: string;
    name: string;
    iso: string;
}

interface SimulatorGroup {
    name: string;
    teams: SimulatorTeam[];
}

const INITIAL_GROUPS: SimulatorGroup[] = [
    {
        name: 'Grupo A',
        teams: [
            { id: 'mx', name: 'México', iso: 'mx' },
            { id: 'za', name: 'Sudáfrica', iso: 'za' },
            { id: 'kr', name: 'Corea Sur', iso: 'kr' },
            { id: 'dk', name: 'Dinamarca', iso: 'dk' },
        ],
    },
    {
        name: 'Grupo B',
        teams: [
            { id: 'fr', name: 'Francia', iso: 'fr' },
            { id: 'ca', name: 'Canadá', iso: 'ca' },
            { id: 'ng', name: 'Nigeria', iso: 'ng' },
            { id: 'jp', name: 'Japón', iso: 'jp' },
        ],
    },
    {
        name: 'Grupo C',
        teams: [
            { id: 'us', name: 'USA', iso: 'us' },
            { id: 'gb-eng', name: 'Inglaterra', iso: 'gb-eng' },
            { id: 'ir', name: 'Irán', iso: 'ir' },
            { id: 'cl', name: 'Chile', iso: 'cl' },
        ],
    },
    {
        name: 'Grupo D',
        teams: [
            { id: 'br', name: 'Brasil', iso: 'br' },
            { id: 'co', name: 'Colombia', iso: 'co' },
            { id: 'pl', name: 'Polonia', iso: 'pl' },
            { id: 'sa', name: 'Arabia S.', iso: 'sa' },
        ],
    },
];

const MOCK_STANDINGS = [
    { pos: 1, team: 'México', iso: 'mx', pj: 2, dg: 4, pts: 6 },
    { pos: 2, team: 'Dinamarca', iso: 'dk', pj: 2, dg: 2, pts: 4 },
    { pos: 3, team: 'Corea del Sur', iso: 'kr', pj: 2, dg: -2, pts: 1 },
    { pos: 4, team: 'Sudáfrica', iso: 'za', pj: 2, dg: -4, pts: 0 },
];

function buildDrafts(matches: MatchViewModel[]): DraftMap {
    return Object.fromEntries(
        matches.map((match) => [
            match.id,
            {
                home: match.prediction.home,
                away: match.prediction.away,
            },
        ]),
    );
}

function normalizePhase(phase?: string | null): 'GROUP' | 'KNOCKOUT' {
    return phase?.toUpperCase() === 'GROUP' ? 'GROUP' : 'KNOCKOUT';
}

function toDisplayPhase(phase?: string | null): string {
    return normalizePhase(phase) === 'GROUP' ? 'Fase de grupos' : 'Eliminatorias';
}

function summarizeCloseTime(matchDate: string): string {
    const diffMs = new Date(matchDate).getTime() - Date.now();
    if (!Number.isFinite(diffMs) || diffMs <= 0) {
        return 'Cerrado';
    }

    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const totalDays = Math.floor(totalHours / 24);

    if (totalDays > 0) {
        return totalDays === 1 ? '1 día' : `${totalDays} días`;
    }

    if (totalHours > 0) {
        return `${totalHours}h`;
    }

    const totalMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${totalMinutes}m`;
}

// Smart Insights credit caps — fallback values used before config loads from /config/plans.
// The admin configures actual values via the Admin Panel → Planes.
const SI_PLAN_CREDITS_FALLBACK: Record<string, number> = {
    FREE: 3,
    GOLD: 30,
    DIAMOND: 100,
};

function getSiCreditKey(plan: string): string {
    return `polla_si_credits_${plan.toUpperCase()}`;
}

function getSiCredits(plan: string, cap: number): number {
    try {
        const stored = localStorage.getItem(getSiCreditKey(plan));
        if (stored === null) return cap;
        try {
            const parsed = JSON.parse(stored) as { credits: number; cap: number };
            if (parsed && typeof parsed === 'object' && 'cap' in parsed) {
                // If admin changed the cap, reset credits to the new cap
                if (parsed.cap !== cap) return cap;
                return Number.isNaN(parsed.credits) ? cap : Math.max(0, parsed.credits);
            }
        } catch { /* fall through to legacy parse */ }
        // Legacy: plain number stored
        const n = Number.parseInt(stored, 10);
        return Number.isNaN(n) ? cap : Math.max(0, n);
    } catch {
        return cap;
    }
}

function consumeSiCredit(plan: string, cap: number): number {
    try {
        const next = Math.max(0, getSiCredits(plan, cap) - 1);
        localStorage.setItem(getSiCreditKey(plan), JSON.stringify({ credits: next, cap, storedAt: new Date().toISOString() }));
        return next;
    } catch {
        return 0;
    }
}

function clearSiCreditsIfReset(plan: string, resetAt: string | null): void {
    if (!resetAt) return;
    try {
        const stored = localStorage.getItem(getSiCreditKey(plan));
        if (!stored) return;
        const parsed = JSON.parse(stored) as { storedAt?: string };
        const storedAt = parsed.storedAt ?? '1970-01-01T00:00:00.000Z';
        if (resetAt > storedAt) {
            localStorage.removeItem(getSiCreditKey(plan));
        }
    } catch { /* ignore */ }
}

// Session-level cache for AI insights — avoids re-fetching and re-consuming credits
// when the user closes and reopens the panel for the same match within the same tab.
function getInsightsCacheKey(matchId: string): string {
    return `polla_insights_v3_${matchId}`;
}

function getCachedInsights(matchId: string): object | null {
    try {
        const raw = sessionStorage.getItem(getInsightsCacheKey(matchId));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function setCachedInsights(matchId: string, data: object): void {
    try {
        sessionStorage.setItem(getInsightsCacheKey(matchId), JSON.stringify(data));
    } catch {}
}

function simpleHash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function generateMatchInsights(match: MatchViewModel) {
    const h = simpleHash(match.id || match.homeTeam + match.awayTeam);
    const homeWin = 30 + (h % 26);
    const draw = 15 + ((h >> 4) % 16);
    const awayWin = Math.max(5, 100 - homeWin - draw);
    const picks = ['W', 'D', 'L'] as const;
    const homeForm = Array.from({ length: 5 }, (_, i) => picks[(h >> i) % 3]);
    const awayForm = Array.from({ length: 5 }, (_, i) => picks[(h >> (i + 5)) % 3]);
    const scores = [
        `${(h >> 1) % 3}-${(h >> 2) % 2}`,
        '1-1',
        `${(h >> 3) % 2}-${((h >> 4) % 3) + 1}`,
    ];
    const smartPick =
        homeWin > awayWin + 10 ? match.homeTeam : awayWin > homeWin + 10 ? match.awayTeam : 'Empate';
    return { homeWin, draw, awayWin, homeForm, awayForm, scores, smartPick };
}

function formatFriendlyDate(isoDate: string): string {
    const date = new Date(isoDate + 'T12:00:00Z');
    if (Number.isNaN(date.getTime())) return isoDate;
    const parts = new Intl.DateTimeFormat('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
    }).formatToParts(date);
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    return `${weekday} ${day} ${month}`.toUpperCase();
}

function formatMatchTime(matchDate: string): string {
    const date = new Date(matchDate);
    if (Number.isNaN(date.getTime())) {
        return '--:--';
    }

    return new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
}

function getLeaguePlanBadge(plan?: string | null): string {
    const normalized = plan?.toUpperCase();
    if (normalized === 'DIAMOND') return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    if (normalized === 'GOLD') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
}

function getStatusBadge(status: MatchViewModel['status']) {
    switch (status) {
        case 'finished':
            return 'bg-slate-900 text-white';
        case 'live':
            return 'bg-rose-100 text-rose-700';
        case 'closed':
            return 'bg-slate-200 text-slate-600';
        default:
            return 'bg-lime-100 text-lime-700';
    }
}

const Predictions: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const activeLeague = useLeagueStore((state) => state.activeLeague);
    const myLeagues = useLeagueStore((state) => state.myLeagues);
    const fetchMyLeagues = useLeagueStore((state) => state.fetchMyLeagues);
    const setActiveLeague = useLeagueStore((state) => state.setActiveLeague);
    const matches = usePredictionStore((state) => state.matches);
    const isLoading = usePredictionStore((state) => state.isLoading);
    const fetchLeagueMatches = usePredictionStore((state) => state.fetchLeagueMatches);
    const savePrediction = usePredictionStore((state) => state.savePrediction);
    const resetLeagueData = usePredictionStore((state) => state.resetLeagueData);
    const getRemoteSiCredits = useConfigStore((state) => state.getSiCredits);
    const creditsResetAt = useConfigStore((state) => state.creditsResetAt);

    const [drafts, setDrafts] = React.useState<DraftMap>({});
    const [searchTerm, setSearchTerm] = React.useState('');
    const [phaseFilter, setPhaseFilter] = React.useState<PhaseFilter>('ALL');
    const [error, setError] = React.useState<string | null>(null);
    const [savingMatchId, setSavingMatchId] = React.useState<string | null>(null);
    const [analysisMatchId, setAnalysisMatchId] = React.useState<string | null>(null);
    const [insightsLocked, setInsightsLocked] = React.useState(false);
    const [insightsLoading, setInsightsLoading] = React.useState(false);
    const [insightsData, setInsightsData] = React.useState<Record<string, object>>({});
    // Plan for credits: user's own subscription plan takes priority over league plan
    const resolvedPlan = React.useMemo(() =>
        (user?.plan ?? activeLeague?.settings?.plan ?? 'FREE').toUpperCase(),
    [user?.plan, activeLeague?.settings?.plan]);

    const [siCredits, setSiCredits] = React.useState<number>(() => {
        const plan = (user?.plan ?? activeLeague?.settings?.plan ?? 'FREE').toUpperCase();
        const cap = SI_PLAN_CREDITS_FALLBACK[plan] ?? SI_PLAN_CREDITS_FALLBACK['FREE'];
        return getSiCredits(plan, cap);
    });
    const [predictionMode, setPredictionMode] = React.useState<'matches' | 'simulator'>('matches');
    const [simulatorTab, setSimulatorTab] = React.useState<'groups' | 'bracket'>('groups');
    const [activeGroup, setActiveGroup] = React.useState<string>('ALL');
    const [activeGroupModal, setActiveGroupModal] = React.useState<string | null>(null);
    const [groups, setGroups] = React.useState<SimulatorGroup[]>(INITIAL_GROUPS);

    React.useEffect(() => {
        if (myLeagues.length > 0) {
            return;
        }

        void fetchMyLeagues().catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible cargar tus ligas.');
        });
    }, [fetchMyLeagues, myLeagues.length]);

    React.useEffect(() => {
        if (!activeLeague?.id) {
            resetLeagueData();
            setDrafts({});
            return;
        }

        setError(null);
        void fetchLeagueMatches(activeLeague.id).catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible cargar los partidos.');
        });
    }, [activeLeague?.id, fetchLeagueMatches, resetLeagueData]);

    React.useEffect(() => {
        setDrafts(buildDrafts(matches));
    }, [matches]);

    // Sync credits when user plan, active league, remote config, or global reset changes
    React.useEffect(() => {
        clearSiCreditsIfReset(resolvedPlan, creditsResetAt);
        const cap = getRemoteSiCredits(resolvedPlan);
        setSiCredits(getSiCredits(resolvedPlan, cap));
        setAnalysisMatchId(null);
        setInsightsLocked(false);
    }, [resolvedPlan, getRemoteSiCredits, creditsResetAt]);

    const filteredMatches = React.useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return matches.filter((match) => {
            const matchesPhase = phaseFilter === 'ALL' || normalizePhase(match.phase) === phaseFilter;
            const matchesGroup =
                phaseFilter !== 'GROUP' || activeGroup === 'ALL' || match.group === activeGroup;
            const haystack = `${match.homeTeam} ${match.awayTeam} ${match.venue}`.toLowerCase();
            const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
            return matchesPhase && matchesGroup && matchesSearch;
        });
    }, [matches, phaseFilter, activeGroup, searchTerm]);

    const groupedMatches = React.useMemo(() => {
        return filteredMatches.reduce<Record<string, MatchViewModel[]>>((acc, match) => {
            const bucket = match.displayDate || 'Sin fecha';
            acc[bucket] = acc[bucket] || [];
            acc[bucket].push(match);
            return acc;
        }, {});
    }, [filteredMatches]);

    const nextMatchId = React.useMemo(() => {
        const openMatch = matches
            .filter((match) => match.status === 'open' || match.status === 'live')
            .sort((left, right) => left.date.localeCompare(right.date))[0];
        return openMatch?.id ?? null;
    }, [matches]);

    const savedCount = React.useMemo(() => matches.filter((match) => match.saved).length, [matches]);
    const openCount = React.useMemo(
        () => matches.filter((match) => match.status === 'open' || match.status === 'live').length,
        [matches],
    );

    const availableGroups = React.useMemo(() => {
        const groupSet = new Set<string>();
        matches.forEach((match) => {
            if (match.group) {
                groupSet.add(match.group);
            }
        });

        return [...groupSet].sort();
    }, [matches]);

    const qualifiedTeams = React.useMemo(() => {
        const teams: Record<string, SimulatorTeam> = {};
        groups.forEach((group, index) => {
            const letter = String.fromCharCode(65 + index);
            teams[`1${letter}`] = group.teams[0];
            teams[`2${letter}`] = group.teams[1];
        });
        return teams;
    }, [groups]);

    const roundOf16Matchups = [
        { id: 'R16-1', team1: '1A', team2: '2B' },
        { id: 'R16-2', team1: '1C', team2: '2D' },
        { id: 'R16-3', team1: '1B', team2: '2A' },
        { id: 'R16-4', team1: '1D', team2: '2C' },
    ];

    const handleDraftChange = (matchId: string, field: 'home' | 'away', value: string) => {
        if (value && !/^\d+$/.test(value)) {
            return;
        }

        if (value.length > 2) {
            return;
        }

        setDrafts((currentDrafts) => ({
            ...currentDrafts,
            [matchId]: {
                home: currentDrafts[matchId]?.home ?? '',
                away: currentDrafts[matchId]?.away ?? '',
                [field]: value,
            },
        }));
    };

    const handleSave = async (matchId: string) => {
        if (!activeLeague?.id) {
            return;
        }

        const nextDraft = drafts[matchId];
        if (!nextDraft || nextDraft.home === '' || nextDraft.away === '') {
            setError('Debes ingresar ambos marcadores antes de guardar el pronóstico.');
            return;
        }

        setSavingMatchId(matchId);
        setError(null);

        try {
            await savePrediction(
                activeLeague.id,
                matchId,
                Number.parseInt(nextDraft.home, 10),
                Number.parseInt(nextDraft.away, 10),
            );
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible guardar el pronóstico.');
        } finally {
            setSavingMatchId(null);
        }
    };

    const handleTeamMove = (groupIndex: number, teamIndex: number, direction: 'up' | 'down') => {
        setGroups((previous) => {
            const nextGroups = structuredClone(previous);
            const nextGroup = nextGroups[groupIndex];

            if (direction === 'up' && teamIndex > 0) {
                [nextGroup.teams[teamIndex], nextGroup.teams[teamIndex - 1]] = [
                    nextGroup.teams[teamIndex - 1],
                    nextGroup.teams[teamIndex],
                ];
            }

            if (direction === 'down' && teamIndex < nextGroup.teams.length - 1) {
                [nextGroup.teams[teamIndex], nextGroup.teams[teamIndex + 1]] = [
                    nextGroup.teams[teamIndex + 1],
                    nextGroup.teams[teamIndex],
                ];
            }

            return nextGroups;
        });
    };

    return (
        <>
        <div className="space-y-6 pb-16">
            <header className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-lime-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-lime-700">
                                Predicciones
                            </span>
                            {activeLeague?.settings?.plan ? (
                                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getLeaguePlanBadge(activeLeague?.settings?.plan)}`}>
                                    Plan {activeLeague?.settings?.plan}
                                </span>
                            ) : null}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black font-brand uppercase tracking-tight text-slate-900 sm:text-3xl">
                                Pronostica tus partidos
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm text-slate-500">
                                Alineamos esta vista al flujo anterior: ligas activas, acceso rápido a pronósticos y una lista más compacta para pantalla.
                            </p>
                        </div>
                        {activeLeague ? (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                                <span className="rounded-full bg-slate-100 px-3 py-1">{activeLeague.name}</span>
                                <span className="rounded-full bg-slate-100 px-3 py-1">
                                    {activeLeague.role === 'ADMIN' ? 'Administrador' : 'Participante'}
                                </span>
                                {activeLeague?.stats?.memberCount ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1">{activeLeague?.stats?.memberCount} jugadores</span>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[430px]">
                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Ligas</p>
                            <p className="mt-2 text-2xl font-black text-slate-900">{myLeagues.length}</p>
                        </div>
                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Partidos</p>
                            <p className="mt-2 text-2xl font-black text-slate-900">{matches.length}</p>
                        </div>
                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Guardados</p>
                            <p className="mt-2 text-2xl font-black text-lime-600">{savedCount}</p>
                        </div>
                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Abiertos</p>
                            <p className="mt-2 text-2xl font-black text-amber-600">{openCount}</p>
                        </div>
                    </div>
                </div>
            </header>
            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
                <article className="rounded-[2rem] bg-white p-5 shadow-sm lg:col-span-1">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mis pollas</p>
                            <h2 className="mt-1 text-lg font-black uppercase text-slate-900">Ligas activas</h2>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {myLeagues.length > 0 ? (
                            myLeagues.map((league) => {
                                const isActive = activeLeague?.id === league.id;
                                return (
                                    <button
                                        key={league.id}
                                        onClick={() => setActiveLeague(league.id)}
                                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
                                            isActive
                                                ? 'border-lime-400 bg-lime-50/60'
                                                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black uppercase text-slate-900">{league.name}</p>
                                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                {league.role === 'ADMIN' ? 'ADMIN' : 'JUGADOR'}
                                            </p>
                                        </div>
                                        <div className="ml-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                                            {league.role === 'ADMIN' ? <Shield className="h-4 w-4 text-lime-400" /> : <User className="h-4 w-4" />}
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                                No tienes ligas activas todavía.
                            </div>
                        )}
                    </div>
                </article>

                <article className="rounded-[2rem] bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3 text-slate-900">
                        <Ticket className="h-5 w-5 text-lime-700" />
                        <h2 className="text-sm font-black uppercase tracking-[0.2em]">Invitaciones</h2>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                        El flujo visual se conserva, pero el backend de invitaciones sigue pendiente para esta fase.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Slice pendiente
                    </div>
                </article>

                <article className="rounded-[2rem] bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3 text-slate-900">
                        <Globe className="h-5 w-5 text-lime-700" />
                        <h2 className="text-sm font-black uppercase tracking-[0.2em]">Ligas públicas</h2>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                        La exploración pública se deja visible como referencia del diseño anterior, sin depender de APIs inexistentes.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Próximamente
                    </div>
                </article>

                <article className="rounded-[2rem] bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3 text-slate-900">
                        <Sparkles className="h-5 w-5 text-lime-700" />
                        <h2 className="text-sm font-black uppercase tracking-[0.2em]">Simulador</h2>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                        El modo simulador queda reservado hasta que tenga contrato backend propio y persistencia real.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        <Lock className="h-3.5 w-3.5" /> Deshabilitado
                    </div>
                </article>
            </section>

            {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            <section className="space-y-4 rounded-[2rem] bg-white p-4 shadow-sm sm:p-5 lg:p-6">
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Partidos disponibles</p>
                                <h2 className="mt-1 text-xl font-black uppercase text-slate-900">Panel de pronósticos</h2>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setPredictionMode('matches')}
                                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
                                        predictionMode === 'matches'
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    <LayoutGrid className="h-3.5 w-3.5" /> Partidos
                                </button>
                                <button
                                    onClick={() => setPredictionMode('simulator')}
                                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
                                        predictionMode === 'simulator'
                                            ? 'bg-lime-400 text-slate-900 shadow-sm'
                                            : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    <GitMerge className="h-3.5 w-3.5" /> Simulador
                                </button>
                            </div>
                        </div>

                        {predictionMode === 'matches' ? (
                            <label className="relative block w-full lg:max-w-sm">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                                <input
                                    type="search"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Buscar por equipo o sede"
                                    className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none"
                                />
                            </label>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSimulatorTab('groups')}
                                    className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                                        simulatorTab === 'groups'
                                            ? 'border-slate-900 bg-slate-900 text-white'
                                            : 'border-slate-200 bg-white text-slate-500'
                                    }`}
                                >
                                    Fase de grupos
                                </button>
                                <button
                                    onClick={() => setSimulatorTab('bracket')}
                                    className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                                        simulatorTab === 'bracket'
                                            ? 'border-slate-900 bg-slate-900 text-white'
                                            : 'border-slate-200 bg-white text-slate-500'
                                    }`}
                                >
                                    Eliminatorias
                                </button>
                            </div>
                        )}
                    </div>

                    {predictionMode === 'matches' ? (
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2">
                                {([
                                    { id: 'ALL', label: 'Todos', icon: LayoutGrid },
                                    { id: 'GROUP', label: 'Grupos', icon: Trophy },
                                    { id: 'KNOCKOUT', label: 'Fases', icon: Brain },
                                ] as const).map((phase) => (
                                    <button
                                        key={phase.id}
                                        onClick={() => setPhaseFilter(phase.id)}
                                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
                                            phaseFilter === phase.id
                                                ? 'bg-slate-900 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        <phase.icon className="h-3.5 w-3.5" /> {phase.label}
                                    </button>
                                ))}
                            </div>

                            {phaseFilter === 'GROUP' && availableGroups.length > 0 ? (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    <button
                                        onClick={() => setActiveGroup('ALL')}
                                        className={`min-w-[72px] rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                                            activeGroup === 'ALL'
                                                ? 'border-slate-900 bg-slate-900 text-white'
                                                : 'border-slate-200 bg-white text-slate-500'
                                        }`}
                                    >
                                        General
                                    </button>
                                    {availableGroups.map((group) => (
                                        <button
                                            key={group}
                                            onClick={() => setActiveGroup(group)}
                                            className={`min-w-[44px] rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                                                activeGroup === group
                                                    ? 'border-lime-400 bg-lime-400 text-slate-900'
                                                    : 'border-slate-200 bg-white text-slate-500'
                                            }`}
                                        >
                                            {group}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                {!activeLeague && !isLoading ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                        Selecciona o crea una liga para comenzar a pronosticar.
                    </div>
                ) : null}

                {activeLeague && filteredMatches.length === 0 && !isLoading ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                        No encontramos partidos con los filtros actuales.
                    </div>
                ) : null}

                {predictionMode === 'matches' ? (
                <div className="space-y-4">
                    {Object.entries(groupedMatches).map(([date, dateMatches]) => (
                        <article key={date} className="overflow-hidden rounded-[1.75rem] border border-slate-200">
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">{formatFriendlyDate(date)}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {phaseFilter === 'GROUP' && dateMatches.find((match) => match.group)?.group ? (
                                        <button
                                            onClick={() => setActiveGroupModal(dateMatches.find((match) => match.group)?.group ?? null)}
                                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-lime-700 hover:bg-lime-50"
                                        >
                                            Ver grupo <ChevronRight className="h-3 w-3" />
                                        </button>
                                    ) : null}
                                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                        {dateMatches.length} partidos
                                    </span>
                                </div>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {dateMatches.map((match) => {
                                    const draft = drafts[match.id] ?? { home: '', away: '' };
                                    const isSaving = savingMatchId === match.id;
                                    const isAnalysisOpen = analysisMatchId === match.id;
                                    const isNext = nextMatchId === match.id;

                                    return (
                                        <div
                                            key={match.id}
                                            className={`border-l-4 px-3 py-3 transition-colors sm:px-4 ${
                                                isNext ? 'border-l-lime-400 bg-lime-50/40' : 'border-l-transparent hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                                                <div className="flex items-center gap-3 xl:w-[110px] xl:shrink-0">
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900">{formatMatchTime(match.date)}</p>
                                                        <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-600">
                                                            {summarizeCloseTime(match.date)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-4">
                                                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                                                        <span className="truncate text-right text-xs font-black uppercase text-slate-900 sm:text-sm">
                                                            {match.homeTeam}
                                                        </span>
                                                        <img
                                                            src={match.homeFlag}
                                                            alt={match.homeTeam}
                                                            className="h-6 w-8 rounded-md border border-slate-200 object-cover shadow-sm sm:h-7 sm:w-10"
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        <input
                                                            aria-label={`Marcador ${match.homeTeam}`}
                                                            inputMode="numeric"
                                                            value={draft.home}
                                                            onChange={(event) => handleDraftChange(match.id, 'home', event.target.value)}
                                                            className="h-10 w-10 rounded-xl border-2 border-slate-200 bg-slate-50 text-center text-lg font-black text-slate-900 outline-none focus:border-lime-500 focus:bg-white"
                                                        />
                                                        <span className="text-sm font-black text-slate-300">:</span>
                                                        <input
                                                            aria-label={`Marcador ${match.awayTeam}`}
                                                            inputMode="numeric"
                                                            value={draft.away}
                                                            onChange={(event) => handleDraftChange(match.id, 'away', event.target.value)}
                                                            className="h-10 w-10 rounded-xl border-2 border-slate-200 bg-slate-50 text-center text-lg font-black text-slate-900 outline-none focus:border-lime-500 focus:bg-white"
                                                        />
                                                    </div>

                                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                                        <img
                                                            src={match.awayFlag}
                                                            alt={match.awayTeam}
                                                            className="h-6 w-8 rounded-md border border-slate-200 object-cover shadow-sm sm:h-7 sm:w-10"
                                                        />
                                                        <span className="truncate text-left text-xs font-black uppercase text-slate-900 sm:text-sm">
                                                            {match.awayTeam}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-2 xl:w-[220px] xl:justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            if (isAnalysisOpen) {
                                                                setAnalysisMatchId(null);
                                                                setInsightsLocked(false);
                                                                return;
                                                            }

                                                            const leaguePlan = resolvedPlan;
                                                            const cap = getRemoteSiCredits(leaguePlan);

                                                            // Check sessionStorage cache first — no credit consumed
                                                            const cached = getCachedInsights(match.id) ?? insightsData[match.id];
                                                            if (cached) {
                                                                setAnalysisMatchId(match.id);
                                                                setInsightsLocked(false);
                                                                return;
                                                            }

                                                            // No cache → check credits
                                                            if (siCredits === 0) {
                                                                setInsightsLocked(true);
                                                                setAnalysisMatchId(match.id);
                                                                return;
                                                            }

                                                            // Consume credit and fetch from AI
                                                            setInsightsLocked(false);
                                                            setAnalysisMatchId(match.id);
                                                            setInsightsLoading(true);
                                                            try {
                                                                const { request: apiRequest } = await import('../api');
                                                                const result = await apiRequest<object>(
                                                                    `/insights/match/${match.id}`,
                                                                    {
                                                                        method: 'POST',
                                                                        body: JSON.stringify({
                                                                            homeTeam: match.homeTeam,
                                                                            awayTeam: match.awayTeam,
                                                                            phase: match.phase,
                                                                            group: match.group,
                                                                        }),
                                                                    },
                                                                );
                                                                setCachedInsights(match.id, result);
                                                                setInsightsData((prev) => ({ ...prev, [match.id]: result }));
                                                                setSiCredits(consumeSiCredit(leaguePlan, cap));
                                                            } catch {
                                                                // Fall back to deterministic generation
                                                                const fallback = generateMatchInsights(match);
                                                                setCachedInsights(match.id, fallback);
                                                                setInsightsData((prev) => ({ ...prev, [match.id]: fallback }));
                                                                setSiCredits(consumeSiCredit(leaguePlan, cap));
                                                            } finally {
                                                                setInsightsLoading(false);
                                                            }
                                                        }}
                                                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                                                            isAnalysisOpen
                                                                ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200'
                                                                : 'bg-slate-100 text-slate-500 hover:bg-purple-50 hover:text-purple-700'
                                                        }`}
                                                    >
                                                        <Brain className="h-4 w-4" />
                                                    </button>

                                                    <button
                                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                                                        disabled={isSaving}
                                                        onClick={() => handleSave(match.id)}
                                                    >
                                                        {match.saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                                                        {isSaving ? 'Guardando' : match.saved ? 'Actualizar' : 'Guardar'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-[10px] font-medium text-slate-400">
                                                    {toDisplayPhase(match.phase)}
                                                    {match.group ? ` • Grupo ${match.group}` : ''}
                                                    {' • '}
                                                    {match.venue}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                                                    <span className={`rounded-full px-2.5 py-1 ${getStatusBadge(match.status)}`}>
                                                        {match.status}
                                                    </span>
                                                    {match.saved ? (
                                                        <span className="rounded-full bg-lime-100 px-2.5 py-1 text-lime-700">
                                                            Guardado {match.prediction.home}-{match.prediction.away}
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                                                            Pendiente
                                                        </span>
                                                    )}
                                                    {typeof match.pointsEarned === 'number' ? (
                                                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">
                                                            {match.pointsEarned} pts
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {isAnalysisOpen ? (() => {
                                                const leaguePlan = resolvedPlan;
                                                const planCap = getRemoteSiCredits(leaguePlan);
                                                const cachedData = insightsData[match.id] ?? getCachedInsights(match.id) ?? null;

                                                // Lock screen — credits exhausted
                                                if (insightsLocked) {
                                                    const lockMessages: Record<string, { title: string; body: string; cta: string; ctaPlan: 'gold' | 'diamond' | null; sub: string }> = {
                                                        FREE: {
                                                            title: 'Has agotado tus créditos de prueba',
                                                            body: 'Mejora tu polla a plan GOLD o DIAMOND para más análisis IA.',
                                                            cta: 'Ver planes disponibles',
                                                            ctaPlan: 'gold',
                                                            sub: 'Plan GOLD · 30 análisis · Plan DIAMOND · 100 análisis',
                                                        },
                                                        GOLD: {
                                                            title: `Usaste los ${planCap} análisis de tu plan`,
                                                            body: 'Actualiza a DIAMOND para triplicar tus análisis disponibles.',
                                                            cta: 'Actualizar a DIAMOND',
                                                            ctaPlan: 'diamond',
                                                            sub: 'Plan DIAMOND · 100 análisis incluidos',
                                                        },
                                                        DIAMOND: {
                                                            title: `Usaste los ${planCap} análisis disponibles`,
                                                            body: 'Has alcanzado el límite del período actual. Los créditos se recargarán próximamente.',
                                                            cta: 'Entendido',
                                                            ctaPlan: null,
                                                            sub: 'Los créditos se recargan cada período',
                                                        },
                                                    };
                                                    const msg = lockMessages[leaguePlan] ?? lockMessages['FREE'];
                                                    return (
                                                        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                                            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
                                                                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                                                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Smart Insights • IA Powered</span>
                                                                <span className="ml-auto rounded-full bg-rose-100 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-rose-600">
                                                                    0/{planCap} créditos
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
                                                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                                                                    <Lock className="h-6 w-6 text-slate-400" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-black text-slate-900">{msg.title}</p>
                                                                    <p className="mt-1 text-xs text-slate-500">{msg.body}</p>
                                                                </div>
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => msg.ctaPlan
                                                                            ? navigate('/checkout', { state: { plan: msg.ctaPlan } })
                                                                            : setInsightsLocked(false)
                                                                        }
                                                                        className="rounded-full bg-lime-400 px-5 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-900 transition-all hover:bg-lime-300"
                                                                    >
                                                                        {msg.cta}
                                                                    </button>
                                                                    <span className="text-[9px] text-slate-400">{msg.sub}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Loading state
                                                if (insightsLoading && analysisMatchId === match.id) {
                                                    return (
                                                        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                                            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
                                                                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                                                <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Smart Insights • IA Powered</span>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
                                                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-amber-400" />
                                                                <p className="text-xs font-bold text-slate-500">Analizando partido con IA...</p>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Full panel — AI data if available, else deterministic fallback
                                                const ins = (cachedData ?? generateMatchInsights(match)) as ReturnType<typeof generateMatchInsights> & { insight?: string; personalInsight?: string };
                                                const scoreLabels = ['SEGURA', 'IA MODEL', 'ARRIESGADA'] as const;
                                                const scoreStyles = [
                                                    'bg-lime-100 text-lime-700',
                                                    'bg-violet-100 text-violet-700',
                                                    'bg-amber-100 text-amber-700',
                                                ] as const;
                                                const planBadgeColor =
                                                    leaguePlan === 'DIAMOND' ? 'bg-cyan-100 text-cyan-700' :
                                                    leaguePlan === 'GOLD' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-slate-100 text-slate-500';
                                                const homeEff = Math.round((ins.homeForm.filter((r) => r === 'W').length / 5) * 100);
                                                const awayEff = Math.round((ins.awayForm.filter((r) => r === 'W').length / 5) * 100);
                                                const calcTrend = (form: Array<'W' | 'D' | 'L'>) =>
                                                    form.slice(3).filter((r) => r === 'W').length >= 1 ? 'up' : 'down';
                                                const homeTrend = calcTrend(ins.homeForm);
                                                const awayTrend = calcTrend(ins.awayForm);

                                                return (
                                                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                                        {/* Header */}
                                                        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
                                                            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                                                            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-600">Smart Insights • IA Powered</span>
                                                            {cachedData && (
                                                                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-purple-600">IA</span>
                                                            )}
                                                            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${planBadgeColor}`}>
                                                                {siCredits}/{planCap} créditos
                                                            </span>
                                                        </div>

                                                        {/* Desktop: [prob bar + insight] | [suggestion cards]; Mobile: stacked */}
                                                        <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:divide-x lg:divide-slate-100">
                                                            {/* Left: Probability bar + amber insight */}
                                                            <div className="px-4 pb-4 pt-3">
                                                                <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase">
                                                                    <span className="font-black text-slate-900">{match.homeTeam.split(' ')[0]}</span>
                                                                    <span className="text-slate-400">Empate</span>
                                                                    <span className="font-black text-slate-900">{match.awayTeam.split(' ')[0]}</span>
                                                                </div>
                                                                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                                                                    <div className="bg-slate-900 transition-all" style={{ width: `${ins.homeWin}%` }} />
                                                                    <div className="bg-slate-300 transition-all" style={{ width: `${ins.draw}%` }} />
                                                                    <div className="bg-lime-400 transition-all" style={{ width: `${ins.awayWin}%` }} />
                                                                </div>
                                                                <div className="mt-1 flex justify-between">
                                                                    <span className="text-[10px] font-black text-slate-900">{ins.homeWin}%</span>
                                                                    <span className="text-[10px] font-black text-slate-400">{ins.draw}%</span>
                                                                    <span className="text-[10px] font-black text-slate-900">{ins.awayWin}%</span>
                                                                </div>
                                                                {ins.insight && (
                                                                    <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5">
                                                                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                                                                        <p className="text-[10px] font-medium leading-relaxed text-slate-700">"{ins.insight}"</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Right: Suggestion cards — vertical stack on desktop, 3-col grid on mobile */}
                                                            <div className="border-t border-slate-100 px-4 pb-4 pt-3 lg:border-t-0">
                                                                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Sugerencias automáticas</p>
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {ins.scores.map((score, idx) => {
                                                                        const [h, a] = score.split('-');
                                                                        const probs = [ins.homeWin, ins.draw, ins.awayWin];
                                                                        return (
                                                                            <button
                                                                                key={score + idx}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    handleDraftChange(match.id, 'home', h);
                                                                                    handleDraftChange(match.id, 'away', a);
                                                                                }}
                                                                                className={`flex flex-col items-center gap-1 rounded-xl py-3 transition-all hover:scale-105 active:scale-95 ${scoreStyles[idx]}`}
                                                                            >
                                                                                <span className="text-[9px] font-black uppercase tracking-wider opacity-80">{scoreLabels[idx]}</span>
                                                                                <span className="text-2xl font-black leading-none">{score}</span>
                                                                                <span className="text-[9px] font-bold opacity-70">{probs[idx]}% Prob.</span>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Form analysis — full width */}
                                                        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                                                            <div className="mb-3 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Análisis de Racha · Últimos 5</span>
                                                                </div>
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tendencia</span>
                                                            </div>

                                                            {/* Mobile: two rows then insight box */}
                                                            <div className="flex flex-col gap-2 lg:hidden">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex min-w-0 items-center gap-2">
                                                                        <span className="w-14 shrink-0 truncate text-[10px] font-black uppercase text-slate-900">{match.homeTeam.split(' ')[0]}</span>
                                                                        <div className="flex gap-0.5">
                                                                            {ins.homeForm.map((r, i) => (
                                                                                <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex shrink-0 items-center gap-0.5">
                                                                        {homeTrend === 'up' ? <ArrowUp className="h-3 w-3 text-lime-600" /> : <ArrowDown className="h-3 w-3 text-rose-500" />}
                                                                        <span className={`text-[9px] font-black ${homeTrend === 'up' ? 'text-lime-600' : 'text-rose-500'}`}>{homeTrend === 'up' ? 'SUBE' : 'BAJA'}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex min-w-0 items-center gap-2">
                                                                        <span className="w-14 shrink-0 truncate text-[10px] font-black uppercase text-slate-900">{match.awayTeam.split(' ')[0]}</span>
                                                                        <div className="flex gap-0.5">
                                                                            {ins.awayForm.map((r, i) => (
                                                                                <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex shrink-0 items-center gap-0.5">
                                                                        {awayTrend === 'up' ? <ArrowUp className="h-3 w-3 text-lime-600" /> : <ArrowDown className="h-3 w-3 text-rose-500" />}
                                                                        <span className={`text-[9px] font-black ${awayTrend === 'up' ? 'text-lime-600' : 'text-rose-500'}`}>{awayTrend === 'up' ? 'SUBE' : 'BAJA'}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                                                                    <p className="text-[10px] font-semibold leading-relaxed text-indigo-800">
                                                                        {ins.personalInsight || ins.insight || 'Análisis de forma actual e historial reciente de ambos equipos.'}
                                                                    </p>
                                                                    <p className="mt-2 text-[9px] font-black uppercase text-indigo-900">
                                                                        Opción inteligente: <span className="text-indigo-600">{ins.smartPick}</span>
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Desktop: home | insight box | away */}
                                                            <div className="hidden items-start gap-2 lg:flex">
                                                                <div className="flex min-w-0 flex-col items-start gap-1">
                                                                    <span className="max-w-[72px] truncate text-[10px] font-black uppercase text-slate-900">{match.homeTeam.split(' ')[0]}</span>
                                                                    <span className="text-[9px] text-slate-400">{homeEff}% efic.</span>
                                                                    <div className="flex gap-0.5">
                                                                        {ins.homeForm.map((r, i) => (
                                                                            <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                                                        ))}
                                                                    </div>
                                                                    <div className="flex items-center gap-0.5">
                                                                        {homeTrend === 'up' ? <ArrowUp className="h-3 w-3 text-lime-600" /> : <ArrowDown className="h-3 w-3 text-rose-500" />}
                                                                        <span className={`text-[9px] font-black ${homeTrend === 'up' ? 'text-lime-600' : 'text-rose-500'}`}>{homeTrend === 'up' ? 'SUBE' : 'BAJA'}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex min-h-[84px] flex-1 flex-col justify-between rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                                                                    <p className="text-[10px] font-semibold leading-relaxed text-indigo-800">
                                                                        {ins.personalInsight || ins.insight || 'Análisis de forma actual e historial reciente de ambos equipos.'}
                                                                    </p>
                                                                    <p className="mt-2 text-[9px] font-black uppercase text-indigo-900">
                                                                        Opción inteligente: <span className="text-indigo-600">{ins.smartPick}</span>
                                                                    </p>
                                                                </div>
                                                                <div className="flex min-w-0 flex-col items-end gap-1">
                                                                    <span className="max-w-[72px] truncate text-[10px] font-black uppercase text-slate-900">{match.awayTeam.split(' ')[0]}</span>
                                                                    <span className="text-[9px] text-slate-400">{awayEff}% efic.</span>
                                                                    <div className="flex gap-0.5">
                                                                        {ins.awayForm.map((r, i) => (
                                                                            <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                                                        ))}
                                                                    </div>
                                                                    <div className="flex items-center justify-end gap-0.5">
                                                                        {awayTrend === 'up' ? <ArrowUp className="h-3 w-3 text-lime-600" /> : <ArrowDown className="h-3 w-3 text-rose-500" />}
                                                                        <span className={`text-[9px] font-black ${awayTrend === 'up' ? 'text-lime-600' : 'text-rose-500'}`}>{awayTrend === 'up' ? 'SUBE' : 'BAJA'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })() : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </article>
                    ))}
                </div>
                ) : simulatorTab === 'groups' ? (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        Ordena los equipos para proyectar tu fase de grupos. Los dos primeros clasifican a octavos.
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        {groups.map((group, groupIndex) => (
                            <article key={group.name} className="overflow-hidden rounded-[1.75rem] border border-slate-200">
                                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">{group.name}</span>
                                    <span className="rounded-full bg-lime-100 px-2.5 py-1 text-[10px] font-black uppercase text-lime-700">
                                        CL / CL
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {group.teams.map((team, teamIndex) => (
                                        <div key={team.id} className={`flex items-center justify-between px-4 py-3 ${teamIndex < 2 ? 'bg-lime-50/40' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black ${teamIndex < 2 ? 'bg-lime-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                    {teamIndex + 1}
                                                </span>
                                                <img
                                                    src={`https://flagcdn.com/w80/${team.iso}.png`}
                                                    alt={team.name}
                                                    className="h-6 w-8 rounded-md border border-slate-200 object-cover"
                                                />
                                                <span className="text-sm font-black uppercase text-slate-900">{team.name}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => handleTeamMove(groupIndex, teamIndex, 'up')}
                                                    disabled={teamIndex === 0}
                                                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                                                >
                                                    <ArrowUp className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleTeamMove(groupIndex, teamIndex, 'down')}
                                                    disabled={teamIndex === group.teams.length - 1}
                                                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                                                >
                                                    <ArrowDown className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
                ) : (
                <div className="space-y-4">
                    <div className="rounded-[1.75rem] bg-slate-900 p-5 text-center text-white">
                        <Medal className="mx-auto h-8 w-8 text-lime-400" />
                        <h3 className="mt-3 text-lg font-black uppercase tracking-[0.18em]">Cruces de octavos</h3>
                        <p className="mt-1 text-sm text-slate-400">Así quedarían las llaves según tu predicción de grupos.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        {roundOf16Matchups.map((matchup) => {
                            const team1 = qualifiedTeams[matchup.team1];
                            const team2 = qualifiedTeams[matchup.team2];

                            return (
                                <article key={matchup.id} className="rounded-[1.75rem] border border-slate-200 p-4">
                                    <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                        Octavos de final
                                    </p>
                                    <div className="mt-4 flex items-center justify-center gap-4">
                                        {[team1, team2].map((team, index) => (
                                            <div key={`${matchup.id}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                                                {team ? (
                                                    <>
                                                        <img
                                                            src={`https://flagcdn.com/w80/${team.iso}.png`}
                                                            alt={team.name}
                                                            className="h-8 w-10 rounded-md border border-slate-200 object-cover"
                                                        />
                                                        <span className="text-center text-[10px] font-black uppercase text-slate-900">
                                                            {team.name}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] font-black uppercase text-slate-300">Por definir</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
                )}
            </section>
        </div>
        {activeGroupModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-900">
                            Tabla de posiciones • Grupo {activeGroupModal}
                        </h3>
                        <button
                            onClick={() => setActiveGroupModal(null)}
                            className="rounded-lg px-2 py-1 text-sm font-black text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                            ×
                        </button>
                    </div>
                    <div className="p-4">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                                    <th className="pb-2 text-left">#</th>
                                    <th className="pb-2 text-left">Equipo</th>
                                    <th className="pb-2 text-center">PJ</th>
                                    <th className="pb-2 text-center">DG</th>
                                    <th className="pb-2 text-center text-lime-600">PTS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {MOCK_STANDINGS.map((row) => (
                                    <tr key={row.pos}>
                                        <td className="py-3 font-bold text-slate-500">{row.pos}</td>
                                        <td className="py-3">
                                            <div className="flex items-center gap-2">
                                                <img
                                                    src={`https://flagcdn.com/w40/${row.iso}.png`}
                                                    alt={row.team}
                                                    className="h-4 w-6 rounded-sm border border-slate-200 object-cover"
                                                />
                                                <span className="font-bold text-slate-900">{row.team}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-center text-slate-500">{row.pj}</td>
                                        <td className="py-3 text-center text-slate-500">{row.dg > 0 ? `+${row.dg}` : row.dg}</td>
                                        <td className="py-3 text-center font-black text-slate-900">{row.pts}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        ) : null}
        </>
    );
};

export default Predictions;

