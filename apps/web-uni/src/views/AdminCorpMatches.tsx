import React, { useCallback, useEffect, useState } from 'react';
import {
    Calculator, ChevronLeft, ChevronRight, Loader2, RefreshCw,
    Search, Trophy, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request, ApiError } from '../api';
import { useAuthStore } from '../stores/auth.store';

type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';

interface CorpMatchRow {
    id: string;
    matchDate: string;
    status: MatchStatus;
    phase: string;
    homeScore: number | null;
    awayScore: number | null;
    externalId: string | null;
    lastSyncAt: string | null;
    syncCount: number;
    statusShort: string | null;
    homeTeam: { id: string; name: string; shortCode?: string | null; code?: string | null };
    awayTeam: { id: string; name: string; shortCode?: string | null; code?: string | null };
    predictionCount: number;
    scoredPredictionCount: number;
    canRecalculate: boolean;
    needsScoring: boolean;
}

interface MatchListResponse {
    data: CorpMatchRow[];
    total: number;
    page: number;
    limit: number;
}

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<MatchStatus, string> = {
    SCHEDULED: 'Programado',
    LIVE: 'En vivo',
    FINISHED: 'Finalizado',
    POSTPONED: 'Pospuesto',
    CANCELLED: 'Cancelado',
};

const STATUS_CHIP: Record<MatchStatus, string> = {
    SCHEDULED: 'bg-blue-50 text-blue-700',
    LIVE: 'bg-rose-50 text-rose-700',
    FINISHED: 'bg-emerald-50 text-emerald-700',
    POSTPONED: 'bg-amber-50 text-amber-700',
    CANCELLED: 'bg-slate-100 text-slate-600',
};

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function teamLabel(team: CorpMatchRow['homeTeam']) {
    return team.shortCode || team.code || team.name;
}

export default function AdminCorpMatches() {
    const tenantRole = useAuthStore((s) => s.user?.tenantRole ?? '');
    const canManage = ['OWNER', 'ADMIN', 'STAFF'].includes(tenantRole);
    const [rows, setRows] = useState<CorpMatchRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<MatchStatus | ''>('FINISHED');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchRows = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(PAGE_SIZE),
            });
            if (statusFilter) params.set('status', statusFilter);
            const res = await request<MatchListResponse>(`/corp/matches/operations?${params}`);
            setRows(res.data);
            setTotal(res.total);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los partidos.');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        if (!canManage) {
            setLoading(false);
            return;
        }
        fetchRows();
    }, [canManage, fetchRows]);

    const filteredRows = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((m) =>
            m.homeTeam.name.toLowerCase().includes(q) ||
            m.awayTeam.name.toLowerCase().includes(q) ||
            (m.externalId ?? '').includes(q),
        );
    }, [rows, search]);

    const pendingScoring = rows.filter((m) => m.needsScoring).length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    async function handleRecalculate(match: CorpMatchRow) {
        if (!window.confirm(`¿Recalcular puntos de ${match.homeTeam.name} vs ${match.awayTeam.name}?`)) return;
        setRecalculatingId(match.id);
        setFeedback(null);
        setError(null);
        try {
            const res = await request<{ ok: boolean; scoredPredictionCount: number }>(
                `/corp/matches/${match.id}/recalculate`,
                { method: 'POST' },
            );
            setFeedback(
                `Puntos recalculados: ${match.homeTeam.name} vs ${match.awayTeam.name} (${res.scoredPredictionCount} pronósticos puntuados).`,
            );
            await fetchRows();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudo recalcular el partido.');
        } finally {
            setRecalculatingId(null);
        }
    }

    if (!canManage) {
        return (
            <CorpLayout>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
                    <AlertTriangle size={32} className="mx-auto mb-3 text-amber-500" />
                    <h2 className="font-black text-slate-900 mb-1">Acceso restringido</h2>
                    <p className="text-slate-500 text-sm">Tu rol no tiene permisos para operar partidos.</p>
                </div>
            </CorpLayout>
        );
    }

    return (
        <CorpLayout>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Trophy size={20} className="text-amber-600" />
                        <h1 className="text-2xl font-black text-slate-900">Partidos y puntajes</h1>
                    </div>
                    <p className="text-slate-500 text-sm">
                        Los puntos se calculan automáticamente al sincronizar el marcador final. Usa recálculo manual solo si hace falta corregir.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => fetchRows()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Actualizar lista
                </button>
            </div>

            {pendingScoring > 0 && statusFilter === 'FINISHED' && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                        {pendingScoring} partido{pendingScoring !== 1 ? 's' : ''} finalizado{pendingScoring !== 1 ? 's' : ''} con pronósticos sin puntuar en esta página.
                    </span>
                </div>
            )}

            {feedback && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    {feedback}
                </div>
            )}

            {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar equipo o fixture ID…"
                        className="w-full pl-8 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as MatchStatus | ''); setPage(1); }}
                    className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 min-w-[160px]"
                >
                    <option value="">Todos los estados</option>
                    {(Object.keys(STATUS_LABELS) as MatchStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                </select>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-black text-slate-800 text-sm">Partidos en pollas corporativas</h2>
                    <span className="text-xs font-bold text-slate-400">{total.toLocaleString()} total</span>
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center">
                        <Loader2 size={28} className="animate-spin text-slate-300" />
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">Sin partidos para mostrar.</div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filteredRows.map((match) => (
                            <div key={match.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-slate-900 text-sm">
                                            {teamLabel(match.homeTeam)} vs {teamLabel(match.awayTeam)}
                                        </p>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${STATUS_CHIP[match.status]}`}>
                                            {STATUS_LABELS[match.status]}
                                        </span>
                                        {match.needsScoring && (
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                                Sin puntuar
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {formatDateTime(match.matchDate)} · {match.phase}
                                        {match.homeScore != null && match.awayScore != null && (
                                            <> · Resultado <span className="font-bold text-slate-600">{match.homeScore}–{match.awayScore}</span></>
                                        )}
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Pronósticos: {match.scoredPredictionCount}/{match.predictionCount} puntuados
                                        {match.externalId && <> · Fixture {match.externalId}</>}
                                        {match.lastSyncAt && <> · Sync {formatDateTime(match.lastSyncAt)}</>}
                                    </p>
                                </div>
                                <div className="shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleRecalculate(match)}
                                        disabled={!match.canRecalculate || recalculatingId === match.id}
                                        title={match.canRecalculate ? 'Recalcular puntos manualmente' : 'Disponible cuando el partido tenga marcador final'}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-lime-300 bg-lime-50 px-3 py-2 text-xs font-bold text-lime-800 hover:bg-lime-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {recalculatingId === match.id
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <Calculator size={14} />}
                                        Calcular puntos
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                        Página {page} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40"
                        >
                            <ChevronLeft size={14} /> Anterior
                        </button>
                        <button
                            type="button"
                            disabled={page >= totalPages || loading}
                            onClick={() => setPage((p) => p + 1)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-40"
                        >
                            Siguiente <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </CorpLayout>
    );
}
