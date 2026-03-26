import React from 'react';
import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    Filter,
    Medal,
    Shield,
    Sparkles,
    Target,
    Trophy,
    XCircle,
} from 'lucide-react';
import { useAdminPredictionsStore, type AdminPrediction } from '../../stores/admin.predictions.store';
import AdminPagination from '../../components/admin/AdminPagination';

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
};

type OutcomeKey = 'EXACT_UNIQUE' | 'EXACT' | 'WINNER_GOAL' | 'WINNER' | 'GOAL' | 'WRONG' | 'PENDING';
type QuickFilter = 'ALL' | 'SCORED' | 'PENDING' | OutcomeKey;

const OUTCOME_META: Record<
    OutcomeKey,
    {
        label: string;
        badge: string;
        icon: React.ComponentType<{ className?: string; size?: number }>;
        iconClass: string;
        pointsClass: string;
    }
> = {
    EXACT_UNIQUE: {
        label: 'Exacto único',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: Trophy,
        iconClass: 'text-amber-600',
        pointsClass: 'text-amber-700',
    },
    EXACT: {
        label: 'Marcador exacto',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: Target,
        iconClass: 'text-emerald-600',
        pointsClass: 'text-emerald-700',
    },
    WINNER_GOAL: {
        label: 'Ganador + gol',
        badge: 'bg-sky-100 text-sky-800 border-sky-200',
        icon: Sparkles,
        iconClass: 'text-sky-600',
        pointsClass: 'text-sky-700',
    },
    WINNER: {
        label: 'Ganador correcto',
        badge: 'bg-violet-100 text-violet-800 border-violet-200',
        icon: CheckCircle2,
        iconClass: 'text-violet-600',
        pointsClass: 'text-violet-700',
    },
    GOAL: {
        label: 'Gol acertado',
        badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        icon: Medal,
        iconClass: 'text-indigo-600',
        pointsClass: 'text-indigo-700',
    },
    WRONG: {
        label: 'Sin acierto',
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: XCircle,
        iconClass: 'text-slate-400',
        pointsClass: 'text-slate-500',
    },
    PENDING: {
        label: 'Pendiente',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: AlertCircle,
        iconClass: 'text-amber-500',
        pointsClass: 'text-amber-600',
    },
};

const STATUS_META: Record<string, string> = {
    SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
    LIVE: 'bg-rose-50 text-rose-700 border-rose-200',
    FINISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    POSTPONED: 'bg-amber-50 text-amber-700 border-amber-200',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
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
    if (prediction.match.homeScore == null || prediction.match.awayScore == null) {
        return 'PENDING';
    }

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
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function formatScore(home?: number | null, away?: number | null): string {
    if (home == null || away == null) return '—';
    return `${home} - ${away}`;
}

function getStatusLabel(status?: string | null): string {
    switch (status) {
        case 'LIVE':
            return 'En curso';
        case 'FINISHED':
            return 'Finalizado';
        case 'POSTPONED':
            return 'Aplazado';
        case 'CANCELLED':
            return 'Cancelado';
        default:
            return 'Programado';
    }
}

function getPhaseLabel(phase?: string | null): string {
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

function resolveFlagUrl(flagUrl?: string | null, code?: string | null): string {
    if (flagUrl) return flagUrl;
    if (code) return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
    return '';
}

function MatchTeams({ prediction }: { prediction: AdminPrediction }) {
    const homeFlag = resolveFlagUrl(prediction.match.homeTeam.flagUrl, prediction.match.homeTeam.code);
    const awayFlag = resolveFlagUrl(prediction.match.awayTeam.flagUrl, prediction.match.awayTeam.code);

    return (
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${STATUS_META[prediction.match.status ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {getStatusLabel(prediction.match.status)}
                </span>
                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    {getPhaseLabel(prediction.match.phase)}
                </span>
                <span className="text-[11px] text-slate-400">{prediction.league.name}</span>
            </div>

            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        {homeFlag ? (
                            <img
                                src={homeFlag}
                                alt={prediction.match.homeTeam.name}
                                className="h-7 w-10 rounded border border-slate-200 object-cover shadow-sm"
                            />
                        ) : null}
                        <p className="truncate text-sm font-black text-slate-900">{prediction.match.homeTeam.name}</p>
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Partido</p>
                    <p className="mt-1 text-sm font-black text-slate-700">
                        {formatScore(prediction.match.homeScore, prediction.match.awayScore)}
                    </p>
                </div>
                <div className="min-w-0 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <p className="truncate text-sm font-black text-slate-900">{prediction.match.awayTeam.name}</p>
                        {awayFlag ? (
                            <img
                                src={awayFlag}
                                alt={prediction.match.awayTeam.name}
                                className="h-7 w-10 rounded border border-slate-200 object-cover shadow-sm"
                            />
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDateTime(prediction.match.matchDate)}
                </span>
                {prediction.match.id ? <span className="rounded-full bg-white px-2 py-1 font-medium text-slate-500">Match ID: {prediction.match.id}</span> : null}
            </div>
        </div>
    );
}

const AdminPredictions: React.FC = () => {
    const { predictions, total, filters, isLoading, error, fetchPredictions, setFilters } = useAdminPredictionsStore();
    const [quickFilter, setQuickFilter] = React.useState<QuickFilter>('ALL');

    React.useEffect(() => {
        void fetchPredictions();
    }, [filters, fetchPredictions]);

    const enrichedPredictions = React.useMemo(
        () =>
            predictions.map((prediction) => {
                const detail = parsePointDetail(prediction.pointDetail);
                const outcome = getOutcome(prediction);
                return { prediction, detail, outcome };
            }),
        [predictions],
    );

    const summary = React.useMemo(() => {
        const exact = enrichedPredictions.filter((item) => item.outcome === 'EXACT' || item.outcome === 'EXACT_UNIQUE').length;
        const scored = enrichedPredictions.filter((item) => item.outcome !== 'PENDING').length;
        const pending = enrichedPredictions.filter((item) => item.outcome === 'PENDING').length;
        return { exact, scored, pending };
    }, [enrichedPredictions]);

    const visiblePredictions = React.useMemo(() => {
        if (quickFilter === 'ALL') return enrichedPredictions;
        if (quickFilter === 'SCORED') return enrichedPredictions.filter((item) => item.outcome !== 'PENDING');
        if (quickFilter === 'PENDING') return enrichedPredictions.filter((item) => item.outcome === 'PENDING');
        return enrichedPredictions.filter((item) => item.outcome === quickFilter);
    }, [enrichedPredictions, quickFilter]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 sm:text-2xl">
                        Pronósticos
                    </h1>
                    <p className="mt-1 text-xs text-slate-400">
                        Vista SUPER ADMIN con el mismo lenguaje visual de partidos y puntos de cierre.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <button
                        type="button"
                        onClick={() => setQuickFilter('ALL')}
                        className={`rounded-[1.35rem] border bg-white p-3 text-left shadow-sm transition ${quickFilter === 'ALL' ? 'border-slate-900 ring-2 ring-slate-200' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Total</p>
                        <p className="mt-2 text-xl font-black text-slate-900">{predictions.length}</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setQuickFilter('SCORED')}
                        className={`rounded-[1.35rem] border bg-white p-3 text-left shadow-sm transition ${quickFilter === 'SCORED' ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Calificados</p>
                        <p className="mt-2 text-xl font-black text-emerald-700">{summary.scored}</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setQuickFilter('EXACT')}
                        className={`rounded-[1.35rem] border bg-white p-3 text-left shadow-sm transition ${quickFilter === 'EXACT' ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Exactos</p>
                        <p className="mt-2 text-xl font-black text-emerald-700">{summary.exact}</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setQuickFilter('PENDING')}
                        className={`rounded-[1.35rem] border bg-white p-3 text-left shadow-sm transition ${quickFilter === 'PENDING' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Pendientes</p>
                        <p className="mt-2 text-xl font-black text-amber-700">{summary.pending}</p>
                    </button>
                </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <Filter size={16} className="text-slate-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Filtros de búsqueda</p>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <input
                        value={filters.matchId ?? ''}
                        onChange={(e) => setFilters({ matchId: e.target.value || undefined, page: 1 })}
                        placeholder="ID del partido..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                        value={filters.leagueId ?? ''}
                        onChange={(e) => setFilters({ leagueId: e.target.value || undefined, page: 1 })}
                        placeholder="ID de la liga..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                        value={filters.userId ?? ''}
                        onChange={(e) => setFilters({ userId: e.target.value || undefined, page: 1 })}
                        placeholder="ID del usuario..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {(['ALL', 'SCORED', 'PENDING', 'EXACT_UNIQUE', 'EXACT', 'WINNER_GOAL', 'WINNER', 'GOAL', 'WRONG'] as QuickFilter[]).map((filterKey) => {
                        const meta = filterKey === 'ALL' || filterKey === 'SCORED' || filterKey === 'PENDING'
                            ? null
                            : OUTCOME_META[filterKey];
                        const FilterIcon = meta?.icon;
                        return (
                            <button
                                key={filterKey}
                                type="button"
                                onClick={() => setQuickFilter(filterKey)}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                                    quickFilter === filterKey
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {FilterIcon ? <FilterIcon size={14} className={quickFilter === filterKey ? 'text-white' : meta.iconClass} /> : null}
                                {filterKey === 'ALL'
                                    ? 'Todos'
                                    : filterKey === 'SCORED'
                                        ? 'Con puntos calculados'
                                        : filterKey === 'PENDING'
                                            ? 'Pendientes'
                                            : meta?.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    <div className="grid gap-4 xl:grid-cols-2">
                        {[...Array(4)].map((_, index) => (
                            <div key={index} className="animate-pulse rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="h-4 w-40 rounded bg-slate-200" />
                                <div className="mt-4 h-24 rounded-3xl bg-slate-100" />
                                <div className="mt-4 h-20 rounded-2xl bg-slate-100" />
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                        {error}
                    </div>
                ) : visiblePredictions.length === 0 ? (
                    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
                        No se encontraron pronósticos para los filtros actuales.
                    </div>
                ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                        {visiblePredictions.map(({ prediction, detail, outcome }) => {
                            const meta = OUTCOME_META[outcome];
                            const Icon = meta.icon;
                            const hasResult = prediction.match.homeScore != null && prediction.match.awayScore != null;
                            const positivePoints = (prediction.points ?? 0) > 0;

                            return (
                                <article key={prediction.id} className="rounded-[1.85rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <img
                                                src={prediction.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(prediction.user.name)}&background=e2e8f0&color=64748b`}
                                                className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                                                alt={prediction.user.name}
                                            />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black text-slate-900">{prediction.user.name}</p>
                                                <p className="truncate text-xs text-slate-500">@{prediction.user.username}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Registrado</p>
                                            <p className="mt-1 text-xs font-semibold text-slate-600">{formatDateTime(prediction.submittedAt)}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <MatchTeams prediction={prediction} />
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Pronóstico</p>
                                            <p className="mt-2 text-2xl font-black text-slate-900">
                                                {prediction.homeScore} - {prediction.awayScore}
                                            </p>
                                            {prediction.advanceTeamId ? (
                                                <p className="mt-2 inline-flex rounded-full bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">
                                                    Avance definido
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Marcador real</p>
                                            <p className="mt-2 text-2xl font-black text-slate-900">
                                                {formatScore(prediction.match.homeScore, prediction.match.awayScore)}
                                            </p>
                                            <p className="mt-2 text-[11px] text-slate-500">
                                                {hasResult ? 'Resultado cargado' : 'Pendiente de cierre'}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Puntos</p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <Icon size={18} className={meta.iconClass} />
                                                <p className={`text-2xl font-black ${positivePoints ? meta.pointsClass : 'text-slate-500'}`}>
                                                    {prediction.points ?? 0}
                                                </p>
                                            </div>
                                            <p className="mt-2 text-[11px] text-slate-500">
                                                {detail ? `Base ${detail.basePoints} · x${detail.multiplier}` : meta.label}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${meta.badge}`}>
                                            <Icon size={14} className={meta.iconClass} />
                                            {meta.label}
                                        </span>
                                        {hasResult && !detail ? (
                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                                                Sin desglose guardado
                                            </span>
                                        ) : null}
                                    </div>

                                    {detail ? (
                                        <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                                            <div className="flex items-center gap-2">
                                                <Shield size={15} className="text-slate-500" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                                    Desglose de puntos
                                                </p>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                                                    Exacto: +{detail.exactPoints}
                                                </span>
                                                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                                                    Ganador: +{detail.winnerPoints}
                                                </span>
                                                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                                                    Goles: +{detail.goalPoints}
                                                </span>
                                                {detail.uniqueBonus > 0 ? (
                                                    <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
                                                        Bono único: +{detail.uniqueBonus}
                                                    </span>
                                                ) : null}
                                                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                                                    Total: +{detail.total}
                                                </span>
                                                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                                                    Fase: {getPhaseLabel(detail.phase)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : null}
                                </article>
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
