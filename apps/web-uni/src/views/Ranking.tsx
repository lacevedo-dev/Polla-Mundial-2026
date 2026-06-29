import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Medal, Search, Trophy } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request, resolveApiAssetUrl } from '../api';
import { RankingSkeleton } from '../components/RankingSkeleton';
import { RankingGuidePanel } from '../components/RankingGuidePanel';
import { RankingTiebreakSummary } from '../components/RankingTiebreakSummary';
import { useRankingStore } from '../stores/ranking.store';
import type {
    CorpRankingEntry,
    LeaderboardCategory,
    RankingBreakdownResponse,
} from './ranking.types';
import { PhaseBonusProgressIndicator } from '../components/PhaseBonusProgressIndicator';
import {
    buildPointsResume,
    formatPhaseLabel,
    toDisplayDate,
    toPointSummaryLabel,
} from './ranking.utils';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function avatarFallback(name: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e2e8f0&color=64748b&size=128`;
}

function BreakdownPanel({
    breakdown,
    loading,
}: {
    breakdown: RankingBreakdownResponse | null;
    loading: boolean;
}) {
    if (loading) {
        return <p className="px-4 py-3 text-sm text-slate-500">Cargando detalle...</p>;
    }
    if (!breakdown || (!breakdown.matches.length && !breakdown.bonuses.length && !breakdown.phaseBonusProgress?.length)) {
        return <p className="px-4 py-3 text-sm text-slate-500">Sin detalle disponible para esta categoría.</p>;
    }

    return (
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 space-y-2">
            {breakdown.phaseBonusProgress && breakdown.phaseBonusProgress.length > 0 && (
                <PhaseBonusProgressIndicator items={breakdown.phaseBonusProgress} compact />
            )}
            {breakdown.matches.map((match) => (
                <div key={match.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">
                                {match.match.homeTeam.name} vs {match.match.awayTeam.name}
                            </p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-0.5">
                                {toDisplayDate(match.match.matchDate)}
                                {match.match.group ? ` · Grupo ${match.match.group}` : ` · ${formatPhaseLabel(match.match.phase)}`}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1">
                                Pronóstico {match.prediction.homeScore}-{match.prediction.awayScore}
                                {typeof match.match.homeScore === 'number' && typeof match.match.awayScore === 'number'
                                    ? ` · Resultado ${match.match.homeScore}-${match.match.awayScore}`
                                    : ''}
                            </p>
                            <p className="text-[11px] font-medium text-slate-600 mt-1">
                                {toPointSummaryLabel(match.pointDetail)}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-base font-black" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                                {match.points}
                            </p>
                            <p className="text-[10px] font-bold uppercase text-slate-400">pts</p>
                        </div>
                    </div>
                </div>
            ))}
            {breakdown.bonuses.map((bonus) => (
                <div key={bonus.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-bold text-amber-900">Bono de fase</p>
                        <p className="text-[10px] font-semibold uppercase text-amber-700">{formatPhaseLabel(bonus.phase)}</p>
                    </div>
                    <p className="text-base font-black text-amber-700">+{bonus.points}</p>
                </div>
            ))}
        </div>
    );
}

export default function Ranking() {
    const fetchRanking = useRankingStore((state) => state.fetchRanking);
    const isLoadingCategory = useRankingStore((state) => state.isLoadingCategory);

    const [category, setCategory] = useState<LeaderboardCategory>('GENERAL');
    const [search, setSearch] = useState('');
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [breakdowns, setBreakdowns] = useState<Record<string, RankingBreakdownResponse>>({});
    const [loadingBreakdownId, setLoadingBreakdownId] = useState<string | null>(null);

    const data = useRankingStore((state) => state.cache[category]?.data ?? null);
    const loading = isLoadingCategory(category) && !data;

    useEffect(() => {
        let cancelled = false;

        void fetchRanking(category).then((payload) => {
            if (cancelled || !payload?.category || payload.category === category) return;
            setCategory(payload.category);
        });

        return () => {
            cancelled = true;
        };
    }, [category, fetchRanking]);

    const entries = data?.entries ?? [];
    const tournamentStarted = useMemo(
        () => category !== 'GENERAL'
            ? entries.length > 0
            : entries.some((entry) => entry.totalPoints > 0),
        [category, entries],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter((entry) =>
            `${entry.name} ${entry.username}`.toLowerCase().includes(q),
        );
    }, [entries, search]);

    const myEntry = useMemo(
        () => entries.find((entry) => entry.isMe) ?? null,
        [entries],
    );

    const entryNeighbors = useMemo(() => {
        const map = new Map<string, { previous: CorpRankingEntry | null; next: CorpRankingEntry | null }>();
        entries.forEach((entry, index) => {
            map.set(entry.userId, {
                previous: index > 0 ? entries[index - 1] : null,
                next: index < entries.length - 1 ? entries[index + 1] : null,
            });
        });
        return map;
    }, [entries]);

    const toggleBreakdown = useCallback(async (entry: CorpRankingEntry) => {
        if (expandedUserId === entry.userId) {
            setExpandedUserId(null);
            return;
        }

        setExpandedUserId(entry.userId);
        const cacheKey = `${category}:${entry.userId}`;
        if (breakdowns[cacheKey]) return;

        setLoadingBreakdownId(entry.userId);
        try {
            const query = category !== 'GENERAL' ? `?category=${encodeURIComponent(category)}` : '';
            const breakdown = await request<RankingBreakdownResponse>(
                `/corp/ranking/users/${entry.userId}${query}`,
            );
            setBreakdowns((prev) => ({ ...prev, [cacheKey]: breakdown }));
        } catch {
            /* detalle opcional */
        } finally {
            setLoadingBreakdownId((current) => (current === entry.userId ? null : current));
        }
    }, [breakdowns, category, expandedUserId]);

    return (
        <CorpLayout>
            <div className="mb-5">
                <h1 className="text-2xl font-black text-slate-900">Ranking</h1>
                <p className="text-slate-500 text-sm mt-1">
                    {data?.league
                        ? <>Clasificación de <span className="font-bold text-slate-700">{data.league.name}</span></>
                        : loading
                            ? 'Cargando clasificación...'
                            : 'Clasificación de la polla activa'}
                    {data && data.totalParticipants > data.limit
                        ? ` · Top ${data.limit} de ${data.totalParticipants} participantes`
                        : data && data.totalParticipants > 0
                            ? ` · ${data.totalParticipants} participante${data.totalParticipants !== 1 ? 's' : ''}`
                            : ''}
                    {data?.league && !tournamentStarted ? ' · Torneo aún no iniciado' : ''}
                </p>
            </div>

            {!loading && !data?.league && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center mb-5">
                    <Trophy size={32} className="mx-auto mb-2 text-slate-200" />
                    <p className="font-bold text-slate-900">Sin polla activa</p>
                    <p className="text-sm text-slate-400 mt-1">El administrador debe activar una polla para ver el ranking.</p>
                </div>
            )}

            {data?.availableCategories && data.availableCategories.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {data.availableCategories.map((item) => {
                        const selected = item.id === (data.category ?? category);
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setExpandedUserId(null);
                                    setCategory(item.id);
                                }}
                                aria-pressed={selected}
                                className={`rounded-xl border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors ${
                                    selected
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                }`}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            )}

            <RankingGuidePanel />

            {myEntry && tournamentStarted && (
                <div
                    className="rounded-2xl p-4 mb-4 flex items-center gap-4 text-white shadow-lg"
                    style={{
                        background: 'linear-gradient(135deg, var(--color-primary, #f59e0b), color-mix(in srgb, var(--color-primary, #f59e0b) 70%, black))',
                    }}
                >
                    <div className="text-3xl font-black">#{myEntry.rank}</div>
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-sm">Tu posición</p>
                        <p className="text-white/70 text-xs truncate">{buildPointsResume(myEntry)}</p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-2xl font-black">{myEntry.totalPoints}</p>
                        <p className="text-[10px] font-bold uppercase text-white/60">pts</p>
                    </div>
                </div>
            )}

            <div className="relative mb-4">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="search"
                    placeholder="Buscar participante..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 transition-colors"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[2.5rem_1fr_auto_2rem] gap-2 px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-50">
                    <span>#</span>
                    <span>Participante</span>
                    <span className="text-right">Puntos</span>
                    <span className="sr-only">Detalle</span>
                </div>

                {loading ? (
                    <RankingSkeleton />
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                        <Medal size={32} className="mx-auto mb-2 opacity-30" />
                        {search.trim() ? 'Sin resultados para tu búsqueda' : 'Sin datos aún'}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map((entry) => {
                            const expanded = expandedUserId === entry.userId;
                            const cacheKey = `${data?.category ?? category}:${entry.userId}`;
                            const neighbors = entryNeighbors.get(entry.userId);
                            return (
                                <div key={entry.userId}>
                                    <button
                                        type="button"
                                        onClick={() => void toggleBreakdown(entry)}
                                        className={`w-full grid grid-cols-[2.5rem_1fr_auto_2rem] gap-2 px-4 py-3 items-start text-left transition-colors ${
                                            entry.isMe ? '' : 'hover:bg-slate-50'
                                        }`}
                                        style={entry.isMe
                                            ? { backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 8%, white)' }
                                            : undefined}
                                    >
                                        <div className="text-sm font-black text-slate-500 pt-0.5">
                                            {MEDAL[entry.rank] ?? entry.rank}
                                        </div>
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                                <img
                                                    src={resolveApiAssetUrl(entry.avatar) ?? avatarFallback(entry.name)}
                                                    alt={entry.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <p
                                                    className="font-bold text-sm truncate"
                                                    style={entry.isMe
                                                        ? { color: 'var(--color-primary, #f59e0b)' }
                                                        : { color: '#1e293b' }}
                                                >
                                                    {entry.name}
                                                    {entry.hasChampion && (
                                                        <Trophy size={12} className="inline ml-1 text-amber-500" aria-label="Acertó el campeón" />
                                                    )}
                                                    {entry.isMe && <span className="ml-1 text-[10px] font-black opacity-70">(tú)</span>}
                                                </p>
                                                <RankingTiebreakSummary
                                                    entry={entry}
                                                    previous={neighbors?.previous ?? null}
                                                    next={neighbors?.next ?? null}
                                                />
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 pt-0.5">
                                            <p
                                                className="text-sm font-black"
                                                style={entry.isMe
                                                    ? { color: 'var(--color-primary, #f59e0b)' }
                                                    : { color: '#0f172a' }}
                                            >
                                                {entry.totalPoints}
                                            </p>
                                            {entry.phaseBonusPoints > 0 && (
                                                <p className="text-[9px] font-bold text-amber-600">+{entry.phaseBonusPoints} bono</p>
                                            )}
                                        </div>
                                        <div className="flex justify-center text-slate-300 pt-1">
                                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                    </button>
                                    {expanded && (
                                        <BreakdownPanel
                                            breakdown={breakdowns[cacheKey] ?? null}
                                            loading={loadingBreakdownId === entry.userId && !breakdowns[cacheKey]}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </CorpLayout>
    );
}
