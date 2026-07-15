import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { ApiError, request } from '../api';

interface FormLeague {
    id: string;
    name: string;
}

interface FormMember {
    id: string;
    name: string;
    username: string;
}

interface FormTeam {
    id: string;
    name: string;
    flagUrl?: string | null;
    code?: string | null;
    shortCode?: string | null;
}

interface FormMatch {
    id: string;
    matchDate: string;
    status?: string;
    phase: string;
    group?: string | null;
    round?: string | null;
    homeTeamId: string;
    awayTeamId: string;
    homeScore?: number | null;
    awayScore?: number | null;
    homeTeam: FormTeam;
    awayTeam: FormTeam;
}

interface FormOptionsResponse {
    leagues: FormLeague[];
    members: FormMember[];
    matches: FormMatch[];
}

function teamCode(team: FormTeam): string {
    return (team.shortCode ?? team.code ?? team.name.slice(0, 3)).toUpperCase();
}

function formatMatchOption(match: FormMatch): string {
    const date = new Date(match.matchDate).toLocaleString('es-CO', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
    const teams = `${teamCode(match.homeTeam)} vs ${teamCode(match.awayTeam)}`;
    if (match.status === 'FINISHED') {
        const score =
            match.homeScore != null && match.awayScore != null
                ? ` ${match.homeScore}-${match.awayScore}`
                : '';
        return `${teams} · Finalizado${score} · ${date}`;
    }
    return `${teams} · ${date}`;
}

function needsAdvanceTeam(match: FormMatch | undefined, homeScore: number, awayScore: number): boolean {
    if (!match) return false;
    if (match.phase === 'GROUP' || match.phase === 'THIRD_PLACE') return false;
    return homeScore === awayScore;
}

export function AdminProxyPredictionPanel({ onSaved }: { onSaved?: () => void }) {
    const [formOptions, setFormOptions] = useState<FormOptionsResponse>({
        leagues: [],
        members: [],
        matches: [],
    });
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [leagueId, setLeagueId] = useState('');
    const [userId, setUserId] = useState('');
    const [matchId, setMatchId] = useState('');
    const [homeScore, setHomeScore] = useState('0');
    const [awayScore, setAwayScore] = useState('0');
    const [advanceTeamId, setAdvanceTeamId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoadingOptions(true);
        const qs = leagueId ? `?leagueId=${encodeURIComponent(leagueId)}` : '';
        request<FormOptionsResponse>(`/corp/predictions/admin/form-options${qs}`)
            .then((payload) => {
                if (cancelled) return;
                setFormOptions(payload);
            })
            .catch((err) => {
                if (cancelled) return;
                setFormOptions({ leagues: [], members: [], matches: [] });
                setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las opciones');
            })
            .finally(() => {
                if (!cancelled) setLoadingOptions(false);
            });
        return () => {
            cancelled = true;
        };
    }, [leagueId]);

    const selectedMatch = useMemo(
        () => formOptions.matches.find((match) => match.id === matchId),
        [formOptions.matches, matchId],
    );
    const selectedMember = useMemo(
        () => formOptions.members.find((member) => member.id === userId),
        [formOptions.members, userId],
    );

    const homeScoreNum = Number.parseInt(homeScore, 10);
    const awayScoreNum = Number.parseInt(awayScore, 10);
    const showAdvance = needsAdvanceTeam(
        selectedMatch,
        Number.isFinite(homeScoreNum) ? homeScoreNum : 0,
        Number.isFinite(awayScoreNum) ? awayScoreNum : 0,
    );

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        if (!leagueId || !userId || !matchId) {
            setError('Selecciona polla, participante y partido.');
            return;
        }
        if (!Number.isFinite(homeScoreNum) || !Number.isFinite(awayScoreNum) || homeScoreNum < 0 || awayScoreNum < 0) {
            setError('El marcador debe ser un número entero mayor o igual a 0.');
            return;
        }
        if (showAdvance && !advanceTeamId) {
            setError('En eliminatorias con empate debes indicar qué equipo clasifica.');
            return;
        }

        setSubmitting(true);
        try {
            await request('/corp/predictions/for-user', {
                method: 'POST',
                body: JSON.stringify({
                    leagueId,
                    userId,
                    matchId,
                    homeScore: homeScoreNum,
                    awayScore: awayScoreNum,
                    advanceTeamId: showAdvance ? advanceTeamId : undefined,
                }),
            });
            const label = selectedMember?.name ?? 'el participante';
            const scoredNote =
                selectedMatch?.status === 'FINISHED' ? ' Puntos recalculados.' : '';
            setSuccess(`Pronóstico guardado para ${label}.${scoredNote}`);
            setHomeScore('0');
            setAwayScore('0');
            setAdvanceTeamId('');
            onSaved?.();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudo guardar el pronóstico');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form
            onSubmit={(event) => void handleSubmit(event)}
            className="mb-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/90 to-white px-4 py-4 shadow-sm"
        >
            <div className="flex items-start gap-3">
                <UserPlus size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                        SUPERADMIN · Ingresar por participante
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        Carga o corrige el marcador de un usuario específico. Omite el cierre de ventana e incluye
                        partidos finalizados: al guardar se calculan los puntos automáticamente.
                    </p>
                    {selectedMember ? (
                        <p className="mt-1 text-xs font-bold text-amber-800">
                            Ingresando como SUPERADMIN para {selectedMember.name}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Polla
                    </span>
                    <select
                        value={leagueId}
                        onChange={(event) => {
                            setLeagueId(event.target.value);
                            setUserId('');
                            setMatchId('');
                            setAdvanceTeamId('');
                            setError(null);
                            setSuccess(null);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                        <option value="">
                            {loadingOptions && !formOptions.leagues.length ? 'Cargando...' : 'Seleccionar polla'}
                        </option>
                        {formOptions.leagues.map((league) => (
                            <option key={league.id} value={league.id}>
                                {league.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Participante
                    </span>
                    <select
                        value={userId}
                        disabled={!leagueId}
                        onChange={(event) => {
                            setUserId(event.target.value);
                            setError(null);
                            setSuccess(null);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                        <option value="">
                            {!leagueId
                                ? 'Elige una polla primero'
                                : loadingOptions
                                  ? 'Cargando...'
                                  : formOptions.members.length === 0
                                    ? 'Sin miembros activos'
                                    : 'Seleccionar participante'}
                        </option>
                        {formOptions.members.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.name} ({member.username})
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Partido
                    </span>
                    <select
                        value={matchId}
                        disabled={!leagueId}
                        onChange={(event) => {
                            setMatchId(event.target.value);
                            setAdvanceTeamId('');
                            setError(null);
                            setSuccess(null);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                        <option value="">
                            {!leagueId
                                ? 'Elige una polla primero'
                                : loadingOptions
                                  ? 'Cargando...'
                                  : formOptions.matches.length === 0
                                    ? 'Sin partidos disponibles'
                                    : 'Seleccionar partido'}
                        </option>
                        {formOptions.matches.map((match) => (
                            <option key={match.id} value={match.id}>
                                {formatMatchOption(match)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
                <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        {selectedMatch ? selectedMatch.homeTeam.name : 'Local'}
                    </span>
                    <input
                        type="number"
                        min={0}
                        value={homeScore}
                        onChange={(event) => {
                            setHomeScore(event.target.value);
                            setAdvanceTeamId('');
                            setError(null);
                            setSuccess(null);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                </label>

                <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        {selectedMatch ? selectedMatch.awayTeam.name : 'Visitante'}
                    </span>
                    <input
                        type="number"
                        min={0}
                        value={awayScore}
                        onChange={(event) => {
                            setAwayScore(event.target.value);
                            setAdvanceTeamId('');
                            setError(null);
                            setSuccess(null);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                </label>

                {showAdvance && selectedMatch ? (
                    <label className="block sm:col-span-2 lg:col-span-1">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                            Clasifica
                        </span>
                        <select
                            value={advanceTeamId}
                            onChange={(event) => setAdvanceTeamId(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">¿Quién clasifica?</option>
                            <option value={selectedMatch.homeTeamId}>{selectedMatch.homeTeam.name}</option>
                            <option value={selectedMatch.awayTeamId}>{selectedMatch.awayTeam.name}</option>
                        </select>
                    </label>
                ) : (
                    <div className="hidden lg:block" />
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                    {submitting ? 'Guardando...' : 'Guardar predicción'}
                </button>
            </div>

            {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
            {success ? <p className="mt-3 text-sm font-semibold text-emerald-700">{success}</p> : null}
        </form>
    );
}
