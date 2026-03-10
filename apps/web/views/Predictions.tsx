
import React from 'react';
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
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
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore, type MatchViewModel } from '../stores/prediction.store';

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
    const activeLeague = useLeagueStore((state) => state.activeLeague);
    const myLeagues = useLeagueStore((state) => state.myLeagues);
    const fetchMyLeagues = useLeagueStore((state) => state.fetchMyLeagues);
    const setActiveLeague = useLeagueStore((state) => state.setActiveLeague);
    const matches = usePredictionStore((state) => state.matches);
    const isLoading = usePredictionStore((state) => state.isLoading);
    const fetchLeagueMatches = usePredictionStore((state) => state.fetchLeagueMatches);
    const savePrediction = usePredictionStore((state) => state.savePrediction);
    const resetLeagueData = usePredictionStore((state) => state.resetLeagueData);

    const [drafts, setDrafts] = React.useState<DraftMap>({});
    const [searchTerm, setSearchTerm] = React.useState('');
    const [phaseFilter, setPhaseFilter] = React.useState<PhaseFilter>('ALL');
    const [error, setError] = React.useState<string | null>(null);
    const [savingMatchId, setSavingMatchId] = React.useState<string | null>(null);
    const [analysisMatchId, setAnalysisMatchId] = React.useState<string | null>(null);
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
                                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">{date}</span>
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
                                                        onClick={() => setAnalysisMatchId(isAnalysisOpen ? null : match.id)}
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

                                            {isAnalysisOpen ? (
                                                <div className="mt-3 rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="h-4 w-4 text-purple-600" />
                                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-700">
                                                            Vista alineada al análisis anterior
                                                        </p>
                                                    </div>
                                                    <p className="mt-2 text-sm text-slate-600">
                                                        El contenedor de insights queda listo para una siguiente fase. En esta iteración mantenemos el layout y el acceso rápido, pero sin inventar datos que el backend todavía no expone.
                                                    </p>
                                                </div>
                                            ) : null}
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

