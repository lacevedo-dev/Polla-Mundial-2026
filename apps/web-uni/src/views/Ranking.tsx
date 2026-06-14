import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Medal, Search, Trophy } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request, resolveApiAssetUrl, ApiError } from '../api';
import { buildPointsResume, PointsBreakdown } from '../components/PointsBreakdown';
import { Tooltip } from '../components/Tooltip';
import {
    toCorpRankingBreakdown,
    type CorpRankingBreakdown,
    type CorpRankingBreakdownApiResponse,
} from '../utils/rankingBreakdown';

interface RankingEntry {
    rank: number;
    userId: string;
    name: string;
    username: string;
    avatar: string | null;
    totalPoints: number;
    isMe: boolean;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RANKING_LIMIT = 50;

const POINTS_LEGEND = [
    { code: 'ME', label: 'Marcador exacto' },
    { code: 'GA', label: 'Ganador acertado' },
    { code: 'GoA', label: 'Gol acertado' },
    { code: 'Pu', label: 'Predicción única' },
] as const;

function BreakdownPanel({
    entry,
    breakdown,
    loading,
    error,
    onRetry,
}: {
    entry: RankingEntry;
    breakdown?: CorpRankingBreakdown;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    if (loading && !breakdown) {
        return (
            <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Cargando detalle…
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                <p>{error}</p>
                <button type="button" onClick={onRetry} className="mt-2 text-xs font-bold underline">
                    Reintentar
                </button>
            </div>
        );
    }

    if (!breakdown || (!breakdown.matches.length && !breakdown.bonuses.length)) {
        if (entry.totalPoints > 0) {
            return (
                <p className="text-sm text-slate-500">
                    Hay {entry.totalPoints} pts en el ranking, pero aún no hay detalle partido a partido disponible.
                </p>
            );
        }
        return <p className="text-sm text-slate-500">Sin pronósticos puntuados todavía.</p>;
    }

    return (
        <>
            <p className="text-sm font-semibold text-slate-600 mb-3">
                {buildPointsResume(breakdown.summary)}
            </p>
            <div className="space-y-2">
                {breakdown.matches.map((match) => (
                    <div key={match.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <img src={match.homeFlag} alt="" className="h-5 w-7 rounded object-cover" />
                                    <span className="text-[10px] font-black uppercase text-slate-500">{match.homeTeamCode}</span>
                                    <span className="text-[10px] font-bold text-slate-300">vs</span>
                                    <img src={match.awayFlag} alt="" className="h-5 w-7 rounded object-cover" />
                                    <span className="text-[10px] font-black uppercase text-slate-500">{match.awayTeamCode}</span>
                                </div>
                                <p className="truncate text-sm font-black text-slate-900">
                                    {match.homeTeam} vs {match.awayTeam}
                                </p>
                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                    {match.displayDate} · {match.group ? `Grupo ${match.group}` : match.phase} · {match.leagueName}
                                </p>
                                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                    Pronóstico {match.predictionHome}–{match.predictionAway}
                                    {typeof match.resultHome === 'number' && typeof match.resultAway === 'number' && (
                                        <> · Resultado {match.resultHome}–{match.resultAway}</>
                                    )}
                                </p>
                                <p className="mt-2 text-[11px] font-semibold text-slate-600">{match.summaryLabel}</p>
                            </div>
                            <div className="text-right shrink-0">
                                {match.pointDetail ? (
                                    <Tooltip content={<PointsBreakdown detail={match.pointDetail} />}>
                                        <div className="cursor-help">
                                            <p className="text-lg font-black text-lime-600 underline decoration-dotted decoration-2 underline-offset-4">
                                                {match.points}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">pts</p>
                                        </div>
                                    </Tooltip>
                                ) : (
                                    <>
                                        <p className="text-lg font-black text-lime-600">{match.points}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">pts</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {breakdown.bonuses.length > 0 && (
                <div className="mt-3 space-y-2">
                    {breakdown.bonuses.map((bonus) => (
                        <div key={bonus.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-black text-amber-900">Bono de fase</p>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">{bonus.phase}</p>
                            </div>
                            <p className="text-lg font-black text-amber-700">+{bonus.points}</p>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

export default function Ranking() {
    const [entries, setEntries] = useState<RankingEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [breakdowns, setBreakdowns] = useState<Record<string, CorpRankingBreakdown>>({});
    const [breakdownErrors, setBreakdownErrors] = useState<Record<string, string>>({});
    const [loadingBreakdownId, setLoadingBreakdownId] = useState<string | null>(null);

    useEffect(() => {
        request<RankingEntry[]>('/corp/ranking')
            .then(setEntries)
            .catch(() => setEntries([]))
            .finally(() => setLoading(false));
    }, []);

    const loadBreakdown = useCallback(async (userId: string, force = false) => {
        if (!force && breakdowns[userId]) return;
        setLoadingBreakdownId(userId);
        setBreakdownErrors((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
        });
        try {
            const data = await request<CorpRankingBreakdownApiResponse>(`/corp/ranking/user/${userId}/breakdown`);
            setBreakdowns((prev) => ({ ...prev, [userId]: toCorpRankingBreakdown(data) }));
        } catch (err) {
            const message = err instanceof ApiError
                ? err.message
                : 'No se pudo cargar el detalle de puntos.';
            setBreakdownErrors((prev) => ({ ...prev, [userId]: message }));
        } finally {
            setLoadingBreakdownId(null);
        }
    }, [breakdowns]);

    const toggleUser = (userId: string) => {
        if (expandedUserId === userId) {
            setExpandedUserId(null);
            return;
        }
        setExpandedUserId(userId);
        void loadBreakdown(userId);
    };

    const filtered = entries
        .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, RANKING_LIMIT);

    const myEntry = entries.find((e) => e.isMe);
    const expandedBreakdown = expandedUserId ? breakdowns[expandedUserId] : undefined;

    return (
        <CorpLayout>
            <div className="mb-6">
                <h1 className="text-2xl font-black text-slate-900">Ranking</h1>
                <p className="text-slate-500 text-sm mt-1">
                    Clasificación general de tu organización
                    {entries.length > RANKING_LIMIT && ` · Mostrando top ${RANKING_LIMIT}`}
                </p>
            </div>

            {myEntry && (
                <div className="rounded-2xl p-4 mb-5 flex items-center gap-4 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, var(--color-primary, #f59e0b), color-mix(in srgb, var(--color-primary, #f59e0b) 70%, black))' }}>
                    <div className="text-3xl font-black">#{myEntry.rank}</div>
                    <div className="flex-1">
                        <p className="font-black text-sm">Tu posición</p>
                        <p className="text-white/70 text-xs">{myEntry.totalPoints} puntos acumulados</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => toggleUser(myEntry.userId)}
                        className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25 transition-colors"
                    >
                        Ver detalle
                    </button>
                </div>
            )}

            <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Cómo leer los puntos</p>
                <p className="mt-1 text-xs text-slate-500">
                    Toca un participante para ver partido a partido por qué sumó puntos. Pasa el cursor sobre los puntos para el desglose técnico.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                    {POINTS_LEGEND.map((item) => (
                        <span
                            key={item.code}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500"
                        >
                            {item.code}: {item.label}
                        </span>
                    ))}
                </div>
            </div>

            <div className="relative mb-4">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar participante..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[2rem_1fr_auto_1.5rem] gap-3 px-4 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-50">
                    <span>#</span>
                    <span>Participante</span>
                    <span className="text-right">Puntos</span>
                    <span />
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-7 h-7 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary, #f59e0b)', borderTopColor: 'transparent' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                        <Medal size={32} className="mx-auto mb-2 opacity-30" />
                        Sin datos aún
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map((entry) => {
                            const expanded = expandedUserId === entry.userId;
                            return (
                                <div key={entry.userId}>
                                    <button
                                        type="button"
                                        onClick={() => toggleUser(entry.userId)}
                                        className={`w-full grid grid-cols-[2rem_1fr_auto_1.5rem] gap-3 px-4 py-3 items-center text-left transition-colors ${entry.isMe ? '' : 'hover:bg-slate-50'}`}
                                        style={entry.isMe ? { backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 8%, white)' } : {}}
                                    >
                                        <div className="text-sm font-black text-slate-500">
                                            {MEDAL[entry.rank] ?? entry.rank}
                                        </div>
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                                {resolveApiAssetUrl(entry.avatar) ? (
                                                    <img src={resolveApiAssetUrl(entry.avatar)!} alt={entry.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xs font-black text-slate-400">{entry.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm truncate" style={entry.isMe ? { color: 'var(--color-primary, #f59e0b)' } : { color: '#1e293b' }}>
                                                    {entry.name}
                                                    {entry.isMe && <span className="ml-1 text-[10px] font-black opacity-70">(tú)</span>}
                                                </p>
                                                <p className="text-[10px] text-slate-400 truncate">@{entry.username}</p>
                                            </div>
                                        </div>
                                        <div className="text-sm font-black text-right" style={entry.isMe ? { color: 'var(--color-primary, #f59e0b)' } : { color: '#0f172a' }}>
                                            {entry.totalPoints}
                                        </div>
                                        <div className="text-slate-400">
                                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                    </button>

                                    {expanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4">
                                            <BreakdownPanel
                                                entry={entry}
                                                breakdown={breakdowns[entry.userId]}
                                                loading={loadingBreakdownId === entry.userId}
                                                error={breakdownErrors[entry.userId] ?? null}
                                                onRetry={() => void loadBreakdown(entry.userId, true)}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {expandedBreakdown && expandedUserId && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800">
                    <Trophy size={16} />
                    <span>
                        Total detallado: <strong>{expandedBreakdown.summary.points} pts</strong>
                    </span>
                </div>
            )}
        </CorpLayout>
    );
}
