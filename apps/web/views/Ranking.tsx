import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Search, Trophy, Medal, TrendingUp, TrendingDown, Minus, Crown, Users, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore, type LeaderboardRow } from '../stores/prediction.store';
import type { LeaderboardCategory } from '../stores/prediction.adapters';
import { useAuthStore } from '../stores/auth.store';

// â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function avatarUrl(row: LeaderboardRow): string {
    return row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=e2e8f0&color=64748b&size=128`;
}

function TrendIcon({ trend }: { trend: LeaderboardRow['trend'] }) {
    if (trend === 'same') return <Minus className="h-3.5 w-3.5 text-slate-300" />;
    if ((trend as string) === 'up') return <TrendingUp className="h-3.5 w-3.5 text-lime-500" />;
    return <TrendingDown className="h-3.5 w-3.5 text-rose-500" />;
}

// â”€â”€â”€ podium cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PodiumFirst: React.FC<{ player: LeaderboardRow; onSelect?: (id: string) => void }> = ({ player, onSelect }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="order-1 md:order-2"
    >
        <button
            type="button"
            onClick={() => onSelect?.(player.id)}
            className="relative block w-full overflow-hidden rounded-[3rem] bg-slate-900 p-8 text-center shadow-2xl"
        >
            <div className="absolute left-0 top-0 h-1.5 w-full bg-lime-400" />
            <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-lime-400/10 blur-3xl" />
            <div className="relative mb-6 inline-block">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                    <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                    >
                        <Crown className="h-9 w-9 fill-lime-400 text-lime-400" />
                    </motion.div>
                </div>
                <img
                    src={avatarUrl(player)}
                    alt={player.name}
                    className="mx-auto h-28 w-28 rounded-full object-cover shadow-2xl ring-4 ring-lime-400/30"
                />
                <div className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-2xl border-4 border-slate-900 bg-lime-400 shadow-lg">
                    <Trophy className="h-5 w-5 text-slate-900" />
                </div>
            </div>
            <div className="flex items-center justify-center gap-1.5">
                <h3 className="truncate text-xl font-black text-white">{player.name}</h3>
                {player.hasChampion && <Trophy className="h-4 w-4 flex-shrink-0 text-amber-400" aria-label="Acerto el campeon" />}
            </div>
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400/60">@{player.username}</p>
            <div className="flex items-center justify-center gap-3">
                <span className="text-5xl font-black text-white">{player.points}</span>
                <div className="text-left">
                    <p className="text-[10px] font-black uppercase leading-none text-lime-400">Puntos</p>
                    {(player.phaseBonusPoints ?? 0) > 0
                        ? <p className="text-[9px] font-bold text-amber-400/80">+{player.phaseBonusPoints} bono</p>
                        : <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">LÃ­der</p>
                    }
                </div>
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Toca para ver el detalle</p>
        </button>
    </motion.div>
);

const PodiumSecond: React.FC<{ player: LeaderboardRow; onSelect?: (id: string) => void }> = ({ player, onSelect }) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="order-2 md:order-1"
    >
        <button
            type="button"
            onClick={() => onSelect?.(player.id)}
            className="relative block w-full overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-7 text-center shadow-sm transition-colors hover:border-slate-200"
        >
            <div className="absolute left-0 top-0 h-1 w-full bg-slate-300" />
            <div className="relative mb-4 inline-block">
                <img src={avatarUrl(player)} alt={player.name} className="mx-auto h-20 w-20 rounded-full object-cover shadow-xl ring-4 ring-slate-50" />
                <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border-4 border-white bg-slate-100 shadow-sm">
                    <Medal className="h-4 w-4 text-slate-400" />
                </div>
            </div>
            <div className="flex items-center justify-center gap-1">
                <h3 className="truncate text-lg font-black text-slate-900">{player.name}</h3>
                {player.hasChampion && <Trophy className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" aria-label="Acerto el campeon" />}
            </div>
            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">@{player.username}</p>
            <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-black text-slate-900">{player.points}</span>
                <div className="text-left">
                    <span className="text-[10px] font-black uppercase text-slate-400">pts</span>
                    {(player.phaseBonusPoints ?? 0) > 0 && (
                        <p className="text-[9px] font-bold text-amber-500">+{player.phaseBonusPoints} bono</p>
                    )}
                </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] font-black uppercase tracking-tighter text-slate-400">
                <span>#{player.rank} Lugar</span>
                <TrendIcon trend={player.trend} />
            </div>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Toca para ver el detalle</p>
        </button>
    </motion.div>
);

const PodiumThird: React.FC<{ player: LeaderboardRow; onSelect?: (id: string) => void }> = ({ player, onSelect }) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
        className="order-3"
    >
        <button
            type="button"
            onClick={() => onSelect?.(player.id)}
            className="relative block w-full overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-7 text-center shadow-sm transition-colors hover:border-orange-100"
        >
            <div className="absolute left-0 top-0 h-1 w-full bg-orange-200" />
            <div className="relative mb-4 inline-block">
                <img src={avatarUrl(player)} alt={player.name} className="mx-auto h-20 w-20 rounded-full object-cover shadow-xl ring-4 ring-slate-50" />
                <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border-4 border-white bg-orange-50 shadow-sm">
                    <Medal className="h-4 w-4 text-orange-400" />
                </div>
            </div>
            <div className="flex items-center justify-center gap-1">
                <h3 className="truncate text-lg font-black text-slate-900">{player.name}</h3>
                {player.hasChampion && <Trophy className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" aria-label="Acerto el campeon" />}
            </div>
            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">@{player.username}</p>
            <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-black text-slate-900">{player.points}</span>
                <div className="text-left">
                    <span className="text-[10px] font-black uppercase text-slate-400">pts</span>
                    {(player.phaseBonusPoints ?? 0) > 0 && (
                        <p className="text-[9px] font-bold text-amber-500">+{player.phaseBonusPoints} bono</p>
                    )}
                </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] font-black uppercase tracking-tighter text-slate-400">
                <span>#{player.rank} Lugar</span>
                <TrendIcon trend={player.trend} />
            </div>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Toca para ver el detalle</p>
        </button>
    </motion.div>
);

// â”€â”€â”€ participants grid (pre-tournament) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ParticipantsGrid: React.FC<{ players: LeaderboardRow[] }> = ({ players }) => (
    <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
    >
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <Trophy className="h-4 w-4 flex-shrink-0 text-amber-500" />
            <p className="text-xs font-bold text-amber-700">
                El torneo aÃºn no ha comenzado â€” las posiciones se asignarÃ¡n cuando se disputen los primeros partidos.
            </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {players.map((player, index) => (
                <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.25 }}
                    className="flex flex-col items-center gap-2 rounded-[1.75rem] border border-slate-100 bg-white p-4 text-center shadow-sm"
                >
                    <img
                        src={avatarUrl(player)}
                        alt={player.name}
                        className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-50 shadow"
                    />
                    <div className="min-w-0 w-full">
                        <p className="truncate text-sm font-black text-slate-900">{player.name}</p>
                        <p className="truncate text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">@{player.username}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    </motion.section>
);

const RANKING_CATEGORY_META: Array<{ id: LeaderboardCategory; label: string }> = [
    { id: 'GENERAL', label: 'General' },
    { id: 'MATCH', label: 'Por partido' },
    { id: 'GROUP', label: 'Por grupo' },
    { id: 'ROUND', label: 'Por ronda' },
];

const POINTS_LEGEND = [
    { code: 'ME', label: 'Marcador exacto' },
    { code: 'GA', label: 'Ganador acertado' },
    { code: 'GoA', label: 'Gol acertado' },
    { code: 'Pu', label: 'Prediccion unica' },
    { code: 'BF', label: 'Bono de fase' },
] as const;

function buildPointsResume(player: LeaderboardRow) {
    const parts: string[] = [];
    if (player.exactCount) parts.push(`${player.exactCount} marcador${player.exactCount === 1 ? '' : 'es'} exacto${player.exactCount === 1 ? '' : 's'}`);
    if (player.winnerCount) parts.push(`${player.winnerCount} ganador${player.winnerCount === 1 ? '' : 'es'} acertado${player.winnerCount === 1 ? '' : 's'}`);
    if (player.goalCount) parts.push(`${player.goalCount} gol${player.goalCount === 1 ? '' : 'es'} acertado${player.goalCount === 1 ? '' : 's'}`);
    if (player.uniqueCount) parts.push(`${player.uniqueCount} prediccion${player.uniqueCount === 1 ? '' : 'es'} unica${player.uniqueCount === 1 ? '' : 's'}`);
    if (player.phaseBonusPoints) parts.push(`${player.phaseBonusPoints} pts en bonos de fase`);
    return parts.length ? parts.join(' - ') : 'Aun no suma puntos detallados en esta categoria';
}

// â”€â”€â”€ main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

        if (activeLeague?.settings.includeBaseFee !== false) {
            categories.push('GENERAL');
        }

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

    // True once at least one player has earned points in GENERAL,
    // or any participant exists in a non-GENERAL category (meaning the tournament is underway).
    const tournamentStarted = React.useMemo(
        () => activeCategory !== 'GENERAL'
            ? leaderboard.length > 0
            : leaderboard.some((p) => p.points > 0),
        [leaderboard, activeCategory],
    );

    const filteredRanking = React.useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return leaderboard;
        return leaderboard.filter((p) =>
            `${p.name} ${p.username}`.toLowerCase().includes(q),
        );
    }, [leaderboard, searchTerm]);

    const podium = filteredRanking.slice(0, 3);
    const rest = filteredRanking.slice(3);

    const myEntry = React.useMemo(
        () => leaderboard.find((p) => p.id === user?.id) ?? null,
        [leaderboard, user?.id],
    );
    const selectedPlayer = React.useMemo(
        () => leaderboard.find((player) => player.id === expandedPlayerId) ?? null,
        [expandedPlayerId, leaderboard],
    );

    const openPlayerBreakdown = React.useCallback(async (playerId: string) => {
        if (!activeLeague?.id) return;

        if (expandedPlayerId === playerId) {
            setExpandedPlayerId(null);
            return;
        }

        setExpandedPlayerId(playerId);
        const cacheKey = `${activeLeague.id}:${activeCategory}:${playerId}`;
        if (leaderboardBreakdowns[cacheKey]) {
            return;
        }

        setLoadingBreakdownId(playerId);
        try {
            await fetchLeaderboardBreakdown(activeLeague.id, playerId, activeCategory);
        } finally {
            setLoadingBreakdownId((current) => (current === playerId ? null : current));
        }
    }, [activeCategory, activeLeague?.id, expandedPlayerId, fetchLeaderboardBreakdown, leaderboardBreakdowns]);

    return (
        <div className="space-y-8 pb-32">

            {/* â”€â”€ Header â”€â”€ */}
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-lime-600">Ranking</p>
                    <h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-slate-900 lg:text-4xl">
                        Tabla de LÃ­deres
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-500">Compite por el primer lugar en tu liga.</p>
                </div>

                {/* League selector */}
                {myLeagues.length > 0 && (
                    <div className="flex flex-col gap-2 lg:items-end">
                        <label
                            htmlFor="ranking-league-select"
                            className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400"
                        >
                            Selecciona tu liga
                        </label>
                        <div className="relative">
                            <select
                                id="ranking-league-select"
                                aria-label="Liga activa"
                                value={activeLeague?.id ?? ''}
                                onChange={(e) => setActiveLeague(e.target.value)}
                                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-lime-400 lg:min-w-[260px]"
                            >
                                {myLeagues.map((league) => (
                                    <option key={league.id} value={league.id}>
                                        {league.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
                        {activeLeague && (
                            <p className="text-[10px] font-semibold text-slate-400">
                                {leaderboard.length} participante{leaderboard.length !== 1 ? 's' : ''}
                                {tournamentStarted ? '' : ' Â· Torneo aÃºn no iniciado'}
                            </p>
                        )}
                    </div>
                )}
            </header>

            {activeLeague && availableCategories.length > 0 && (
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {RANKING_CATEGORY_META
                            .filter((item) => availableCategories.includes(item.id))
                            .map((item) => {
                                const selected = item.id === activeCategory;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setActiveCategory(item.id)}
                                        aria-pressed={selected}
                                        className={`rounded-2xl border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                                            selected
                                                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-500 hover:border-lime-300 hover:text-slate-900'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                    </div>
                    <div className="rounded-[1.75rem] border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Como leer los puntos</p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Cada jugador muestra por que ha sumado puntos en esta categoria. Al tocar su registro veras el detalle partido a partido y los bonos aplicados.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {POINTS_LEGEND.map((item) => (
                                    <span
                                        key={item.code}
                                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500"
                                    >
                                        {item.code}: {item.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* â”€â”€ Loading skeleton â”€â”€ */}
            {isLoading && (
                <div className="grid gap-4 md:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 animate-pulse rounded-[2.5rem] bg-slate-100" />
                    ))}
                </div>
            )}

            {/* â”€â”€ No league selected â”€â”€ */}
            {!isLoading && myLeagues.length === 0 && (
                <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-slate-50">
                        <Users className="h-7 w-7 text-slate-200" />
                    </div>
                    <p className="font-black text-slate-900">Sin ligas</p>
                    <p className="mt-1 text-sm text-slate-400">Ãšnete o crea una liga para ver el ranking.</p>
                </div>
            )}

            {/* â”€â”€ Pre-tournament: participants grid â”€â”€ */}
            <AnimatePresence mode="wait">
                {!isLoading && leaderboard.length > 0 && !tournamentStarted && (
                    <motion.div key="participants" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <ParticipantsGrid players={filteredRanking} />
                    </motion.div>
                )}

                {/* â”€â”€ Active tournament: podium + list â”€â”€ */}
                {!isLoading && tournamentStarted && (
                    <motion.div key="ranking" className="space-y-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                        {/* Podium */}
                        {podium.length > 0 && (
                            <section className="grid grid-cols-1 items-end gap-4 pt-6 md:grid-cols-3">
                                {podium[1] && <PodiumSecond player={podium[1]} onSelect={(id) => void openPlayerBreakdown(id)} />}
                                {podium[0] && <PodiumFirst player={podium[0]} onSelect={(id) => void openPlayerBreakdown(id)} />}
                                {podium[2] && <PodiumThird player={podium[2]} onSelect={(id) => void openPlayerBreakdown(id)} />}
                            </section>
                        )}

                        {/* Search */}
                        <label className="relative block">
                            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
                            <input
                                type="search"
                                placeholder="Buscar por nombre o usuario..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-3xl border border-slate-200 bg-white py-4 pl-14 pr-6 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-lime-400/30"
                            />
                        </label>

                        <AnimatePresence initial={false}>
                            {selectedPlayer && (
                                <motion.section
                                    key={selectedPlayer.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -12 }}
                                    className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
                                >
                                    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Detalle de puntos</p>
                                            <h3 className="mt-1 text-xl font-black text-slate-900">{selectedPlayer.name}</h3>
                                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">@{selectedPlayer.username}</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-500">{buildPointsResume(selectedPlayer)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-2xl bg-lime-50 px-4 py-3 text-right">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-700">Total</p>
                                                <p className="text-3xl font-black text-lime-600">{selectedPlayer.points}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedPlayerId(null)}
                                                className="rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                                            >
                                                Cerrar
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-3 bg-slate-50/70 px-5 py-4">
                                        {(() => {
                                            const breakdown = activeLeague?.id
                                                ? leaderboardBreakdowns[`${activeLeague.id}:${activeCategory}:${selectedPlayer.id}`]
                                                : undefined;

                                            if (loadingBreakdownId === selectedPlayer.id && !breakdown) {
                                                return <p className="text-sm font-semibold text-slate-500">Cargando detalle...</p>;
                                            }

                                            if (!breakdown || (!breakdown.matches.length && !breakdown.bonuses.length)) {
                                                return <p className="text-sm font-semibold text-slate-500">Sin detalle disponible para esta categoria.</p>;
                                            }

                                            return (
                                                <>
                                                    {breakdown.matches.length > 0 && (
                                                        <div className="space-y-2">
                                                            {breakdown.matches.map((match) => (
                                                                <div key={match.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <p className="truncate text-sm font-black text-slate-900">{match.homeTeam} vs {match.awayTeam}</p>
                                                                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                                                                {match.displayDate} - {match.group ? `Grupo ${match.group}` : match.phase}
                                                                            </p>
                                                                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                                                                Pronostico {match.predictionHome}-{match.predictionAway}
                                                                                {typeof match.resultHome === 'number' && typeof match.resultAway === 'number'
                                                                                    ? ` - Resultado ${match.resultHome}-${match.resultAway}`
                                                                                    : ''}
                                                                            </p>
                                                                            <p className="mt-2 text-[11px] font-semibold text-slate-600">{match.summaryLabel}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="text-lg font-black text-lime-600">{match.points}</p>
                                                                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">pts</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {breakdown.bonuses.length > 0 && (
                                                        <div className="space-y-2">
                                                            {breakdown.bonuses.map((bonus) => (
                                                                <div key={bonus.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <div>
                                                                            <p className="text-sm font-black text-amber-900">Bono de fase</p>
                                                                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700">{bonus.phase}</p>
                                                                        </div>
                                                                        <p className="text-lg font-black text-amber-700">+{bonus.points}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </motion.section>
                            )}
                        </AnimatePresence>

                        {/* Empty search */}
                        {filteredRanking.length === 0 && (
                            <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 text-center">
                                <p className="font-black text-slate-900">Sin resultados</p>
                                <p className="mt-1 text-sm text-slate-400">Intenta con otro nombre.</p>
                            </div>
                        )}

                        {/* Rest of the list */}
                        {rest.length > 0 && (
                            <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                                <div className="grid grid-cols-[56px_1fr_64px_80px] gap-3 border-b border-slate-50 px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    <span className="text-center">Pos</span>
                                    <span>Jugador</span>
                                    <span className="hidden text-center sm:block">Tend.</span>
                                    <span className="text-right">Puntos</span>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    <AnimatePresence mode="popLayout">
                                        {rest.map((player, index) => (
                                            <motion.article
                                                key={player.id}
                                                initial={{ opacity: 0, x: -16 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 16 }}
                                                transition={{ delay: index * 0.04, duration: 0.25 }}
                                                className="transition-colors hover:bg-slate-50"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => void openPlayerBreakdown(player.id)}
                                                    className="group grid w-full grid-cols-[56px_1fr_64px_80px] items-center gap-3 px-5 py-4 text-left"
                                                >
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <span className="text-base font-black text-slate-300 transition-colors group-hover:text-slate-700">
                                                            #{player.rank}
                                                        </span>
                                                    </div>
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <img
                                                            src={avatarUrl(player)}
                                                            alt={player.name}
                                                            className="h-10 w-10 flex-shrink-0 rounded-2xl object-cover ring-2 ring-white shadow-sm"
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1">
                                                                <p className="truncate font-black text-slate-900">{player.name}</p>
                                                                {player.hasChampion && <Trophy className="h-3 w-3 flex-shrink-0 text-amber-400" aria-label="Acerto el campeon" />}
                                                            </div>
                                                            <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">@{player.username}</p>
                                                            <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">{buildPointsResume(player)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="hidden items-center justify-center gap-2 sm:flex">
                                                        <TrendIcon trend={player.trend} />
                                                        <ChevronRight className={`h-4 w-4 text-slate-300 transition-transform ${expandedPlayerId === player.id ? 'rotate-90' : ''}`} />
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xl font-black leading-none text-lime-600">{player.points}</span>
                                                        {(player.phaseBonusPoints ?? 0) > 0
                                                            ? <p className="text-[9px] font-bold text-amber-500">+{player.phaseBonusPoints} bono</p>
                                                            : <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">pts</p>
                                                        }
                                                    </div>
                                                </button>
                                            </motion.article>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </section>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* â”€â”€ Sticky: current user's position (only when tournament active) â”€â”€ */}
            {myEntry && tournamentStarted && (
                <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 22 }}
                    className="fixed bottom-6 left-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2"
                >
                    <div className="flex items-center justify-between rounded-[2rem] border border-white/10 bg-slate-900/95 px-5 py-4 shadow-2xl backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-lime-400">
                                <span className="text-sm font-black text-slate-900">#{myEntry.rank}</span>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Tu posiciÃ³n</p>
                                <p className="font-black text-white">
                                    {myEntry.name} <span className="text-lime-400">(TÃº)</span>
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Puntos</p>
                            <p className="text-2xl font-black text-lime-400">{myEntry.points}</p>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default Ranking;
