import React from 'react';
import { AlertCircle, Save, Search, Sparkles, Ticket, Trophy } from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore, type MatchViewModel } from '../stores/prediction.store';

type DraftMap = Record<string, { home: string; away: string }>;

function buildDrafts(matches: MatchViewModel[]): DraftMap {
    return Object.fromEntries(
        matches.map((match) => [
            match.id,
            {
                home: match.prediction.home,
                away: match.prediction.away,
            },
        ]),
    );
}

const Predictions: React.FC = () => {
    const activeLeague = useLeagueStore((state) => state.activeLeague);
    const myLeagues = useLeagueStore((state) => state.myLeagues);
    const fetchMyLeagues = useLeagueStore((state) => state.fetchMyLeagues);
    const setActiveLeague = useLeagueStore((state) => state.setActiveLeague);
    const matches = usePredictionStore((state) => state.matches);
    const isLoading = usePredictionStore((state) => state.isLoading);
    const fetchLeagueMatches = usePredictionStore((state) => state.fetchLeagueMatches);
    const savePrediction = usePredictionStore((state) => state.savePrediction);
    const resetLeagueData = usePredictionStore((state) => state.resetLeagueData);
    const [drafts, setDrafts] = React.useState<DraftMap>({});
    const [searchTerm, setSearchTerm] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);
    const [savingMatchId, setSavingMatchId] = React.useState<string | null>(null);

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
            setDrafts({});
            return;
        }

        setError(null);
        void fetchLeagueMatches(activeLeague.id).catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible cargar los partidos.');
        });
    }, [activeLeague?.id, fetchLeagueMatches, resetLeagueData]);

    React.useEffect(() => {
        setDrafts(buildDrafts(matches));
    }, [matches]);

    const filteredMatches = React.useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        if (!normalizedSearch) {
            return matches;
        }

        return matches.filter((match) => {
            const haystack = `${match.homeTeam} ${match.awayTeam} ${match.venue}`.toLowerCase();
            return haystack.includes(normalizedSearch);
        });
    }, [matches, searchTerm]);

    const handleDraftChange = (matchId: string, field: 'home' | 'away', value: string) => {
        if (value && !/^\d+$/.test(value)) {
            return;
        }

        setDrafts((currentDrafts) => ({
            ...currentDrafts,
            [matchId]: {
                home: currentDrafts[matchId]?.home ?? '',
                away: currentDrafts[matchId]?.away ?? '',
                [field]: value,
            },
        }));
    };

    const handleSave = async (matchId: string) => {
        if (!activeLeague?.id) {
            return;
        }

        const nextDraft = drafts[matchId];
        if (!nextDraft || nextDraft.home === '' || nextDraft.away === '') {
            setError('Debes ingresar ambos marcadores antes de guardar el pronóstico.');
            return;
        }

        setSavingMatchId(matchId);
        setError(null);

        try {
            await savePrediction(
                activeLeague.id,
                matchId,
                Number.parseInt(nextDraft.home, 10),
                Number.parseInt(nextDraft.away, 10),
            );
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible guardar el pronóstico.');
        } finally {
            setSavingMatchId(null);
        }
    };

    return (
        <div className="space-y-8">
            <header className="rounded-[2rem] bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-lime-600">Predicciones</p>
                        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-slate-900">
                            Pronostica con datos reales
                        </h1>
                        <p className="mt-2 max-w-3xl text-sm text-slate-500">
                            Esta vista ya consume los endpoints reales de partidos y predicciones. Las secciones de invitaciones, ligas públicas y simulador seguirán en un slice posterior.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 lg:items-end">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400" htmlFor="predictions-league-select">
                            Liga activa
                        </label>
                        <select
                            id="predictions-league-select"
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

            {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            <section className="grid gap-4 md:grid-cols-3">
                <article className="rounded-[2rem] bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3 text-slate-900">
                        <Ticket className="h-5 w-5 text-lime-700" />
                        <h2 className="text-sm font-black uppercase tracking-[0.2em]">Invitaciones</h2>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                        El flujo real de invitaciones se retomará cuando el slice de lifecycle esté listo.
                    </p>
                </article>
                <article className="rounded-[2rem] bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3 text-slate-900">
                        <Trophy className="h-5 w-5 text-lime-700" />
                        <h2 className="text-sm font-black uppercase tracking-[0.2em]">Ligas públicas</h2>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                        El catálogo público quedó fuera de este slice para evitar depender de APIs inexistentes.
                    </p>
                </article>
                <article className="rounded-[2rem] bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3 text-slate-900">
                        <Sparkles className="h-5 w-5 text-lime-700" />
                        <h2 className="text-sm font-black uppercase tracking-[0.2em]">Simulador</h2>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                        El simulador de grupos permanece temporalmente deshabilitado hasta que tenga contrato backend propio.
                    </p>
                </article>
            </section>

            <section className="rounded-[2rem] bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Buscar partido</p>
                        <h2 className="mt-2 text-xl font-black text-slate-900">Matches disponibles</h2>
                    </div>
                    <label className="relative block md:w-[320px]">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Buscar por equipo o sede"
                            className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none"
                        />
                    </label>
                </div>

                {!activeLeague && !isLoading ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                        Selecciona o crea una liga para comenzar a pronosticar.
                    </div>
                ) : null}

                {activeLeague && filteredMatches.length === 0 && !isLoading ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                        No encontramos partidos con los filtros actuales.
                    </div>
                ) : null}

                <div className="space-y-4">
                    {filteredMatches.map((match) => {
                        const draft = drafts[match.id] ?? { home: '', away: '' };
                        const isSaving = savingMatchId === match.id;

                        return (
                            <article
                                key={match.id}
                                className="rounded-[2rem] border border-slate-100 p-5 shadow-sm"
                            >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                                            {match.displayDate} · {match.phase}
                                        </p>
                                        <h3 className="mt-2 text-xl font-black text-slate-900">
                                            {match.homeTeam} vs {match.awayTeam}
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500">{match.venue}</p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <input
                                            aria-label={`Marcador ${match.homeTeam}`}
                                            inputMode="numeric"
                                            value={draft.home}
                                            onChange={(event) => handleDraftChange(match.id, 'home', event.target.value)}
                                            className="h-12 w-16 rounded-2xl border border-slate-200 text-center text-lg font-black text-slate-900 outline-none"
                                        />
                                        <span className="text-xl font-black text-slate-300">-</span>
                                        <input
                                            aria-label={`Marcador ${match.awayTeam}`}
                                            inputMode="numeric"
                                            value={draft.away}
                                            onChange={(event) => handleDraftChange(match.id, 'away', event.target.value)}
                                            className="h-12 w-16 rounded-2xl border border-slate-200 text-center text-lg font-black text-slate-900 outline-none"
                                        />
                                        <button
                                            className="inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-4 py-3 text-sm font-black uppercase tracking-wide text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={isSaving}
                                            onClick={() => handleSave(match.id)}
                                        >
                                            <Save className="h-4 w-4" />
                                            {isSaving ? 'Guardando' : match.saved ? 'Actualizar' : 'Guardar'}
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                                        Estado: {match.status}
                                    </span>
                                    {match.saved ? (
                                        <span className="rounded-full bg-lime-100 px-3 py-1 font-semibold text-lime-700">
                                            Guardado: {match.prediction.home}-{match.prediction.away}
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
                                            Sin guardar
                                        </span>
                                    )}
                                    {typeof match.pointsEarned === 'number' ? (
                                        <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700">
                                            {match.pointsEarned} pts
                                        </span>
                                    ) : null}
                                    {match.result ? (
                                        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                                            Resultado final: {match.result.home}-{match.result.away}
                                        </span>
                                    ) : null}
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};

export default Predictions;
