import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Search, Trophy, Medal, TrendingUp, TrendingDown, Minus, Crown,
} from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore, type LeaderboardRow } from '../stores/prediction.store';
import { useAuthStore } from '../stores/auth.store';

// ─── helpers ────────────────────────────────────────────────────────────────

function avatarUrl(row: LeaderboardRow): string {
    return row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=e2e8f0&color=64748b&size=128`;
}

function TrendIcon({ trend }: { trend: LeaderboardRow['trend'] }) {
    if (trend === 'same') return <Minus className="h-3.5 w-3.5 text-slate-300" />;
    // future-proofing for when backend sends up/down
    if ((trend as string) === 'up') return <TrendingUp className="h-3.5 w-3.5 text-lime-500" />;
    return <TrendingDown className="h-3.5 w-3.5 text-rose-500" />;
}

// ─── podium cards ────────────────────────────────────────────────────────────

const PodiumFirst: React.FC<{ player: LeaderboardRow }> = ({ player }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="order-1 md:order-2"
    >
        <div className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-8 text-center shadow-2xl">
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

            <h3 className="truncate text-xl font-black text-white">{player.name}</h3>
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.2em] text-lime-400/60">@{player.username}</p>

            <div className="mb-2 flex items-center justify-center gap-3">
                <span className="text-5xl font-black text-white">{player.points}</span>
                <div className="text-left">
                    <p className="text-[10px] font-black uppercase leading-none text-lime-400">Puntos</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Líder</p>
                </div>
            </div>
        </div>
    </motion.div>
);

const PodiumSecond: React.FC<{ player: LeaderboardRow }> = ({ player }) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="order-2 md:order-1"
    >
        <div className="group relative overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-7 text-center shadow-sm transition-colors hover:border-slate-200">
            <div className="absolute left-0 top-0 h-1 w-full bg-slate-300" />
            <div className="relative mb-4 inline-block">
                <img
                    src={avatarUrl(player)}
                    alt={player.name}
                    className="mx-auto h-20 w-20 rounded-full object-cover shadow-xl ring-4 ring-slate-50"
                />
                <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border-4 border-white bg-slate-100 shadow-sm">
                    <Medal className="h-4 w-4 text-slate-400" />
                </div>
            </div>
            <h3 className="truncate text-lg font-black text-slate-900">{player.name}</h3>
            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">@{player.username}</p>
            <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-black text-slate-900">{player.points}</span>
                <span className="text-[10px] font-black uppercase text-slate-400">pts</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] font-black uppercase tracking-tighter text-slate-400">
                <span>#{player.rank} Lugar</span>
                <TrendIcon trend={player.trend} />
            </div>
        </div>
    </motion.div>
);

const PodiumThird: React.FC<{ player: LeaderboardRow }> = ({ player }) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
        className="order-3"
    >
        <div className="group relative overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-7 text-center shadow-sm transition-colors hover:border-orange-100">
            <div className="absolute left-0 top-0 h-1 w-full bg-orange-200" />
            <div className="relative mb-4 inline-block">
                <img
                    src={avatarUrl(player)}
                    alt={player.name}
                    className="mx-auto h-20 w-20 rounded-full object-cover shadow-xl ring-4 ring-slate-50"
                />
                <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border-4 border-white bg-orange-50 shadow-sm">
                    <Medal className="h-4 w-4 text-orange-400" />
                </div>
            </div>
            <h3 className="truncate text-lg font-black text-slate-900">{player.name}</h3>
            <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">@{player.username}</p>
            <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-black text-slate-900">{player.points}</span>
                <span className="text-[10px] font-black uppercase text-slate-400">pts</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] font-black uppercase tracking-tighter text-slate-400">
                <span>#{player.rank} Lugar</span>
                <TrendIcon trend={player.trend} />
            </div>
        </div>
    </motion.div>
);

// ─── main component ──────────────────────────────────────────────────────────

const Ranking: React.FC = () => {
    const activeLeague = useLeagueStore((state) => state.activeLeague);
    const myLeagues = useLeagueStore((state) => state.myLeagues);
    const fetchMyLeagues = useLeagueStore((state) => state.fetchMyLeagues);
    const setActiveLeague = useLeagueStore((state) => state.setActiveLeague);
    const leaderboard = usePredictionStore((state) => state.leaderboard);
    const isLoading = usePredictionStore((state) => state.isLoading);
    const fetchLeaderboard = usePredictionStore((state) => state.fetchLeaderboard);
    const user = useAuthStore((state) => state.user);
    const [searchTerm, setSearchTerm] = React.useState('');

    React.useEffect(() => {
        if (myLeagues.length > 0) return;
        void fetchMyLeagues();
    }, [fetchMyLeagues, myLeagues.length]);

    React.useEffect(() => {
        if (!activeLeague?.id) return;
        void fetchLeaderboard(activeLeague.id);
    }, [activeLeague?.id, fetchLeaderboard]);

    const filteredRanking = React.useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        if (!normalizedSearch) return leaderboard;
        return leaderboard.filter((p) =>
            `${p.name} ${p.username}`.toLowerCase().includes(normalizedSearch),
        );
    }, [leaderboard, searchTerm]);

    const podium = filteredRanking.slice(0, 3);
    const rest = filteredRanking.slice(3);

    // Find the current user's entry in the leaderboard
    const myEntry = React.useMemo(
        () => leaderboard.find((p) => p.id === user?.id) ?? null,
        [leaderboard, user?.id],
    );

    return (
        <div className="space-y-8 pb-32">
            {/* Header */}
            <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-lime-600">Ranking</p>
                    <h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-slate-900 lg:text-4xl">
                        Tabla de Líderes
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-500">Compite por el primer lugar en tu liga.</p>
                </div>

                <div className="flex flex-col gap-2 lg:items-end">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400" htmlFor="ranking-league-select">
                        Liga activa
                    </label>
                    <select
                        id="ranking-league-select"
                        aria-label="Liga activa"
                        className="min-w-[220px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-lime-400"
                        value={activeLeague?.id ?? ''}
                        onChange={(e) => setActiveLeague(e.target.value)}
                    >
                        {myLeagues.map((league) => (
                            <option key={league.id} value={league.id}>{league.name}</option>
                        ))}
                    </select>
                </div>
            </header>

            {/* Podium */}
            {podium.length > 0 && (
                <section className="grid grid-cols-1 items-end gap-4 pt-6 md:grid-cols-3">
                    {podium[1] && <PodiumSecond player={podium[1]} />}
                    {podium[0] && <PodiumFirst player={podium[0]} />}
                    {podium[2] && <PodiumThird player={podium[2]} />}
                </section>
            )}

            {/* Search */}
            <section>
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
            </section>

            {/* Empty state */}
            {filteredRanking.length === 0 && !isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-12 text-center"
                >
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-slate-50">
                        <Search className="h-7 w-7 text-slate-200" />
                    </div>
                    <p className="font-black text-slate-900">Sin resultados</p>
                    <p className="mt-1 text-sm text-slate-400">
                        {searchTerm ? 'Intenta con otro nombre.' : 'Todavía no hay jugadores clasificados.'}
                    </p>
                </motion.div>
            )}

            {/* Rest of the list */}
            {rest.length > 0 && (
                <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                    <div className="grid grid-cols-[56px_1fr_96px] gap-3 border-b border-slate-50 px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 md:grid-cols-[56px_1fr_80px_96px]">
                        <span className="text-center">Pos</span>
                        <span>Jugador</span>
                        <span className="hidden text-center md:block">Tend.</span>
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
                                    className="group grid grid-cols-[56px_1fr_96px] items-center gap-3 px-5 py-4 transition-colors hover:bg-slate-50 md:grid-cols-[56px_1fr_80px_96px]"
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
                                            <p className="truncate font-black text-slate-900">{player.name}</p>
                                            <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                                @{player.username}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="hidden items-center justify-center md:flex">
                                        <TrendIcon trend={player.trend} />
                                    </div>

                                    <div className="text-right">
                                        <span className="text-xl font-black text-lime-600 leading-none">{player.points}</span>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">pts</p>
                                    </div>
                                </motion.article>
                            ))}
                        </AnimatePresence>
                    </div>
                </section>
            )}

            {/* Sticky — current user's position */}
            {myEntry && (
                <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.4, type: 'spring', stiffness: 260, damping: 22 }}
                    className="fixed bottom-6 left-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2"
                >
                    <div className="flex items-center justify-between rounded-[2rem] border border-white/10 bg-slate-900/95 px-5 py-4 shadow-2xl backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-lime-400">
                                <span className="text-sm font-black text-slate-900">#{myEntry.rank}</span>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Tu posición</p>
                                <p className="font-black text-white">
                                    {myEntry.name} <span className="text-lime-400">(Tú)</span>
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
