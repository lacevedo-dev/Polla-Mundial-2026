import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Medal, Search, Trophy } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request, resolveApiAssetUrl } from '../api';
import {
    buildPointsResume,
    PointsBreakdown,
    type PointDetail,
} from '../components/PointsBreakdown';

interface RankingEntry {
    rank: number;
    userId: string;
    name: string;
    username: string;
    avatar: string | null;
    totalPoints: number;
    isMe: boolean;
}

interface BreakdownMatch {
    id: string;
    leagueId: string;
    leagueName: string;
    points: number;
    submittedAt: string;
    pointDetail: PointDetail | null;
    prediction: { homeScore: number; awayScore: number };
    match: {
        id: string;
        matchDate: string;
        phase: string;
        group: string | null;
        homeScore: number | null;
        awayScore: number | null;
        homeTeam: string;
        awayTeam: string;
    };
}

interface RankingBreakdown {
    user: { id: string; name: string; username: string; avatar: string | null };
    summary: {
        points: number;
        exactCount: number;
        winnerCount: number;
        goalCount: number;
        uniqueCount: number;
        phaseBonusPoints: number;
    };
    matches: BreakdownMatch[];
    bonuses: Array<{ id: string; phase: string; points: number; awardedAt: string }>;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RANKING_LIMIT = 50;

const POINTS_LEGEND = [
    { code: 'ME', label: 'Marcador exacto' },
    { code: 'GA', label: 'Ganador acertado' },
    { code: 'GoA', label: 'Gol acertado' },
    { code: 'Pu', label: 'Predicción única' },
] as const;

function formatMatchDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function Ranking() {
    const [entries, setEntries] = useState<RankingEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [breakdowns, setBreakdowns] = useState<Record<string, RankingBreakdown>>({});
    const [loadingBreakdownId, setLoadingBreakdownId] = useState<string | null>(null);

    useEffect(() => {
        request<RankingEntry[]>('/corp/ranking')
            .then(setEntries)
            .catch(() => setEntries([]))
            .finally(() => setLoading(false));
    }, []);

    const loadBreakdown = useCallback(async (userId: string) => {
        if (breakdowns[userId]) return;
        setLoadingBreakdownId(userId);
        try {
            const data = await request<RankingBreakdown>(`/corp/ranking/user/${userId}/breakdown`);
            setBreakdowns((prev) => ({ ...prev, [userId]: data }));
        } catch {
            /* ignore */
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
                    Toca un participante para ver partido a partido por qué sumó puntos.
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
                            const breakdown = breakdowns[entry.userId];
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
                                            {loadingBreakdownId === entry.userId && !breakdown ? (
                                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                                    <Loader2 size={16} className="animate-spin" /> Cargando detalle…
                                                </div>
                                            ) : !breakdown || breakdown.matches.length === 0 ? (
                                                <p className="text-sm text-slate-500">Sin pronósticos puntuados todavía.</p>
                                            ) : (
                                                <>
                                                    <p className="text-sm font-semibold text-slate-600 mb-3">
                                                        {buildPointsResume(breakdown.summary)}
                                                    </p>
                                                    <div className="space-y-2">
                                                        {breakdown.matches.map((row) => (
                                                            <div key={row.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-black text-slate-900 truncate">
                                                                            {row.match.homeTeam} vs {row.match.awayTeam}
                                                                        </p>
                                                                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                                            {formatMatchDate(row.match.matchDate)}
                                                                            {row.match.group ? ` · Grupo ${row.match.group}` : ` · ${row.match.phase}`}
                                                                            {' · '}{row.leagueName}
                                                                        </p>
                                                                        <p className="mt-1 text-[11px] text-slate-500">
                                                                            Pronóstico {row.prediction.homeScore}–{row.prediction.awayScore}
                                                                            {row.match.homeScore != null && row.match.awayScore != null && (
                                                                                <> · Resultado {row.match.homeScore}–{row.match.awayScore}</>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                    <div className="shrink-0 text-right">
                                                                        <p className="text-lg font-black text-lime-600">{row.points}</p>
                                                                        <p className="text-[10px] font-bold uppercase text-slate-400">pts</p>
                                                                    </div>
                                                                </div>
                                                                {row.pointDetail && (
                                                                    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                                                        <PointsBreakdown detail={row.pointDetail} light />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
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
