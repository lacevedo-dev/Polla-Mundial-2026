import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Activity, AlertCircle, BarChart2, CheckCircle2, ChevronLeft, ChevronRight,
    Clock, Filter, Loader2, RefreshCw, Search, Target, TrendingUp, Users, XCircle, Calculator,
} from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import {
    ParticipationBreakdownChart,
    buildParticipationSegments,
} from '../components/ParticipationBreakdownChart';
import { request, resolveApiAssetUrl, ApiError } from '../api';

interface ParticipationSummary {
    totalMembers: number;
    enrolledMembers: number;
    membersWithPredictions: number;
    neverPredicted: number;
    notEnrolled: number;
    upcomingOpenMatches: number;
    upcomingCoverageRate: number;
    participationRate: number;
}

interface LeagueParticipation {
    id: string;
    name: string;
    enrolledCount: number;
    predictedCount: number;
    participationRate: number;
}

interface UpcomingMatchCoverage {
    matchId: string;
    leagueId: string;
    leagueName: string;
    matchDate: string;
    homeTeam: string;
    awayTeam: string;
    enrolledCount: number;
    predictionCount: number;
    coverageRate: number;
    pendingCount: number;
}

interface ParticipationOverview {
    summary: ParticipationSummary;
    leagues: LeagueParticipation[];
    upcomingMatches: UpcomingMatchCoverage[];
    generatedAt: string;
}

interface MemberParticipation {
    userId: string;
    name: string;
    email: string;
    username: string;
    avatar: string | null;
    role: string;
    enrolledLeagues: number;
    totalPredictions: number;
    pendingPredictions: number;
    lastPredictionAt: string | null;
    status: 'never' | 'inactive' | 'partial' | 'active' | 'not_enrolled';
}

interface MembersResponse {
    data: MemberParticipation[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

const PAGE_SIZE = 25;

const STATUS_CONFIG = {
    active: { label: 'Al día', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    partial: { label: 'Pendientes', color: 'text-amber-600', bg: 'bg-amber-50' },
    never: { label: 'Sin pronósticos', color: 'text-red-600', bg: 'bg-red-50' },
    not_enrolled: { label: 'Sin inscribir', color: 'text-slate-500', bg: 'bg-slate-100' },
    inactive: { label: 'Inactivo', color: 'text-slate-500', bg: 'bg-slate-100' },
} as const;

const FILTER_OPTIONS = [
    { value: 'all', label: 'Todos' },
    { value: 'enrolled', label: 'Inscritos en pollas' },
    { value: 'with_predictions', label: 'Con pronósticos' },
    { value: 'without_predictions', label: 'Sin pronósticos' },
    { value: 'pending', label: 'Con pendientes' },
] as const;

function CoverageBar({ rate }: { rate: number }) {
    const color =
        rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500';
    return (
        <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, rate)}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-600 w-8 text-right">{rate}%</span>
        </div>
    );
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

function formatRelative(iso: string | null) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return 'Hace menos de 1h';
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
}

export default function AdminCorpParticipation() {
    const [overview, setOverview] = useState<ParticipationOverview | null>(null);
    const [members, setMembers] = useState<MemberParticipation[]>([]);
    const [membersTotal, setMembersTotal] = useState(0);
    const [membersHasMore, setMembersHasMore] = useState(false);
    const [loadingOverview, setLoadingOverview] = useState(true);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    const [leagueId, setLeagueId] = useState('');
    const [filter, setFilter] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);

    const loadOverview = useCallback(async (lid?: string) => {
        const qs = lid ? `?leagueId=${encodeURIComponent(lid)}` : '';
        return request<ParticipationOverview>(`/corp/participation${qs}`);
    }, []);

    const loadMembers = useCallback(async (opts: {
        page: number; leagueId: string; filter: string; search: string;
    }) => {
        const params = new URLSearchParams({
            page: String(opts.page),
            limit: String(PAGE_SIZE),
            filter: opts.filter,
        });
        if (opts.leagueId) params.set('leagueId', opts.leagueId);
        if (opts.search.length >= 2) params.set('search', opts.search);
        return request<MembersResponse>(`/corp/participation/members?${params}`);
    }, []);

    useEffect(() => {
        setLoadingOverview(true);
        setApiError(null);
        loadOverview(leagueId || undefined)
            .then(setOverview)
            .catch((err) => {
                setOverview(null);
                if (err instanceof ApiError && err.status === 404) {
                    setApiError('El backend corporativo aún no tiene desplegados los endpoints de participación. Redespliega api-corp desde main.');
                }
            })
            .finally(() => setLoadingOverview(false));
    }, [leagueId, loadOverview]);

    useEffect(() => {
        setLoadingMembers(true);
        loadMembers({ page, leagueId, filter, search })
            .then((res) => {
                setMembers(res.data);
                setMembersTotal(res.total);
                setMembersHasMore(res.hasMore);
            })
            .catch(() => {
                setMembers([]);
                setMembersTotal(0);
                setMembersHasMore(false);
            })
            .finally(() => setLoadingMembers(false));
    }, [page, leagueId, filter, search, loadMembers]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const [ov, mem] = await Promise.all([
                loadOverview(leagueId || undefined),
                loadMembers({ page, leagueId, filter, search }),
            ]);
            setOverview(ov);
            setMembers(mem.data);
            setMembersTotal(mem.total);
            setMembersHasMore(mem.hasMore);
        } finally {
            setRefreshing(false);
        }
    };

    const handleSearch = () => {
        setPage(1);
        setSearch(searchInput.trim());
    };

    const summary = overview?.summary;
    const totalPages = Math.max(1, Math.ceil(membersTotal / PAGE_SIZE));
    const selectedLeague = leagueId
        ? overview?.leagues.find((league) => league.id === leagueId)
        : undefined;
    const chartSegments = summary
        ? buildParticipationSegments(summary, selectedLeague)
        : [];
    const chartCenterLabel = selectedLeague
        ? `${selectedLeague.participationRate}%`
        : summary
            ? `${summary.participationRate}%`
            : '0%';
    const chartCenterSub = selectedLeague
        ? `${selectedLeague.predictedCount} de ${selectedLeague.enrolledCount} inscritos`
        : summary
            ? `${summary.membersWithPredictions} de ${summary.enrolledMembers} inscritos`
            : undefined;

    return (
        <CorpLayout>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Activity size={20} className="text-violet-600" />
                        <h1 className="text-2xl font-black text-slate-900">Seguimiento de participación</h1>
                    </div>
                    <p className="text-slate-500 text-sm">
                        Monitorea quién diligencia pronósticos vs. usuarios inscritos en las pollas
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 bg-white hover:bg-slate-50 transition-colors self-start"
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </div>

            {apiError && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <p className="font-bold">Backend desactualizado</p>
                    <p className="mt-1">{apiError}</p>
                </div>
            )}

            <Link
                to="/admin/matches"
                className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900 hover:bg-lime-100 transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white border border-lime-200 flex items-center justify-center shrink-0">
                        <Calculator size={18} className="text-lime-700" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-black text-slate-900">Partidos y puntajes</p>
                        <p className="text-xs text-lime-800">Recalcular puntos manualmente cuando un partido ya finalizó</p>
                    </div>
                </div>
                <span className="text-xs font-black uppercase tracking-wide text-lime-700 shrink-0">Abrir</span>
            </Link>

            {/* Filtro por polla */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4 flex flex-wrap items-center gap-3">
                <Filter size={16} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-600">Polla:</span>
                <select
                    value={leagueId}
                    onChange={(e) => { setLeagueId(e.target.value); setPage(1); }}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 bg-white"
                >
                    <option value="">Todas las pollas</option>
                    {(overview?.leagues ?? []).map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                </select>
                {overview?.generatedAt && (
                    <span className="text-xs text-slate-400 ml-auto">
                        Datos al {formatDate(overview.generatedAt)}
                    </span>
                )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    {
                        label: 'Miembros activos',
                        value: loadingOverview ? '—' : (summary?.totalMembers ?? 0),
                        sub: summary ? `${summary.enrolledMembers} inscritos en pollas` : '',
                        icon: Users,
                        color: 'text-sky-600',
                        bg: 'bg-sky-50',
                    },
                    {
                        label: 'Con pronósticos',
                        value: loadingOverview ? '—' : (summary?.membersWithPredictions ?? 0),
                        sub: summary ? `${summary.participationRate}% de inscritos` : '',
                        icon: CheckCircle2,
                        color: 'text-emerald-600',
                        bg: 'bg-emerald-50',
                    },
                    {
                        label: 'Sin pronósticos',
                        value: loadingOverview ? '—' : (summary?.neverPredicted ?? 0),
                        sub: summary ? `${summary.notEnrolled} sin inscribir` : '',
                        icon: XCircle,
                        color: 'text-red-600',
                        bg: 'bg-red-50',
                    },
                    {
                        label: 'Cobertura próximos',
                        value: loadingOverview ? '—' : `${summary?.upcomingCoverageRate ?? 0}%`,
                        sub: summary ? `${summary.upcomingOpenMatches} partidos abiertos` : '',
                        icon: Target,
                        color: 'text-violet-600',
                        bg: 'bg-violet-50',
                    },
                ].map(({ label, value, sub, icon: Icon, color, bg }) => (
                    <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${bg} ${color}`}>
                            <Icon size={17} />
                        </div>
                        <div className="text-2xl font-black text-slate-900">{value}</div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
                        {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 lg:items-stretch">
                {/* Por polla + gráfico */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[420px] lg:min-h-[480px]">
                    <div className="px-5 py-4 border-b border-slate-100 shrink-0">
                        <h2 className="font-black text-slate-900 flex items-center gap-2">
                            <BarChart2 size={16} className="text-violet-600" />
                            Participación por polla
                        </h2>
                    </div>
                    {loadingOverview ? (
                        <div className="flex-1 flex items-center justify-center p-8">
                            <Loader2 size={24} className="animate-spin text-slate-300" />
                        </div>
                    ) : !overview?.leagues.length ? (
                        <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-sm">
                            No hay pollas activas.
                        </div>
                    ) : (
                        <>
                            <div className="divide-y divide-slate-50 shrink-0 max-h-[168px] overflow-y-auto">
                                {overview.leagues.map((l) => {
                                    const isSelected = leagueId === l.id;
                                    return (
                                        <button
                                            key={l.id}
                                            type="button"
                                            onClick={() => { setLeagueId(isSelected ? '' : l.id); setPage(1); }}
                                            className={`w-full px-5 py-3.5 flex items-center gap-3 text-left transition-colors ${
                                                isSelected ? 'bg-violet-50/80' : 'hover:bg-slate-50/80'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-800 text-sm truncate">{l.name}</p>
                                                <p className="text-xs text-slate-400">
                                                    {l.predictedCount} de {l.enrolledCount} usuarios con pronósticos
                                                </p>
                                            </div>
                                            <CoverageBar rate={l.participationRate} />
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex-1 border-t border-slate-100 px-4 py-4 sm:px-5 sm:py-5 bg-gradient-to-b from-white to-slate-50/40">
                                <ParticipationBreakdownChart
                                    segments={chartSegments}
                                    centerLabel={chartCenterLabel}
                                    centerSub={chartCenterSub}
                                    title={selectedLeague ? selectedLeague.name : 'Vista global del tenant'}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Próximos partidos */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                        <h2 className="font-black text-slate-900 flex items-center gap-2">
                            <Clock size={16} className="text-amber-600" />
                            Cobertura por partido
                        </h2>
                    </div>
                    {loadingOverview ? (
                        <div className="p-8 flex justify-center">
                            <Loader2 size={24} className="animate-spin text-slate-300" />
                        </div>
                    ) : !overview?.upcomingMatches.length ? (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            No hay partidos abiertos para pronósticos.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50 max-h-[320px] overflow-y-auto">
                            {overview.upcomingMatches.map((m) => (
                                <div key={`${m.leagueId}-${m.matchId}`} className="px-5 py-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 text-sm">
                                                {m.homeTeam} vs {m.awayTeam}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate">
                                                {m.leagueName} · {formatDate(m.matchDate)}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs font-bold text-slate-700">
                                                {m.predictionCount}/{m.enrolledCount}
                                            </p>
                                            {m.pendingCount > 0 && (
                                                <p className="text-[10px] text-amber-600 font-bold">
                                                    {m.pendingCount} pendientes
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <CoverageBar rate={m.coverageRate} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabla de usuarios */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="font-black text-slate-900 flex items-center gap-2 mb-3">
                        <TrendingUp size={16} className="text-sky-600" />
                        Detalle por usuario
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar nombre, email o documento..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
                            />
                        </div>
                        <select
                            value={filter}
                            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
                        >
                            {FILTER_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleSearch}
                            className="px-4 py-2 rounded-xl text-sm font-bold text-black"
                            style={{ backgroundColor: 'var(--color-primary, #f59e0b)' }}
                        >
                            Buscar
                        </button>
                    </div>
                </div>

                <div className="relative">
                    {loadingMembers && (
                        <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                            <Loader2 size={24} className="animate-spin text-slate-400" />
                        </div>
                    )}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                                    <th className="px-5 py-3">Usuario</th>
                                    <th className="px-3 py-3">Estado</th>
                                    <th className="px-3 py-3 text-center">Pollas</th>
                                    <th className="px-3 py-3 text-center">Pronósticos</th>
                                    <th className="px-3 py-3 text-center">Pendientes</th>
                                    <th className="px-5 py-3">Último pronóstico</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {members.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                                            No se encontraron usuarios con los filtros aplicados.
                                        </td>
                                    </tr>
                                ) : members.map((m) => {
                                    const st = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.inactive;
                                    const avatarSrc = resolveApiAssetUrl(m.avatar);
                                    return (
                                        <tr key={m.userId} className="hover:bg-slate-50">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                                        {avatarSrc
                                                            ? <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                                                            : <span className="text-xs font-black text-slate-400">{m.name.charAt(0)}</span>}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-800 truncate">{m.name}</p>
                                                        <p className="text-xs text-slate-400 truncate">{m.username || m.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center font-bold text-slate-700">{m.enrolledLeagues}</td>
                                            <td className="px-3 py-3 text-center font-bold text-slate-700">{m.totalPredictions}</td>
                                            <td className="px-3 py-3 text-center">
                                                {m.pendingPredictions > 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                                                        <AlertCircle size={12} />
                                                        {m.pendingPredictions}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-600 font-bold">0</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-xs text-slate-500">
                                                {formatRelative(m.lastPredictionAt)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                        {membersTotal.toLocaleString()}{membersHasMore ? '+' : ''} usuarios
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs font-bold text-slate-600">
                            {page} / {totalPages}
                        </span>
                        <button
                            disabled={page >= totalPages && !membersHasMore}
                            onClick={() => setPage((p) => p + 1)}
                            className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </CorpLayout>
    );
}
