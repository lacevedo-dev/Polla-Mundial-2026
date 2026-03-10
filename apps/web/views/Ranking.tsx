import React from 'react';
import { Search, Trophy } from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore } from '../stores/prediction.store';

const Ranking: React.FC = () => {
    const activeLeague = useLeagueStore((state) => state.activeLeague);
    const myLeagues = useLeagueStore((state) => state.myLeagues);
    const fetchMyLeagues = useLeagueStore((state) => state.fetchMyLeagues);
    const setActiveLeague = useLeagueStore((state) => state.setActiveLeague);
    const leaderboard = usePredictionStore((state) => state.leaderboard);
    const isLoading = usePredictionStore((state) => state.isLoading);
    const fetchLeaderboard = usePredictionStore((state) => state.fetchLeaderboard);
    const [searchTerm, setSearchTerm] = React.useState('');

    React.useEffect(() => {
        if (myLeagues.length > 0) {
            return;
        }

        void fetchMyLeagues();
    }, [fetchMyLeagues, myLeagues.length]);

    React.useEffect(() => {
        if (!activeLeague?.id) {
            return;
        }

        void fetchLeaderboard(activeLeague.id);
    }, [activeLeague?.id, fetchLeaderboard]);

    const filteredRanking = React.useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        if (!normalizedSearch) {
            return leaderboard;
        }

        return leaderboard.filter((player) => {
            const haystack = `${player.name} ${player.username}`.toLowerCase();
            return haystack.includes(normalizedSearch);
        });
    }, [leaderboard, searchTerm]);

    const podium = filteredRanking.slice(0, 3);
    const rest = filteredRanking.slice(3);

    return (
        <div className="space-y-8">
            <header className="rounded-[2rem] bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-lime-600">Ranking</p>
                        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-slate-900">
                            Tabla de líderes
                        </h1>
                        <p className="mt-2 text-sm text-slate-500">
                            El ranking ahora se alimenta del endpoint real de leaderboard por liga.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 lg:items-end">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400" htmlFor="ranking-league-select">
                            Liga activa
                        </label>
                        <select
                            id="ranking-league-select"
                            aria-label="Liga activa"
                            className="min-w-[240px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                            value={activeLeague?.id ?? ''}
                            onChange={(event) => setActiveLeague(event.target.value)}
                        >
                            {myLeagues.map((league) => (
                                <option key={league.id} value={league.id}>
                                    {league.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            <section className="flex flex-col gap-4 md:flex-row md:items-center">
                <label className="relative block flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                    <input
                        type="search"
                        placeholder="Buscar por nombre o usuario"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none"
                    />
                </label>
            </section>

            {filteredRanking.length === 0 && !isLoading ? (
                <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                    Todavía no hay jugadores clasificados para esta liga.
                </div>
            ) : null}

            {podium.length > 0 ? (
                <section className="grid gap-4 md:grid-cols-3">
                    {podium.map((player) => (
                        <article
                            key={player.id}
                            className={`rounded-[2rem] p-6 shadow-sm ${
                                player.rank === 1 ? 'bg-slate-900 text-white' : 'bg-white'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p
                                        className={`text-[11px] font-black uppercase tracking-[0.2em] ${
                                            player.rank === 1 ? 'text-lime-300' : 'text-slate-400'
                                        }`}
                                    >
                                        #{player.rank}
                                    </p>
                                    <h2
                                        className={`mt-2 text-2xl font-black ${
                                            player.rank === 1 ? 'text-white' : 'text-slate-900'
                                        }`}
                                    >
                                        {player.name}
                                    </h2>
                                    <p
                                        className={`text-sm font-semibold ${
                                            player.rank === 1 ? 'text-white/70' : 'text-slate-500'
                                        }`}
                                    >
                                        @{player.username}
                                    </p>
                                </div>
                                <div
                                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                                        player.rank === 1 ? 'bg-lime-400 text-slate-900' : 'bg-slate-100 text-slate-700'
                                    }`}
                                >
                                    <Trophy className="h-6 w-6" />
                                </div>
                            </div>

                            <p
                                className={`mt-6 text-4xl font-black ${
                                    player.rank === 1 ? 'text-lime-300' : 'text-lime-700'
                                }`}
                            >
                                {player.points}
                            </p>
                            <p
                                className={`text-sm font-semibold ${
                                    player.rank === 1 ? 'text-white/70' : 'text-slate-500'
                                }`}
                            >
                                puntos acumulados
                            </p>
                        </article>
                    ))}
                </section>
            ) : null}

            <section className="overflow-hidden rounded-[2rem] bg-white shadow-sm">
                <div className="grid grid-cols-[80px_1fr_120px] gap-4 border-b border-slate-100 px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <span>Pos</span>
                    <span>Jugador</span>
                    <span className="text-right">Puntos</span>
                </div>
                <div className="divide-y divide-slate-100">
                    {rest.map((player) => (
                        <article
                            key={player.id}
                            className="grid grid-cols-[80px_1fr_120px] gap-4 px-6 py-4 text-sm"
                        >
                            <span className="font-black text-slate-400">#{player.rank}</span>
                            <div className="min-w-0">
                                <p className="truncate font-black text-slate-900">{player.name}</p>
                                <p className="truncate text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                    @{player.username}
                                </p>
                            </div>
                            <span className="text-right font-black text-lime-700">{player.points}</span>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Ranking;
