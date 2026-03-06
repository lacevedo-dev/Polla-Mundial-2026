import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, ListOrdered, PlusCircle, Trophy, Users } from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore } from '../stores/prediction.store';

function formatCurrency(amount?: number | null, currency = 'COP'): string {
    if (!amount) {
        return 'Gratis';
    }

    try {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${currency} ${amount}`;
    }
}

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const {
        activeLeague,
        myLeagues,
        isLoading,
        fetchMyLeagues,
        fetchLeagueDetails,
        setActiveLeague,
    } = useLeagueStore((state) => ({
        activeLeague: state.activeLeague,
        myLeagues: state.myLeagues,
        isLoading: state.isLoading,
        fetchMyLeagues: state.fetchMyLeagues,
        fetchLeagueDetails: state.fetchLeagueDetails,
        setActiveLeague: state.setActiveLeague,
    }));
    const { matches, leaderboard, fetchLeagueMatches, fetchLeaderboard, resetLeagueData } =
        usePredictionStore((state) => ({
            matches: state.matches,
            leaderboard: state.leaderboard,
            fetchLeagueMatches: state.fetchLeagueMatches,
            fetchLeaderboard: state.fetchLeaderboard,
            resetLeagueData: state.resetLeagueData,
        }));
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (myLeagues.length > 0) {
            return;
        }

        void fetchMyLeagues().catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible cargar tus ligas.');
        });
    }, [fetchMyLeagues, myLeagues.length]);

    React.useEffect(() => {
        if (!activeLeague?.id) {
            resetLeagueData();
            return;
        }

        setError(null);
        void Promise.all([
            fetchLeagueDetails(activeLeague.id),
            fetchLeagueMatches(activeLeague.id),
            fetchLeaderboard(activeLeague.id),
        ]).catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible cargar la liga activa.');
        });
    }, [activeLeague?.id, fetchLeagueDetails, fetchLeagueMatches, fetchLeaderboard, resetLeagueData]);

    const upcomingMatches = matches.slice(0, 3);
    const topPlayers = leaderboard.slice(0, 5);

    if (!isLoading && myLeagues.length === 0 && !error) {
        return (
            <div className="space-y-6">
                <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-lime-100 text-lime-700">
                        <Trophy className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Aún no tienes ligas</h1>
                    <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">
                        Crea tu primera polla o únete con un código real para comenzar a ver pronósticos y ranking.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <button
                            className="rounded-2xl bg-lime-400 px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-900"
                            onClick={() => navigate('/create-league')}
                        >
                            Crear liga
                        </button>
                        <button
                            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-600"
                            onClick={() => navigate('/join')}
                        >
                            Unirme con código
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 rounded-[2rem] bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-lime-600">Panel principal</p>
                    <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
                        {activeLeague?.name ?? 'Cargando ligas'}
                    </h1>
                    <p className="text-sm text-slate-500">
                        {activeLeague?.description || 'Resumen de tu liga activa y los siguientes pasos para el MVP.'}
                    </p>
                </div>

                <div className="flex flex-col gap-3 md:items-end">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400" htmlFor="dashboard-league-select">
                        Liga activa
                    </label>
                    <select
                        id="dashboard-league-select"
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
            </header>

            {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            <section className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Mi rol</p>
                    <p className="mt-3 text-2xl font-black text-slate-900">
                        {activeLeague?.role === 'ADMIN' ? 'Administrador' : 'Participante'}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">Código: {activeLeague?.code ?? 'Sin código disponible'}</p>
                </div>

                <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Participantes</p>
                    <p className="mt-3 text-2xl font-black text-slate-900">
                        {activeLeague?.stats.memberCount ?? 0}
                        {activeLeague?.settings.maxParticipants ? ` / ${activeLeague.settings.maxParticipants}` : ''}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">Estado: {activeLeague?.status ?? 'Sin estado'}</p>
                </div>

                <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Cuota base</p>
                    <p className="mt-3 text-2xl font-black text-slate-900">
                        {formatCurrency(activeLeague?.settings.baseFee, activeLeague?.settings.currency)}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">Plan: {activeLeague?.settings.plan ?? 'FREE'}</p>
                </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Próximos partidos</p>
                            <h2 className="mt-2 text-xl font-black text-slate-900">Pronósticos pendientes</h2>
                        </div>
                        <Link
                            to="/predictions"
                            className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-lime-700"
                        >
                            Ver todos <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {upcomingMatches.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                            Aún no hay partidos cargados o el backend todavía no expone predicciones para esta liga.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {upcomingMatches.map((match) => (
                                <article
                                    key={match.id}
                                    className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-4 md:flex-row md:items-center md:justify-between"
                                >
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{match.displayDate}</p>
                                        <h3 className="mt-1 text-lg font-black text-slate-900">
                                            {match.homeTeam} vs {match.awayTeam}
                                        </h3>
                                        <p className="text-sm text-slate-500">{match.venue}</p>
                                    </div>
                                    <div className="text-sm text-slate-600">
                                        {match.saved ? (
                                            <span className="font-black text-lime-700">
                                                Tu pronóstico: {match.prediction.home}-{match.prediction.away}
                                            </span>
                                        ) : (
                                            <span className="font-semibold text-amber-700">Pendiente por guardar</span>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Ranking</p>
                            <h2 className="mt-2 text-xl font-black text-slate-900">Top actual</h2>
                        </div>
                        <button
                            className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-600"
                            onClick={() => navigate('/ranking')}
                        >
                            <ListOrdered className="h-4 w-4" /> Abrir ranking
                        </button>
                    </div>

                    {topPlayers.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                            El ranking todavía no tiene datos para esta liga.
                        </div>
                    ) : (
                        <ol className="space-y-3">
                            {topPlayers.map((player) => (
                                <li key={player.id} className="flex items-center gap-4 rounded-2xl bg-slate-50 p-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white">
                                        #{player.rank}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-black text-slate-900">{player.name}</p>
                                        <p className="truncate text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                                            @{player.username}
                                        </p>
                                    </div>
                                    <span className="text-sm font-black text-lime-700">{player.points} pts</span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
                <button
                    className="flex items-center justify-between rounded-[2rem] bg-slate-900 p-5 text-left text-white"
                    onClick={() => navigate('/create-league')}
                >
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-300">Acción</p>
                        <p className="mt-2 text-lg font-black">Crear otra liga</p>
                    </div>
                    <PlusCircle className="h-6 w-6" />
                </button>

                <button
                    className="flex items-center justify-between rounded-[2rem] bg-white p-5 text-left shadow-sm"
                    onClick={() => navigate('/predictions')}
                >
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Acción</p>
                        <p className="mt-2 text-lg font-black text-slate-900">Guardar pronósticos</p>
                    </div>
                    <Trophy className="h-6 w-6 text-lime-700" />
                </button>

                <Link
                    className="flex items-center justify-between rounded-[2rem] bg-white p-5 text-left shadow-sm"
                    to="/join"
                >
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Acción</p>
                        <p className="mt-2 text-lg font-black text-slate-900">Unirme con código</p>
                    </div>
                    <Users className="h-6 w-6 text-slate-600" />
                </Link>
            </section>
        </div>
    );
};

export default Dashboard;
