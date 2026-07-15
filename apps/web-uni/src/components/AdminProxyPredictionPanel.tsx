import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, Loader2, Search, UserPlus, X } from 'lucide-react';
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
    matches: FormMatch[];
}

interface MembersSearchResponse {
    data: Array<{
        userId: string;
        name: string;
        username: string;
        status: string;
    }>;
}

const MIN_SEARCH_LEN = 2;

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

function MemberSearchField({
    disabled,
    selected,
    onSelect,
    onClear,
}: {
    disabled?: boolean;
    selected: FormMember | null;
    onSelect: (member: FormMember) => void;
    onClear: () => void;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<FormMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function onDocClick(event: MouseEvent) {
            if (!wrapRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const trimmed = query.trim().replace(/\s+/g, ' ');
        if (trimmed.length < MIN_SEARCH_LEN) {
            setResults([]);
            setLoading(false);
            setHint(trimmed.length === 0 ? null : `Escribe al menos ${MIN_SEARCH_LEN} caracteres`);
            return;
        }

        setLoading(true);
        setHint(null);
        debounceRef.current = setTimeout(() => {
            const params = new URLSearchParams({
                page: '1',
                limit: '20',
                search: trimmed,
            });
            request<MembersSearchResponse>(`/corp/members?${params}`)
                .then((res) => {
                    const list = (res?.data ?? [])
                        .filter((row) => row.status === 'ACTIVE')
                        .map((row) => ({
                            id: row.userId,
                            name: row.name,
                            username: row.username,
                        }));
                    setResults(list);
                    setOpen(true);
                    setHint(list.length === 0 ? 'Sin coincidencias' : null);
                })
                .catch(() => {
                    setResults([]);
                    setHint('No se pudo buscar');
                })
                .finally(() => setLoading(false));
        }, 350);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    if (selected) {
        return (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{selected.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{selected.username}</p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        onClear();
                        setQuery('');
                        setResults([]);
                        setHint(null);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-600"
                    title="Cambiar participante"
                >
                    <X size={14} />
                </button>
            </div>
        );
    }

    return (
        <div ref={wrapRef} className="relative">
            <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="search"
                    value={query}
                    disabled={disabled}
                    placeholder={disabled ? 'Elige una polla primero' : 'Buscar por nombre o documento…'}
                    onChange={(event) => setQuery(event.target.value)}
                    onFocus={() => {
                        if (results.length > 0) setOpen(true);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-700 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {loading ? (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                ) : null}
            </div>
            {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
            {open && results.length > 0 ? (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {results.map((member) => (
                        <li key={member.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    onSelect(member);
                                    setQuery('');
                                    setResults([]);
                                    setOpen(false);
                                }}
                                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-amber-50"
                            >
                                <span className="text-sm font-bold text-slate-800">{member.name}</span>
                                <span className="text-[11px] text-slate-500">{member.username}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

export function AdminProxyPredictionPanel({ onSaved }: { onSaved?: () => void }) {
    const [open, setOpen] = useState(false);
    const [formOptions, setFormOptions] = useState<FormOptionsResponse>({
        leagues: [],
        matches: [],
    });
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [leagueId, setLeagueId] = useState('');
    const [selectedMember, setSelectedMember] = useState<FormMember | null>(null);
    const [matchId, setMatchId] = useState('');
    const [matchFilter, setMatchFilter] = useState('');
    const [homeScore, setHomeScore] = useState('0');
    const [awayScore, setAwayScore] = useState('0');
    const [advanceTeamId, setAdvanceTeamId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoadingOptions(true);
        const qs = leagueId ? `?leagueId=${encodeURIComponent(leagueId)}` : '';
        request<FormOptionsResponse>(`/corp/predictions/admin/form-options${qs}`)
            .then((payload) => {
                if (cancelled) return;
                setFormOptions({
                    leagues: payload.leagues ?? [],
                    matches: payload.matches ?? [],
                });
            })
            .catch((err) => {
                if (cancelled) return;
                setFormOptions({ leagues: [], matches: [] });
                setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las opciones');
            })
            .finally(() => {
                if (!cancelled) setLoadingOptions(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, leagueId]);

    const selectedMatch = useMemo(
        () => formOptions.matches.find((match) => match.id === matchId),
        [formOptions.matches, matchId],
    );

    const filteredMatches = useMemo(() => {
        const q = matchFilter.trim().toLowerCase();
        if (!q) return formOptions.matches;
        return formOptions.matches.filter((match) => formatMatchOption(match).toLowerCase().includes(q));
    }, [formOptions.matches, matchFilter]);

    const homeScoreNum = Number.parseInt(homeScore, 10);
    const awayScoreNum = Number.parseInt(awayScore, 10);
    const showAdvance = needsAdvanceTeam(
        selectedMatch,
        Number.isFinite(homeScoreNum) ? homeScoreNum : 0,
        Number.isFinite(awayScoreNum) ? awayScoreNum : 0,
    );

    function resetForm() {
        setLeagueId('');
        setSelectedMember(null);
        setMatchId('');
        setMatchFilter('');
        setHomeScore('0');
        setAwayScore('0');
        setAdvanceTeamId('');
        setError(null);
        setSuccess(null);
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        if (!leagueId || !selectedMember || !matchId) {
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
                    userId: selectedMember.id,
                    matchId,
                    homeScore: homeScoreNum,
                    awayScore: awayScoreNum,
                    advanceTeamId: showAdvance ? advanceTeamId : undefined,
                }),
            });
            const scoredNote =
                selectedMatch?.status === 'FINISHED' ? ' Puntos recalculados.' : '';
            setSuccess(`Pronóstico guardado para ${selectedMember.name}.${scoredNote}`);
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
        <div className="mb-4">
            {!open ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 transition hover:bg-amber-100"
                >
                    <UserPlus size={15} />
                    Ingresar predicción por participante
                </button>
            ) : (
                <form
                    onSubmit={(event) => void handleSubmit(event)}
                    className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/90 to-white px-4 py-4 shadow-sm"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <UserPlus size={16} className="mt-0.5 shrink-0 text-amber-600" />
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                                    Admin · Ingresar por participante
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Busca al usuario por nombre o documento. Omite el cierre de ventana e incluye
                                    partidos finalizados (recalcula puntos al guardar).
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                resetForm();
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-white"
                        >
                            <ChevronUp size={14} />
                            Cerrar
                        </button>
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
                                    setMatchId('');
                                    setMatchFilter('');
                                    setAdvanceTeamId('');
                                    setError(null);
                                    setSuccess(null);
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                                <option value="">
                                    {loadingOptions && !formOptions.leagues.length
                                        ? 'Cargando...'
                                        : 'Seleccionar polla'}
                                </option>
                                {formOptions.leagues.map((league) => (
                                    <option key={league.id} value={league.id}>
                                        {league.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="block">
                            <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Participante
                            </span>
                            <MemberSearchField
                                disabled={!leagueId}
                                selected={selectedMember}
                                onSelect={(member) => {
                                    setSelectedMember(member);
                                    setError(null);
                                    setSuccess(null);
                                }}
                                onClear={() => setSelectedMember(null)}
                            />
                        </div>

                        <label className="block">
                            <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Partido
                            </span>
                            <input
                                type="search"
                                value={matchFilter}
                                disabled={!leagueId}
                                placeholder="Filtrar partido…"
                                onChange={(event) => setMatchFilter(event.target.value)}
                                className="mb-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
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
                                          : filteredMatches.length === 0
                                            ? 'Sin partidos'
                                            : 'Seleccionar partido'}
                                </option>
                                {filteredMatches.map((match) => (
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
            )}
        </div>
    );
}
