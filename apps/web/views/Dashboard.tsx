import React, { useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock,
    Coins,
    ListChecks,
    PlusCircle,
    Settings,
    Trophy,
    Users,
} from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore } from '../stores/prediction.store';
import { useDashboardStore } from '../stores/dashboard.store';
import { useAuthStore } from '../stores/auth.store';
import { ErrorBanner } from '../components/dashboard/ErrorBanner';

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

function safeText(value?: string | null, fallback = 'Sin datos'): string {
    return value?.trim() || fallback;
}

const compactCard =
    'rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const activeLeague = useLeagueStore((state) => state.activeLeague);
    const myLeagues = useLeagueStore((state) => state.myLeagues);
    const leagueLoading = useLeagueStore((state) => state.isLoading);
    const fetchMyLeagues = useLeagueStore((state) => state.fetchMyLeagues);
    const fetchLeagueDetails = useLeagueStore((state) => state.fetchLeagueDetails);
    const setActiveLeague = useLeagueStore((state) => state.setActiveLeague);
    const matches = usePredictionStore((state) => state.matches);
    const leaderboard = usePredictionStore((state) => state.leaderboard);
    const fetchLeagueMatches = usePredictionStore((state) => state.fetchLeagueMatches);
    const fetchLeaderboard = usePredictionStore((state) => state.fetchLeaderboard);
    const resetLeagueData = usePredictionStore((state) => state.resetLeagueData);
    const stats = useDashboardStore((state) => state.stats);
    const leagues = useDashboardStore((state) => state.leagues);
    const predictions = useDashboardStore((state) => state.predictions);
    const dashboardLoading = useDashboardStore((state) => state.loading);
    const dashboardError = useDashboardStore((state) => state.error);
    const fetchDashboardData = useDashboardStore((state) => state.fetchDashboardData);
    const [error, setError] = React.useState<string | null>(null);

    const isLoading = leagueLoading || dashboardLoading;

    const upcomingMatches = useMemo(() => matches.slice(0, 2), [matches]);
    const topPlayers = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);

    const totalPredictions = (stats?.aciertos || 0) + (stats?.errores || 0);
    const currentAccuracy = stats?.tasa || 0;

    const handleDashboardRetry = useCallback(() => {
        void fetchDashboardData(true);
    }, [fetchDashboardData]);

    useEffect(() => {
        if (user) {
            void fetchDashboardData().catch(() => {
                // handled by store
            });
        }
    }, [user, fetchDashboardData]);

    useEffect(() => {
        if (myLeagues.length > 0) {
            return;
        }

        void fetchMyLeagues().catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible cargar tus ligas.');
        });
    }, [fetchMyLeagues, myLeagues.length]);

    useEffect(() => {
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

    if (!isLoading && myLeagues.length === 0 && !error) {
        return (
            <div className="space-y-5">
                <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lime-100 text-lime-700">
                        <Trophy className="h-7 w-7" />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Aún no tienes ligas</h1>
                    <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
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
        <div className="space-y-5 pb-10">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-lime-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-lime-700">
                            Panel principal
                        </span>
                        {activeLeague?.settings.plan ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                                Plan {activeLeague.settings.plan}
                            </span>
                        ) : null}
                    </div>
                    <h1 className="text-2xl font-black font-brand uppercase tracking-tight text-slate-900 sm:text-3xl">
                        Dashboard
                    </h1>
                    <p className="text-sm text-slate-500">
                        Bienvenido, {user?.name || 'usuario'}
                    </p>
                    {activeLeague?.name ? (
                        <p className="text-lg font-black uppercase tracking-tight text-slate-900">
                            {activeLeague.name}
                        </p>
                    ) : null}
                </div>

                <div className="flex flex-col gap-2 sm:min-w-[240px]">
                    <label
                        className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
                        htmlFor="dashboard-league-select"
                    >
                        Liga activa
                    </label>
                    <select
                        id="dashboard-league-select"
                        aria-label="Liga activa"
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
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

            {dashboardError && (
                <ErrorBanner message={dashboardError} onRetry={handleDashboardRetry} dismissable={true} />
            )}

            {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[
                    { label: 'Aciertos', value: stats?.aciertos || 0, accent: 'text-lime-600' },
                    { label: 'Errores', value: stats?.errores || 0, accent: 'text-rose-600' },
                    { label: 'Racha', value: stats?.racha || 0, accent: 'text-amber-600' },
                    { label: 'Tasa %', value: currentAccuracy.toFixed(1), accent: 'text-blue-600' },
                ].map((item) => (
                    <div key={item.label} className={`${compactCard} space-y-2`} aria-label={`${item.label}: ${item.value}`}>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                        <p className={`text-2xl font-black ${item.accent}`}>{item.value}</p>
                    </div>
                ))}
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_0.95fr_1.1fr]">
                <div className="space-y-5">
                    <article className={`${compactCard} space-y-4 bg-slate-950 text-white`}>
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                                Estado financiero
                            </p>
                            <Coins className="h-4 w-4 text-lime-400" />
                        </div>
                        <div>
                            <p className="text-3xl font-black font-brand leading-none text-white">
                                {activeLeague?.stats.totalPrize || formatCurrency(activeLeague?.settings.baseFee, activeLeague?.settings.currency)}
                            </p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                Bolsa estimada
                            </p>
                        </div>
                        <div className="space-y-2 border-t border-white/10 pt-3 text-[11px] font-bold">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Mi rol</span>
                                <span>{activeLeague?.role === 'ADMIN' ? 'Administrador' : 'Participante'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Participantes</span>
                                <span>
                                    {activeLeague?.stats.memberCount ?? 0}
                                    {activeLeague?.settings.maxParticipants
                                        ? ` / ${activeLeague.settings.maxParticipants}`
                                        : ''}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Cuota base</span>
                                <span>
                                    {formatCurrency(activeLeague?.settings.baseFee, activeLeague?.settings.currency)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Código</span>
                                <span>{activeLeague?.code || 'Sin código disponible'}</span>
                            </div>
                        </div>
                        <button
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-lime-400 text-[10px] font-black uppercase tracking-[0.2em] text-slate-950"
                            onClick={() => navigate('/create-league')}
                        >
                            <Settings className="h-4 w-4" /> Crear / gestionar
                        </button>
                    </article>

                    <article className={`${compactCard} space-y-4`}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                                Reglas de puntos
                            </h2>
                            <ListChecks className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="space-y-2">
                            {[
                                { label: 'Marcador exacto', value: '5' },
                                { label: 'Ganador acertado', value: '2' },
                                { label: 'Gol acertado', value: '1' },
                            ].map((rule) => (
                                <div
                                    key={rule.label}
                                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                                >
                                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                                        {rule.label}
                                    </span>
                                    <span className="text-sm font-black text-lime-600">{rule.value}</span>
                                </div>
                            ))}
                        </div>
                    </article>

                    <article className={`${compactCard} space-y-4`}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                                Premios
                            </h2>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                {activeLeague?.stats.totalPrize || 'Sin bolsa'}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {[
                                { label: '1er puesto', width: '60%', value: '60%' },
                                { label: '2do puesto', width: '30%', value: '30%' },
                                { label: '3er puesto', width: '10%', value: '10%' },
                            ].map((prize) => (
                                <div key={prize.label} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                        <span>{prize.label}</span>
                                        <span className="text-lime-600">{prize.value}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div className="h-full rounded-full bg-lime-400" style={{ width: prize.width }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </article>
                </div>

                <div className="space-y-5">
                    <article className={`${compactCard} space-y-4`}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                                Tus ligas
                            </h2>
                            <Users className="h-4 w-4 text-slate-400" />
                        </div>

                        {leagues && leagues.length > 0 ? (
                            <div className="space-y-2">
                                {leagues.slice(0, 3).map((league) => (
                                    <div
                                        key={league.id}
                                        className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                                        aria-label={`Liga ${league.nombre}, posición ${league.posicion}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black uppercase text-slate-900">
                                                    {league.nombre}
                                                </p>
                                                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                    {league.participantes} participantes
                                                </p>
                                            </div>
                                            <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm">
                                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                    Pos.
                                                </p>
                                                <p className="text-sm font-black text-lime-600">#{league.posicion}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                                <p className="text-sm font-medium text-slate-500">No participas en ligas</p>
                            </div>
                        )}
                    </article>

                    <article className={`${compactCard} space-y-4`}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                                Mi resumen
                            </h2>
                            <Clock className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-amber-50 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Racha</p>
                                <p className="mt-2 text-3xl font-black text-amber-900">{stats?.racha || 0}</p>
                            </div>
                            <div className="rounded-2xl bg-blue-50 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Tasa</p>
                                <p className="mt-2 text-3xl font-black text-blue-900">{currentAccuracy.toFixed(1)}%</p>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Total de predicciones
                            </p>
                            <p className="mt-2 text-xl font-black text-slate-900">{totalPredictions}</p>
                        </div>
                    </article>
                </div>

                <div className="space-y-5">
                    <article className={`${compactCard} space-y-4`}>
                        <div className="flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                                <Trophy className="h-4 w-4 text-lime-500" /> Top actual
                            </h2>
                            <button
                                className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 hover:text-slate-700"
                                onClick={() => navigate('/ranking')}
                            >
                                Ver más
                            </button>
                        </div>

                        {topPlayers.length > 0 ? (
                            <div className="space-y-2">
                                {topPlayers.map((player) => (
                                    <div
                                        key={player.id}
                                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                                    >
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-[10px] font-black text-white">
                                            #{player.rank}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-black uppercase text-slate-900">
                                                {player.name}
                                            </p>
                                            <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                @{player.username}
                                            </p>
                                        </div>
                                        <span className="text-sm font-black text-lime-600">{player.points} pts</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                                El ranking todavía no tiene datos para esta liga.
                            </div>
                        )}
                    </article>

                    <article className={`${compactCard} space-y-4`}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                                Próximos partidos
                            </h2>
                            <Link
                                to="/predictions"
                                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 hover:text-lime-700"
                            >
                                Ver todos <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>

                        {upcomingMatches.length > 0 ? (
                            <div className="space-y-2">
                                {upcomingMatches.map((match) => (
                                    <div
                                        key={match.id}
                                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                    {safeText(match.displayDate, match.date)}
                                                </p>
                                                <p className="mt-1 text-sm font-black uppercase text-slate-900">
                                                    {match.homeTeam} vs {match.awayTeam}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">{safeText(match.venue, 'Por definir')}</p>
                                            </div>
                                            {match.saved ? (
                                                <div className="flex items-center gap-1 rounded-full bg-lime-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-lime-700">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Guardado
                                                </div>
                                            ) : (
                                                <div className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                                                    Activo
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                                Aún no hay partidos cargados o el backend todavía no expone predicciones para esta liga.
                            </div>
                        )}
                    </article>

                    <article className={`${compactCard} space-y-4`}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                                Predicciones recientes
                            </h2>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                {predictions?.length || 0} items
                            </span>
                        </div>

                        {predictions && predictions.length > 0 ? (
                            <div className="space-y-2">
                                {predictions.slice(0, 3).map((prediction) => (
                                    <div
                                        key={prediction.id}
                                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-slate-900">{prediction.match}</p>
                                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                Tu pronóstico {prediction.tuPrediccion}
                                            </p>
                                        </div>
                                        <div
                                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                                prediction.acierto
                                                    ? 'bg-lime-100 text-lime-700'
                                                    : 'bg-rose-100 text-rose-700'
                                            }`}
                                        >
                                            {prediction.acierto ? 'Acierto' : 'Error'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                                <p className="text-sm text-slate-500">Aún no haces predicciones</p>
                                <Link
                                    to="/predictions"
                                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-sm font-bold uppercase text-slate-900"
                                >
                                    Ir a pronósticos <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        )}
                    </article>
                </div>
            </section>

            {activeLeague && (
                <section className="grid gap-3 sm:grid-cols-3">
                    <button
                        className="flex items-center justify-between rounded-[1.5rem] bg-slate-900 px-5 py-4 text-left text-white"
                        onClick={() => navigate('/create-league')}
                    >
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-300">Acción</p>
                            <p className="mt-1 text-sm font-black uppercase">Crear otra liga</p>
                        </div>
                        <PlusCircle className="h-5 w-5" />
                    </button>

                    <button
                        className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-left"
                        onClick={() => navigate('/predictions')}
                    >
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Acción</p>
                            <p className="mt-1 text-sm font-black uppercase text-slate-900">Guardar pronósticos</p>
                        </div>
                        <Trophy className="h-5 w-5 text-lime-700" />
                    </button>

                    <Link
                        className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-left"
                        to="/join"
                    >
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Acción</p>
                            <p className="mt-1 text-sm font-black uppercase text-slate-900">Unirme con código</p>
                        </div>
                        <Users className="h-5 w-5 text-slate-600" />
                    </Link>
                </section>
            )}
        </div>
    );
};

export default Dashboard;
