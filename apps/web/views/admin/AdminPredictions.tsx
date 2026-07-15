import React from 'react';
import {
    AlertCircle,
    CheckCircle2,
    Filter,
    Search,
    Sparkles,
    Target,
    Trophy,
    UserPlus,
    XCircle,
} from 'lucide-react';
import {
    useAdminPredictionsStore,
    type AdminFormMatch,
    type AdminPrediction,
    type AdminPredictionFilterOption,
} from '../../stores/admin.predictions.store';
import AdminPagination from '../../components/admin/AdminPagination';
import { Tooltip } from '../../components/ui/Tooltip';
import { PointsBreakdown } from '../../components/ui/PointsBreakdown';

type PointDetail = {
    type: 'EXACT_SCORE' | 'CORRECT_WINNER_GOAL' | 'CORRECT_WINNER' | 'TEAM_GOALS' | 'NONE';
    exactPoints: number;
    winnerPoints: number;
    goalPoints: number;
    uniqueBonus: number;
    basePoints: number;
    phase: string;
    multiplier: number;
    total: number;
    explanation?: string;
};

type OutcomeKey = 'EXACT_UNIQUE' | 'EXACT' | 'WINNER_GOAL' | 'WINNER' | 'GOAL' | 'WRONG' | 'PENDING';

const OUTCOME_META: Record<
    OutcomeKey,
    {
        label: string;
        icon: React.ComponentType<{ className?: string; size?: number }>;
        badge: string;
        points: string;
    }
> = {
    EXACT_UNIQUE: {
        label: 'Exacto único',
        icon: Trophy,
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        points: 'text-amber-700',
    },
    EXACT: {
        label: 'Marcador exacto',
        icon: Target,
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        points: 'text-emerald-700',
    },
    WINNER_GOAL: {
        label: 'Ganador + gol',
        icon: Sparkles,
        badge: 'bg-sky-100 text-sky-800 border-sky-200',
        points: 'text-sky-700',
    },
    WINNER: {
        label: 'Ganador correcto',
        icon: CheckCircle2,
        badge: 'bg-violet-100 text-violet-800 border-violet-200',
        points: 'text-violet-700',
    },
    GOAL: {
        label: 'Gol acertado',
        icon: Sparkles,
        badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        points: 'text-indigo-700',
    },
    WRONG: {
        label: 'Sin acierto',
        icon: XCircle,
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
        points: 'text-slate-500',
    },
    PENDING: {
        label: 'Pendiente',
        icon: AlertCircle,
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        points: 'text-amber-600',
    },
};

function parsePointDetail(value?: string | null): PointDetail | null {
    if (!value) return null;
    try {
        return JSON.parse(value) as PointDetail;
    } catch {
        return null;
    }
}

function getOutcome(prediction: AdminPrediction): OutcomeKey {
    if (prediction.match.homeScore == null || prediction.match.awayScore == null) return 'PENDING';
    const detail = parsePointDetail(prediction.pointDetail);
    if (detail?.type === 'EXACT_SCORE' && (detail.uniqueBonus ?? 0) > 0) return 'EXACT_UNIQUE';
    if (detail?.type === 'EXACT_SCORE') return 'EXACT';
    if (detail?.type === 'CORRECT_WINNER_GOAL') return 'WINNER_GOAL';
    if (detail?.type === 'CORRECT_WINNER') return 'WINNER';
    if (detail?.type === 'TEAM_GOALS') return 'GOAL';
    return (prediction.points ?? 0) > 0 ? 'WINNER' : 'WRONG';
}

function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function needsAdvanceTeam(match: AdminFormMatch | undefined, homeScore: number, awayScore: number): boolean {
    if (!match) return false;
    if (match.phase === 'GROUP' || match.phase === 'THIRD_PLACE') return false;
    return homeScore === awayScore;
}

function formatMatchOption(match: AdminFormMatch): string {
    const base = `${match.homeTeam.name} vs ${match.awayTeam.name} · ${formatDateTime(match.matchDate)}`;
    if (match.status === 'FINISHED') {
        const score =
            match.homeScore != null && match.awayScore != null
                ? ` ${match.homeScore}-${match.awayScore}`
                : '';
        return `${base} · Finalizado${score}`;
    }
    return base;
}

function formatPhase(phase?: string | null): string {
    switch (phase) {
        case 'GROUP':
            return 'Grupos';
        case 'ROUND_OF_32':
            return 'Dieciseisavos';
        case 'ROUND_OF_16':
            return 'Octavos';
        case 'QUARTER':
            return 'Cuartos';
        case 'SEMI':
            return 'Semifinal';
        case 'THIRD_PLACE':
            return 'Tercer puesto';
        case 'FINAL':
            return 'Final';
        default:
            return phase || 'Partido';
    }
}

function formatScore(home?: number | null, away?: number | null): string {
    if (home == null || away == null) return '—';
    return `${home}-${away}`;
}

function SearchableSelect({
    label,
    value,
    options,
    placeholder,
    onChange,
}: {
    label: string;
    value?: string;
    options: AdminPredictionFilterOption[];
    placeholder: string;
    onChange: (value?: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
            <select
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value || undefined)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
                <option value="">{placeholder}</option>
                {options.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.name}
                    </option>
                ))}
            </select>
        </label>
    );
}

const AdminPredictions: React.FC = () => {
    const {
        predictions,
        total,
        filters,
        filterOptions,
        formOptions,
        isLoading,
        isLoadingFilters,
        isLoadingFormOptions,
        isSubmittingForUser,
        error,
        fetchPredictions,
        fetchFilterOptions,
        fetchFormOptions,
        submitForUser,
        setFilters,
    } = useAdminPredictionsStore();
    const [searchInput, setSearchInput] = React.useState(filters.search ?? '');
    const [formLeagueId, setFormLeagueId] = React.useState<string>('');
    const [formUserId, setFormUserId] = React.useState<string>('');
    const [formMatchId, setFormMatchId] = React.useState<string>('');
    const [formHomeScore, setFormHomeScore] = React.useState('0');
    const [formAwayScore, setFormAwayScore] = React.useState('0');
    const [formAdvanceTeamId, setFormAdvanceTeamId] = React.useState<string>('');
    const [formError, setFormError] = React.useState<string | null>(null);
    const [formSuccess, setFormSuccess] = React.useState<string | null>(null);

    React.useEffect(() => {
        void fetchPredictions();
    }, [filters, fetchPredictions]);

    React.useEffect(() => {
        void fetchFilterOptions();
    }, [filters.leagueId, fetchFilterOptions]);

    React.useEffect(() => {
        void fetchFormOptions(formLeagueId || undefined);
    }, [formLeagueId, fetchFormOptions]);

    React.useEffect(() => {
        const timeout = setTimeout(() => {
            setFilters({ search: searchInput || undefined, page: 1 });
        }, 250);
        return () => clearTimeout(timeout);
    }, [searchInput, setFilters]);

    const selectedFormMatch = React.useMemo(
        () => formOptions.matches.find((m) => m.id === formMatchId),
        [formOptions.matches, formMatchId],
    );

    const homeScoreNum = Number.parseInt(formHomeScore, 10);
    const awayScoreNum = Number.parseInt(formAwayScore, 10);
    const showAdvanceSelector = needsAdvanceTeam(
        selectedFormMatch,
        Number.isFinite(homeScoreNum) ? homeScoreNum : 0,
        Number.isFinite(awayScoreNum) ? awayScoreNum : 0,
    );

    const handleSubmitForUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setFormSuccess(null);

        if (!formLeagueId || !formUserId || !formMatchId) {
            setFormError('Selecciona polla, jugador y partido.');
            return;
        }
        if (!Number.isFinite(homeScoreNum) || !Number.isFinite(awayScoreNum) || homeScoreNum < 0 || awayScoreNum < 0) {
            setFormError('El marcador debe ser un número entero mayor o igual a 0.');
            return;
        }
        if (showAdvanceSelector && !formAdvanceTeamId) {
            setFormError('En eliminatorias con empate debes indicar qué equipo clasifica.');
            return;
        }

        try {
            await submitForUser({
                leagueId: formLeagueId,
                userId: formUserId,
                matchId: formMatchId,
                homeScore: homeScoreNum,
                awayScore: awayScoreNum,
                ...(showAdvanceSelector && formAdvanceTeamId ? { advanceTeamId: formAdvanceTeamId } : {}),
            });
            setFormSuccess('Pronóstico guardado correctamente.');
            setFormHomeScore('0');
            setFormAwayScore('0');
            setFormAdvanceTeamId('');
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'No se pudo guardar el pronóstico');
        }
    };

    const enriched = React.useMemo(
        () => predictions.map((prediction) => ({ prediction, detail: parsePointDetail(prediction.pointDetail), outcome: getOutcome(prediction) })),
        [predictions],
    );

    const summary = React.useMemo(() => ({
        exact: enriched.filter((item) => item.outcome === 'EXACT' || item.outcome === 'EXACT_UNIQUE').length,
        pending: enriched.filter((item) => item.outcome === 'PENDING').length,
    }), [enriched]);

    return (
        <div className="space-y-5">
            <div className="rounded-[1.85rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600">Super Admin</p>
                        <h1 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">Pronósticos de cierre</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Vista compacta tipo correo de cierre, con filtros por la configuración real de cada polla.
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Registros</p>
                            <p className="mt-1 text-xl font-black text-slate-900">{total}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Exactos</p>
                            <p className="mt-1 text-xl font-black text-emerald-700">{summary.exact}</p>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Pendientes</p>
                            <p className="mt-1 text-xl font-black text-amber-700">{summary.pending}</p>
                        </div>
                    </div>
                </div>
            </div>

            <form
                onSubmit={handleSubmitForUser}
                className="rounded-[1.85rem] border border-amber-200 bg-gradient-to-br from-amber-50/80 to-white p-5 shadow-sm"
            >
                <div className="flex items-center gap-3">
                    <UserPlus size={16} className="text-amber-600" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Ingresar por participante</p>
                        <p className="text-xs text-slate-500">
                            Carga o corrige el marcador de un jugador que no pudo pronosticar. Omite el cierre de ventana
                            e incluye partidos finalizados (recalcula puntos al guardar).
                        </p>
                    </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Polla</span>
                        <select
                            value={formLeagueId}
                            onChange={(e) => {
                                setFormLeagueId(e.target.value);
                                setFormUserId('');
                                setFormMatchId('');
                                setFormAdvanceTeamId('');
                                setFormError(null);
                                setFormSuccess(null);
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">{isLoadingFormOptions && !formOptions.leagues.length ? 'Cargando...' : 'Seleccionar polla'}</option>
                            {formOptions.leagues.map((league) => (
                                <option key={league.id} value={league.id}>{league.name}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Jugador</span>
                        <select
                            value={formUserId}
                            disabled={!formLeagueId}
                            onChange={(e) => {
                                setFormUserId(e.target.value);
                                setFormError(null);
                                setFormSuccess(null);
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">
                                {!formLeagueId
                                    ? 'Elige una polla primero'
                                    : isLoadingFormOptions
                                      ? 'Cargando...'
                                      : formOptions.members.length === 0
                                        ? 'Sin miembros activos'
                                        : 'Seleccionar jugador'}
                            </option>
                            {formOptions.members.map((member) => (
                                <option key={member.id} value={member.id}>
                                    {member.name} (@{member.username})
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Partido</span>
                        <select
                            value={formMatchId}
                            disabled={!formLeagueId}
                            onChange={(e) => {
                                setFormMatchId(e.target.value);
                                setFormAdvanceTeamId('');
                                setFormError(null);
                                setFormSuccess(null);
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">
                                {!formLeagueId
                                    ? 'Elige una polla primero'
                                    : isLoadingFormOptions
                                      ? 'Cargando...'
                                      : formOptions.matches.length === 0
                                        ? 'Sin partidos abiertos'
                                        : 'Seleccionar partido'}
                            </option>
                            {formOptions.matches.map((match) => (
                                <option key={match.id} value={match.id}>{formatMatchOption(match)}</option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
                    <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                            {selectedFormMatch ? selectedFormMatch.homeTeam.name : 'Local'}
                        </span>
                        <input
                            type="number"
                            min={0}
                            value={formHomeScore}
                            onChange={(e) => {
                                setFormHomeScore(e.target.value);
                                setFormAdvanceTeamId('');
                                setFormError(null);
                                setFormSuccess(null);
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                            {selectedFormMatch ? selectedFormMatch.awayTeam.name : 'Visitante'}
                        </span>
                        <input
                            type="number"
                            min={0}
                            value={formAwayScore}
                            onChange={(e) => {
                                setFormAwayScore(e.target.value);
                                setFormAdvanceTeamId('');
                                setFormError(null);
                                setFormSuccess(null);
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                    </label>

                    {showAdvanceSelector && selectedFormMatch ? (
                        <label className="block sm:col-span-2 lg:col-span-1">
                            <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Clasifica</span>
                            <select
                                value={formAdvanceTeamId}
                                onChange={(e) => setFormAdvanceTeamId(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                                <option value="">¿Quién clasifica?</option>
                                <option value={selectedFormMatch.homeTeamId}>{selectedFormMatch.homeTeam.name}</option>
                                <option value={selectedFormMatch.awayTeamId}>{selectedFormMatch.awayTeam.name}</option>
                            </select>
                        </label>
                    ) : (
                        <div className="hidden lg:block" />
                    )}

                    <button
                        type="submit"
                        disabled={isSubmittingForUser}
                        className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmittingForUser ? 'Guardando...' : 'Guardar pronóstico'}
                    </button>
                </div>

                {formError ? (
                    <p className="mt-3 text-sm font-semibold text-rose-600">{formError}</p>
                ) : null}
                {formSuccess ? (
                    <p className="mt-3 text-sm font-semibold text-emerald-700">{formSuccess}</p>
                ) : null}
            </form>

            <div className="rounded-[1.85rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                    <Filter size={16} className="text-slate-400" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Filtros comunes</p>
                        <p className="text-xs text-slate-500">
                            Polla, equipo, jugador, partido, grupo, fase y ronda. Las opciones se ajustan a la liga seleccionada.
                        </p>
                    </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-4">
                    <label className="block lg:col-span-2">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Buscar</span>
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                            <Search size={15} className="text-slate-400" />
                            <input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Jugador, partido, equipo o polla..."
                                className="w-full bg-transparent text-sm text-slate-700 outline-none"
                            />
                        </div>
                    </label>

                    <SearchableSelect
                        label="Polla"
                        value={filters.leagueId}
                        options={filterOptions.leagues}
                        placeholder={isLoadingFilters ? 'Cargando...' : 'Todas las pollas'}
                        onChange={(leagueId) => setFilters({
                            leagueId,
                            userId: undefined,
                            team: undefined,
                            group: undefined,
                            phase: undefined,
                            round: undefined,
                            page: 1,
                        })}
                    />

                    <SearchableSelect
                        label="Jugador"
                        value={filters.userId}
                        options={filterOptions.players}
                        placeholder="Todos los jugadores"
                        onChange={(userId) => setFilters({ userId, page: 1 })}
                    />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SearchableSelect
                        label="Equipo"
                        value={filters.team}
                        options={filterOptions.teams.map((team) => ({ id: team.name, name: team.name }))}
                        placeholder="Todos los equipos"
                        onChange={(team) => setFilters({ team, page: 1 })}
                    />

                    <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Grupo</span>
                        <select
                            value={filters.group ?? ''}
                            onChange={(e) => setFilters({ group: e.target.value || undefined, page: 1 })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">Todos los grupos</option>
                            {filterOptions.groups.map((group) => (
                                <option key={group} value={group}>{group}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Fase</span>
                        <select
                            value={filters.phase ?? ''}
                            onChange={(e) => setFilters({ phase: e.target.value || undefined, page: 1 })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">Todas las fases</option>
                            {filterOptions.phases.map((phase) => (
                                <option key={phase} value={phase}>{formatPhase(phase)}</option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ronda</span>
                        <select
                            value={filters.round ?? ''}
                            onChange={(e) => setFilters({ round: e.target.value || undefined, page: 1 })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">Todas las rondas</option>
                            {filterOptions.rounds.map((round) => (
                                <option key={round} value={round}>{round}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            <div className="overflow-hidden rounded-[1.85rem] border border-slate-200 bg-white shadow-sm">
                <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_auto_auto_auto] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 lg:grid">
                    <p>Partido</p>
                    <p>Jugador / Polla</p>
                    <p>Pronóstico</p>
                    <p>Resultado</p>
                    <p>Puntos</p>
                </div>

                {isLoading ? (
                    <div className="space-y-3 p-5">
                        {[...Array(5)].map((_, index) => (
                            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-sm text-rose-600">{error}</div>
                ) : enriched.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">No se encontraron pronósticos con esos filtros.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {enriched.map(({ prediction, detail, outcome }) => {
                            const meta = OUTCOME_META[outcome];
                            const Icon = meta.icon;
                            return (
                                <div key={prediction.id} className="px-4 py-4 lg:px-5">
                                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_auto_auto_auto] lg:items-center">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-slate-900">
                                                {prediction.match.homeTeam.name} vs {prediction.match.awayTeam.name}
                                            </p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                <span>{formatDateTime(prediction.match.matchDate)}</span>
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5">{formatPhase(prediction.match.phase)}</span>
                                                {prediction.match.group ? <span className="rounded-full bg-slate-100 px-2 py-0.5">Grupo {prediction.match.group}</span> : null}
                                                {prediction.match.round ? <span className="rounded-full bg-slate-100 px-2 py-0.5">{prediction.match.round}</span> : null}
                                            </div>
                                        </div>

                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-slate-800">{prediction.user.name}</p>
                                            <p className="truncate text-xs text-slate-500">
                                                {prediction.league.name} · @{prediction.user.username}
                                            </p>
                                        </div>

                                        <div className="rounded-xl bg-slate-950 px-3 py-2 text-center text-sm font-black text-white">
                                            {prediction.homeScore}-{prediction.awayScore}
                                        </div>

                                        <div className="rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-black text-slate-700">
                                            {formatScore(prediction.match.homeScore, prediction.match.awayScore)}
                                        </div>

                                        <div className="flex flex-col items-start gap-2 lg:items-end">
                                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${meta.badge}`}>
                                                <Icon size={14} />
                                                {meta.label}
                                            </span>
                                            {detail ? (
                                                <Tooltip content={<PointsBreakdown detail={detail} compact />}>
                                                    <p className={`text-lg font-black ${meta.points} cursor-help underline decoration-dotted decoration-2 underline-offset-4`}>
                                                        {prediction.points ?? 0} pts
                                                    </p>
                                                </Tooltip>
                                            ) : (
                                                <p className={`text-lg font-black ${meta.points}`}>
                                                    {prediction.points ?? 0} pts
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {detail?.explanation ? (
                                        <div className="mt-3 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-2.5">
                                            <p className="text-xs font-semibold text-slate-700">
                                                <span className="text-slate-400">Cálculo: </span>
                                                {detail.explanation}
                                            </p>
                                        </div>
                                    ) : detail ? (
                                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1">Exacto +{detail.exactPoints}</span>
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1">Ganador +{detail.winnerPoints}</span>
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1">Goles +{detail.goalPoints}</span>
                                            {detail.uniqueBonus > 0 ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Único +{detail.uniqueBonus}</span> : null}
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1">x{detail.multiplier}</span>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <AdminPagination
                page={filters.page}
                limit={filters.limit}
                total={total}
                onPageChange={(page) => setFilters({ page })}
            />
        </div>
    );
};

export default AdminPredictions;
