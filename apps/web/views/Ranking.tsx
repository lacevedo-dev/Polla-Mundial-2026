import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Search, Trophy, Medal, TrendingUp, TrendingDown, Minus, Crown, Users, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore, type LeaderboardRow } from '../stores/prediction.store';
import type { LeaderboardBreakdown, LeaderboardCategory } from '../stores/prediction.adapters';
import { useAuthStore } from '../stores/auth.store';
import { Tooltip } from '../components/ui/Tooltip';
import { PointsBreakdown, type PointDetail } from '../components/ui/PointsBreakdown';
import { RankingGuidePanel } from '../components/ranking/RankingGuidePanel';
import {
    RankingTiebreakSummary,
    leaderboardToTiebreakEntry,
    type TiebreakSummaryEntry,
} from '../components/ranking/RankingTiebreakSummary';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function avatarUrl(row: LeaderboardRow): string {
    return row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=e2e8f0&color=64748b&size=128`;
}

function TrendIcon({ trend }: { trend: LeaderboardRow['trend'] }) {
    if (trend === 'same') return <Minus className="h-3 w-3 text-slate-300" aria-hidden="true" />;
    if ((trend as string) === 'up') return <TrendingUp className="h-3 w-3 text-lime-500" aria-hidden="true" />;
    return <TrendingDown className="h-3 w-3 text-rose-500" aria-hidden="true" />;
}

// ─── compact podium stage ───────────────────────────────────────────────────

const PodiumFirst: React.FC<{ player: LeaderboardRow; onSelect?: (id: string) => void }> = ({ player, onSelect }) => (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="order-1 md:order-2">
        <button
            type="button"
            onClick={() => onSelect?.(player.id)}
            className="relative block w-full overflow-hidden rounded-2xl md:rounded-[2.5rem] bg-slate-900 p-3 md:p-6 text-center shadow-xl"
        >
            <div className="absolute left-0 top-0 h-1 w-full bg-lime-400" />
            <div className="relative mb-2 md:mb-4 inline-block">
                <div className="absolute -top-5 md:-top-7 left-1/2 -translate-x-1/2">
                    <Crown className="h-5 w-5 md:h-7 md:w-7 fill-lime-400 text-lime-400" aria-hidden="true" />
                </div>
                <img
                    src={avatarUrl(player)}
                    alt=""
                    className="mx-auto h-14 w-14 md:h-24 md:w-24 rounded-full object-cover shadow-xl ring-2 md:ring-4 ring-lime-400/30"
                />
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 md:h-9 md:w-9 items-center justify-center rounded-xl border-2 md:border-4 border-slate-900 bg-lime-400">
                    <Trophy className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-900" aria-hidden="true" />
                </div>
            </div>
            <h3 className="truncate text-xs md:text-lg font-black text-white">{player.name}</h3>
            <p className="mb-1 md:mb-3 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-lime-400/60">@{player.username}</p>
            <div className="flex items-center justify-center gap-1.5 md:gap-2">
                <span className="text-2xl md:text-4xl font-black text-white">{player.points}</span>
                <span className="text-[8px] md:text-[10px] font-black uppercase text-lime-400">pts</span>
            </div>
        </button>
    </motion.div>
);

const PodiumSecond: React.FC<{ player: LeaderboardRow; onSelect?: (id: string) => void }> = ({ player, onSelect }) => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="order-2 md:order-1">
        <button
            type="button"
            onClick={() => onSelect?.(player.id)}
            className="relative block w-full overflow-hidden rounded-2xl md:rounded-[2rem] border border-slate-100 bg-white p-3 md:p-5 text-center shadow-sm"
        >
            <div className="absolute left-0 top-0 h-0.5 md:h-1 w-full bg-slate-300" />
            <img src={avatarUrl(player)} alt="" className="mx-auto mb-2 h-11 w-11 md:h-16 md:w-16 rounded-full object-cover ring-2 ring-slate-50" />
            <h3 className="truncate text-[11px] md:text-base font-black text-slate-900">{player.name}</h3>
            <p className="text-[8px] md:text-[10px] font-bold uppercase text-slate-400">#{player.rank}</p>
            <p className="mt-1 text-lg md:text-2xl font-black text-slate-900">{player.points}</p>
        </button>
    </motion.div>
);

const PodiumThird: React.FC<{ player: LeaderboardRow; onSelect?: (id: string) => void }> = ({ player, onSelect }) => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="order-3">
        <button
            type="button"
            onClick={() => onSelect?.(player.id)}
            className="relative block w-full overflow-hidden rounded-2xl md:rounded-[2rem] border border-slate-100 bg-white p-3 md:p-5 text-center shadow-sm"
        >
            <div className="absolute left-0 top-0 h-0.5 md:h-1 w-full bg-orange-200" />
            <img src={avatarUrl(player)} alt="" className="mx-auto mb-2 h-11 w-11 md:h-16 md:w-16 rounded-full object-cover ring-2 ring-slate-50" />
            <h3 className="truncate text-[11px] md:text-base font-black text-slate-900">{player.name}</h3>
            <p className="text-[8px] md:text-[10px] font-bold uppercase text-slate-400">#{player.rank}</p>
            <p className="mt-1 text-lg md:text-2xl font-black text-slate-900">{player.points}</p>
        </button>
    </motion.div>
);

// ─── participants grid (pre-tournament) ─────────────────────────────────────

const ParticipantsGrid: React.FC<{ players: LeaderboardRow[] }> = ({ players }) => (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
            <Trophy className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-xs font-bold text-amber-700">
                El torneo aún no ha comenzado — las posiciones se asignarán cuando se disputen los primeros partidos.
            </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {players.map((player, index) => (
                <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 bg-white p-2.5 text-center shadow-sm"
                >
                    <img src={avatarUrl(player)} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-50" />
                    <div className="min-w-0 w-full">
                        <p className="truncate text-[11px] font-black text-slate-900">{player.name}</p>
                        <p className="truncate text-[9px] font-bold uppercase text-slate-400">@{player.username}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    </motion.section>
);

// ─── breakdown panel (inline) ───────────────────────────────────────────────

function BreakdownPanel({
    playerId,
    leagueId,
    category,
    breakdowns,
    loading,
}: {
    playerId: string;
    leagueId: string;
    category: LeaderboardCategory;
    breakdowns: Record<string, LeaderboardBreakdown | undefined>;
    loading: boolean;
}) {
    const cacheKey = `${leagueId}:${category}:${playerId}`;
    const breakdown = breakdowns[cacheKey];

    if (loading && !breakdown) {
        return <p className="px-4 py-3 text-sm text-slate-500">Cargando detalle...</p>;
    }
    if (!breakdown || (!breakdown.matches.length && !breakdown.bonuses.length)) {
        return <p className="px-4 py-3 text-sm text-slate-500">Sin detalle disponible para esta categoría.</p>;
    }

    return (
        <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-3 space-y-2">
            {breakdown.matches.map((match) => (
                <div key={match.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{match.homeTeam} vs {match.awayTeam}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-0.5">
                                {match.displayDate}{match.group ? ` · Grupo ${match.group}` : ` · ${match.phase}`}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1">
                                Pronóstico {match.predictionHome}-{match.predictionAway}
                                {typeof match.resultHome === 'number' && typeof match.resultAway === 'number'
                                    ? ` · Resultado ${match.resultHome}-${match.resultAway}`
                                    : ''}
                            </p>
                            <p className="text-[11px] font-medium text-slate-600 mt-1">{match.summaryLabel}</p>
                        </div>
                        <div className="text-right shrink-0">
                            {match.pointDetail ? (
                                <Tooltip content={<PointsBreakdown detail={match.pointDetail as PointDetail} compact />}>
                                    <div className="cursor-help">
                                        <p className="text-base font-black text-lime-600 underline decoration-dotted decoration-2 underline-offset-4">{match.points}</p>
                                        <p className="text-[10px] font-bold uppercase text-slate-400">pts</p>
                                    </div>
                                </Tooltip>
                            ) : (
                                <>
                                    <p className="text-base font-black text-lime-600">{match.points}</p>
                                    <p className="text-[10px] font-bold uppercase text-slate-400">pts</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            {breakdown.bonuses.map((bonus) => (
                <div key={bonus.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-bold text-amber-900">Bono de fase</p>
                        <p className="text-[10px] font-semibold uppercase text-amber-700">{bonus.phase}</p>
                    </div>
                    <p className="text-base font-black text-amber-700">+{bonus.points}</p>
                </div>
            ))}
        </div>
    );
}

// ─── ranking row ────────────────────────────────────────────────────────────

function RankingRow({
    player,
    isMe,
    expanded,
    previous,
    next,
    onToggle,
    breakdownSlot,
}: {
    player: LeaderboardRow;
    isMe: boolean;
    expanded: boolean;
    previous: TiebreakSummaryEntry | null;
    next: TiebreakSummaryEntry | null;
    onToggle: () => void;
    breakdownSlot?: React.ReactNode;
}) {
    return (
        <div className={isMe ? 'bg-lime-50/60' : undefined}>
            <button
                type="button"
                onClick={onToggle}
                className={`w-full grid grid-cols-[2rem_1fr_auto_1.5rem] gap-2 px-3 sm:px-4 py-2.5 sm:py-3 items-start text-left transition-colors ${
                    isMe ? '' : 'hover:bg-slate-50'
                }`}
            >
                <div className="text-sm font-black text-slate-500 pt-0.5 text-center">
                    {MEDAL[player.rank] ?? player.rank}
                </div>
                <div className="flex items-start gap-2 min-w-0">
                    <img
                        src={avatarUrl(player)}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                    <div className="min-w-0">
                        <p className={`font-bold text-sm truncate ${isMe ? 'text-lime-700' : 'text-slate-900'}`}>
                            {player.name}
                            {player.hasChampion && (
                                <Trophy className="inline h-3 w-3 ml-0.5 text-amber-400" aria-label="Acertó el campeón" />
                            )}
                            {isMe && <span className="ml-1 text-[10px] font-black text-lime-600">(tú)</span>}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 truncate">@{player.username}</p>
                        <RankingTiebreakSummary
                            entry={leaderboardToTiebreakEntry(player)}
                            previous={previous}
                            next={next}
                            compact
                        />
                    </div>
                </div>
                <div className="text-right shrink-0 pt-0.5">
                    <p className={`text-sm font-black ${isMe ? 'text-lime-600' : 'text-slate-900'}`}>{player.points}</p>
                    {(player.phaseBonusPoints ?? 0) > 0 && (
                        <p className="text-[9px] font-bold text-amber-600">+{player.phaseBonusPoints} bono</p>
                    )}
                    <div className="mt-0.5 hidden sm:flex justify-end">
                        <TrendIcon trend={player.trend} />
                    </div>
                </div>
                <div className="flex justify-center text-slate-300 pt-1">
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>
            {expanded && breakdownSlot}
        </div>
    );
}

// ─── constants ──────────────────────────────────────────────────────────────

const RANKING_CATEGORY_META: Array<{ id: LeaderboardCategory; label: string }> = [
    { id: 'GENERAL', label: 'General' },
    { id: 'MATCH', label: 'Por partido' },
    { id: 'GROUP', label: 'Por grupo' },
    { id: 'ROUND', label: 'Por ronda' },
];

const RANKING_LIMIT = 50;

// ─── main component ─────────────────────────────────────────────────────────

const Ranking: React.FC = () => {
    const activeLeague = useLeagueStore((state) => state.activeLeague);
    const myLeagues = useLeagueStore((state) => state.myLeagues);
    const fetchMyLeagues = useLeagueStore((state) => state.fetchMyLeagues);
    const fetchLeagueDetails = useLeagueStore((state) => state.fetchLeagueDetails);
    const setActiveLeague = useLeagueStore((state) => state.setActiveLeague);
    const leaderboard = usePredictionStore((state) => state.leaderboard);
    const leaderboardBreakdowns = usePredictionStore((state) => state.leaderboardBreakdowns);
    const isLoading = usePredictionStore((state) => state.isLoading);
    const fetchLeaderboard = usePredictionStore((state) => state.fetchLeaderboard);
    const fetchLeaderboardBreakdown = usePredictionStore((state) => state.fetchLeaderboardBreakdown);
    const user = useAuthStore((state) => state.user);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [activeCategory, setActiveCategory] = React.useState<LeaderboardCategory>('GENERAL');
    const [expandedPlayerId, setExpandedPlayerId] = React.useState<string | null>(null);
    const [loadingBreakdownId, setLoadingBreakdownId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (myLeagues.length > 0) return;
        void fetchMyLeagues();
    }, [fetchMyLeagues, myLeagues.length]);

    React.useEffect(() => {
        if (!activeLeague?.id) return;
        void fetchLeaderboard(activeLeague.id, activeCategory);
    }, [activeCategory, activeLeague?.id, fetchLeaderboard]);

    React.useEffect(() => {
        if (!activeLeague?.id) return;
        void fetchLeagueDetails(activeLeague.id);
    }, [activeLeague?.id, fetchLeagueDetails]);

    const availableCategories = React.useMemo(() => {
        const categories: LeaderboardCategory[] = [];
        if (activeLeague?.settings.includeBaseFee !== false) categories.push('GENERAL');
        const activeStageFeeTypes = new Set(
            (activeLeague?.stageFees ?? [])
                .filter((fee) => fee.active && Number(fee.amount ?? 0) > 0)
                .map((fee) => fee.type.toUpperCase()),
        );
        if (activeStageFeeTypes.has('MATCH')) categories.push('MATCH');
        if (activeStageFeeTypes.has('PHASE')) categories.push('GROUP');
        if (activeStageFeeTypes.has('ROUND')) categories.push('ROUND');
        return categories.length > 0 ? categories : ['GENERAL'];
    }, [activeLeague?.settings.includeBaseFee, activeLeague?.stageFees]);

    React.useEffect(() => {
        if (availableCategories.includes(activeCategory)) return;
        setActiveCategory(availableCategories[0] as LeaderboardCategory);
    }, [activeCategory, availableCategories]);

    const tournamentStarted = React.useMemo(
        () => activeCategory !== 'GENERAL'
            ? leaderboard.length > 0
            : leaderboard.some((p) => p.points > 0),
        [leaderboard, activeCategory],
    );

    const filteredRanking = React.useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        let list = leaderboard;
        if (q) list = leaderboard.filter((p) => `${p.name} ${p.username}`.toLowerCase().includes(q));
        return list.slice(0, RANKING_LIMIT);
    }, [leaderboard, searchTerm]);

    const podium = filteredRanking.slice(0, 3);
    const rest = filteredRanking.slice(3);

    const myEntry = React.useMemo(
        () => leaderboard.find((p) => p.id === user?.id) ?? null,
        [leaderboard, user?.id],
    );

    const entryNeighbors = React.useMemo(() => {
        const map = new Map<string, { previous: TiebreakSummaryEntry | null; next: TiebreakSummaryEntry | null }>();
        filteredRanking.forEach((entry, index) => {
            map.set(entry.id, {
                previous: index > 0 ? leaderboardToTiebreakEntry(filteredRanking[index - 1]) : null,
                next: index < filteredRanking.length - 1 ? leaderboardToTiebreakEntry(filteredRanking[index + 1]) : null,
            });
        });
        return map;
    }, [filteredRanking]);

    const openPlayerBreakdown = React.useCallback(async (playerId: string) => {
        if (!activeLeague?.id) return;
        if (expandedPlayerId === playerId) {
            setExpandedPlayerId(null);
            return;
        }
        setExpandedPlayerId(playerId);
        const cacheKey = `${activeLeague.id}:${activeCategory}:${playerId}`;
        if (leaderboardBreakdowns[cacheKey]) return;
        setLoadingBreakdownId(playerId);
        try {
            await fetchLeaderboardBreakdown(activeLeague.id, playerId, activeCategory);
        } finally {
            setLoadingBreakdownId((current) => (current === playerId ? null : current));
        }
    }, [activeCategory, activeLeague?.id, expandedPlayerId, fetchLeaderboardBreakdown, leaderboardBreakdowns]);

    const participantMeta = activeLeague
        ? `${leaderboard.length} participante${leaderboard.length !== 1 ? 's' : ''}${
            leaderboard.length > RANKING_LIMIT ? ` · Top ${RANKING_LIMIT}` : ''
        }${tournamentStarted ? '' : ' · Torneo pendiente'}`
        : '';

    const renderBreakdown = (playerId: string) => activeLeague?.id ? (
        <BreakdownPanel
            playerId={playerId}
            leagueId={activeLeague.id}
            category={activeCategory}
            breakdowns={leaderboardBreakdowns}
            loading={loadingBreakdownId === playerId}
        />
    ) : null;

    return (
        <div className="space-y-4 md:space-y-6">

            {/* ── Compact header ── */}
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">
                            Tabla de Líderes
                        </h1>
                        <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-lime-700">
                            Ranking
                        </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {activeLeague?.name ?? 'Selecciona una liga'}
                        {participantMeta ? ` · ${participantMeta}` : ''}
                    </p>
                </div>

                {myLeagues.length > 0 && (
                    <div className="relative shrink-0 sm:min-w-[200px]">
                        <label htmlFor="ranking-league-select" className="sr-only">Selecciona tu liga</label>
                        <select
                            id="ranking-league-select"
                            aria-label="Liga activa"
                            value={activeLeague?.id ?? ''}
                            onChange={(e) => setActiveLeague(e.target.value)}
                            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs sm:text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
                        >
                            {myLeagues.map((league) => (
                                <option key={league.id} value={league.id}>{league.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    </div>
                )}
            </header>

            {activeLeague && availableCategories.length > 0 && (
                <div className="space-y-2">
                    {availableCategories.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                            {RANKING_CATEGORY_META
                                .filter((item) => availableCategories.includes(item.id))
                                .map((item) => {
                                    const selected = item.id === activeCategory;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => { setActiveCategory(item.id); setExpandedPlayerId(null); }}
                                            aria-pressed={selected}
                                            className={`rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
                                                selected
                                                    ? 'border-slate-900 bg-slate-900 text-white'
                                                    : 'border-slate-200 bg-white text-slate-500 hover:border-lime-300'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                        </div>
                    )}
                    <RankingGuidePanel />
                </div>
            )}

            {/* ── My position (inline, no sticky) ── */}
            {myEntry && tournamentStarted && (
                <div className="rounded-2xl bg-slate-900 px-4 py-3 flex items-center gap-3 text-white shadow-lg">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-400">
                        <span className="text-sm font-black text-slate-900">#{myEntry.rank}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">Tu posición</p>
                        <p className="font-black text-sm truncate">
                            {myEntry.name} <span className="text-lime-400">(tú)</span>
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-xl font-black text-lime-400">{myEntry.points}</p>
                        <p className="text-[9px] font-bold uppercase text-white/40">pts</p>
                    </div>
                </div>
            )}

            {isLoading && (
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-28 md:h-40 animate-pulse rounded-2xl bg-slate-100" />
                    ))}
                </div>
            )}

            {!isLoading && myLeagues.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                    <Users className="mx-auto mb-3 h-8 w-8 text-slate-200" aria-hidden="true" />
                    <p className="font-black text-slate-900">Sin ligas</p>
                    <p className="mt-1 text-sm text-slate-400">Únete o crea una liga para ver el ranking.</p>
                </div>
            )}

            <AnimatePresence mode="wait">
                {!isLoading && leaderboard.length > 0 && !tournamentStarted && (
                    <motion.div key="participants" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <ParticipantsGrid players={filteredRanking} />
                    </motion.div>
                )}

                {!isLoading && tournamentStarted && (
                    <motion.div key="ranking" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                        {/* Podium stage */}
                        {podium.length > 0 && (
                            <section aria-label="Podio del ranking">
                                <div className="grid grid-cols-3 items-end gap-2 md:gap-4 md:pt-2">
                                    {podium[1] && <PodiumSecond player={podium[1]} onSelect={(id) => void openPlayerBreakdown(id)} />}
                                    {podium[0] && <PodiumFirst player={podium[0]} onSelect={(id) => void openPlayerBreakdown(id)} />}
                                    {podium[2] && <PodiumThird player={podium[2]} onSelect={(id) => void openPlayerBreakdown(id)} />}
                                </div>
                                {expandedPlayerId && podium.some((p) => p.id === expandedPlayerId) && (
                                    <div className="mt-2 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                                        {renderBreakdown(expandedPlayerId)}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Search */}
                        <label className="relative block">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                            <input
                                type="search"
                                placeholder="Buscar participante..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400/30"
                            />
                        </label>

                        {filteredRanking.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                                <Medal className="mx-auto mb-2 h-8 w-8 text-slate-200" aria-hidden="true" />
                                <p className="font-black text-slate-900">Sin resultados</p>
                                <p className="mt-1 text-sm text-slate-400">Intenta con otro nombre.</p>
                            </div>
                        )}

                        {/* Ranking list */}
                        {filteredRanking.length > 0 && (
                            <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm" aria-label="Clasificación">
                                <div className="grid grid-cols-[2rem_1fr_auto_1.5rem] gap-2 px-3 sm:px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-50">
                                    <span>#</span>
                                    <span>Participante</span>
                                    <span className="text-right">Puntos</span>
                                    <span className="sr-only">Detalle</span>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {rest.map((player) => {
                                        const neighbors = entryNeighbors.get(player.id);
                                        const expanded = expandedPlayerId === player.id;
                                        return (
                                            <RankingRow
                                                key={player.id}
                                                player={player}
                                                isMe={player.id === user?.id}
                                                expanded={expanded}
                                                previous={neighbors?.previous ?? null}
                                                next={neighbors?.next ?? null}
                                                onToggle={() => void openPlayerBreakdown(player.id)}
                                                breakdownSlot={expanded ? renderBreakdown(player.id) : undefined}
                                            />
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Ranking;
