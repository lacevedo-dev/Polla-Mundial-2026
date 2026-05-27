import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Trophy, Plus, Pencil, Trash2, Globe, Lock, ChevronRight,
    X, Check, AlertTriangle, Loader2, Flag, Users, Search,
    CheckSquare, Square, ListFilter,
} from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request, ApiError } from '../api';

interface Tournament {
    id: string;
    name: string;
    country: string | null;
    season: string | null;
    logoUrl: string | null;
    active: boolean;
}

interface TeamInfo {
    id: string;
    name: string;
    code: string;
    flagUrl: string | null;
}

interface MatchItem {
    id: string;
    matchNumber: number | null;
    matchDate: string;
    phase: string;
    group: string | null;
    venue: string | null;
    status: string;
    round: string | null;
    homeTeam: TeamInfo;
    awayTeam: TeamInfo;
}

interface CorpLeague {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    participantsCount: number;
    isMember: boolean;
    myPoints: number;
    status?: string;
    primaryTournamentId?: string | null;
}

interface FormState {
    name: string;
    description: string;
    privacy: 'PUBLIC' | 'PRIVATE';
    maxParticipants: string;
    primaryTournamentId: string;
}

const EMPTY_FORM: FormState = {
    name: '',
    description: '',
    privacy: 'PRIVATE',
    maxParticipants: '',
    primaryTournamentId: '',
};

type ModalMode = 'create' | 'edit' | null;

const PHASE_LABELS: Record<string, string> = {
    GROUP: 'Fase de Grupos',
    ROUND_OF_32: 'Dieciseisavos',
    ROUND_OF_16: 'Octavos de Final',
    QUARTER: 'Cuartos de Final',
    SEMI: 'Semifinales',
    THIRD_PLACE: 'Tercer Puesto',
    FINAL: 'Final',
};

const PHASE_ORDER: Record<string, number> = {
    GROUP: 1, ROUND_OF_32: 2, ROUND_OF_16: 3, QUARTER: 4, SEMI: 5, THIRD_PLACE: 6, FINAL: 7,
};

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'America/Bogota' });
}
function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
}

// ── Selector de partidos (modal interno) ────────────────────────────────────
function MatchSelectorModal({
    tournamentId,
    selectedIds,
    onConfirm,
    onClose,
}: {
    tournamentId: string;
    selectedIds: Set<string>;
    onConfirm: (ids: Set<string>) => void;
    onClose: () => void;
}) {
    const [matches, setMatches] = useState<MatchItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

    const [search, setSearch] = useState('');
    const [filterPhase, setFilterPhase] = useState('');
    const [filterGroup, setFilterGroup] = useState('');
    const [sortBy, setSortBy] = useState<'date' | 'phase' | 'group' | 'number'>('date');
    const [groupBy, setGroupBy] = useState<'phase' | 'group' | 'date' | 'none'>('phase');

    useEffect(() => {
        setLoading(true);
        setLoadError(null);
        request<{ matches: MatchItem[]; total: number }>(`/corp/tournaments/${tournamentId}/matches`)
            .then(({ matches: m }) => {
                setMatches(m);
                setSelected(new Set(m.map(x => x.id)));
            })
            .catch((e) => {
                setLoadError(e?.message ?? 'No se pudieron cargar los partidos. Verifica que el servidor esté actualizado.');
            })
            .finally(() => setLoading(false));
    }, [tournamentId]);

    const phases = useMemo(() => [...new Set(matches.map(m => m.phase))].sort((a, b) => (PHASE_ORDER[a] ?? 9) - (PHASE_ORDER[b] ?? 9)), [matches]);
    const groups = useMemo(() => [...new Set(matches.map(m => m.group).filter(Boolean))] as string[], [matches]);

    const filtered = useMemo(() => {
        let list = [...matches];
        if (filterPhase) list = list.filter(m => m.phase === filterPhase);
        if (filterGroup) list = list.filter(m => m.group === filterGroup);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(m =>
                m.homeTeam.name.toLowerCase().includes(q) ||
                m.awayTeam.name.toLowerCase().includes(q) ||
                m.homeTeam.code.toLowerCase().includes(q) ||
                m.awayTeam.code.toLowerCase().includes(q) ||
                (m.venue ?? '').toLowerCase().includes(q) ||
                (m.group ?? '').toLowerCase().includes(q) ||
                String(m.matchNumber ?? '').includes(q),
            );
        }
        list.sort((a, b) => {
            if (sortBy === 'date') return new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
            if (sortBy === 'phase') return (PHASE_ORDER[a.phase] ?? 9) - (PHASE_ORDER[b.phase] ?? 9);
            if (sortBy === 'group') return (a.group ?? 'Z').localeCompare(b.group ?? 'Z');
            if (sortBy === 'number') return (a.matchNumber ?? 999) - (b.matchNumber ?? 999);
            return 0;
        });
        return list;
    }, [matches, filterPhase, filterGroup, search, sortBy]);

    const grouped = useMemo(() => {
        if (groupBy === 'none') return { '': filtered };
        const map: Record<string, MatchItem[]> = {};
        filtered.forEach(m => {
            let key = '';
            if (groupBy === 'phase') key = PHASE_LABELS[m.phase] ?? m.phase;
            else if (groupBy === 'group') key = m.group ? `Grupo ${m.group}` : 'Sin grupo';
            else if (groupBy === 'date') key = formatDate(m.matchDate);
            (map[key] = map[key] ?? []).push(m);
        });
        return map;
    }, [filtered, groupBy]);

    const toggleMatch = useCallback((id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const toggleGroup = useCallback((ids: string[]) => {
        const allSel = ids.every(id => selected.has(id));
        setSelected(prev => {
            const next = new Set(prev);
            ids.forEach(id => allSel ? next.delete(id) : next.add(id));
            return next;
        });
    }, [selected]);

    const selectAll = () => setSelected(new Set(filtered.map(m => m.id)));
    const selectNone = () => setSelected(new Set());

    const groupKeys = Object.keys(grouped);
    const sortedGroupKeys = groupBy === 'phase'
        ? groupKeys.sort((a, b) => {
            const pa = Object.entries(PHASE_LABELS).find(([, v]) => v === a)?.[0] ?? '';
            const pb = Object.entries(PHASE_LABELS).find(([, v]) => v === b)?.[0] ?? '';
            return (PHASE_ORDER[pa] ?? 9) - (PHASE_ORDER[pb] ?? 9);
        })
        : groupKeys;

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="font-black text-slate-900 text-lg">Seleccionar partidos</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {selected.size} seleccionados de {matches.length} partidos totales
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
                </div>

                {/* Controles */}
                <div className="px-5 py-3 border-b border-slate-100 shrink-0 space-y-2">
                    {/* Búsqueda */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar equipo, grupo, sede..."
                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2"
                            style={{ '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any}
                        />
                    </div>

                    {/* Filtros y orden */}
                    <div className="flex flex-wrap gap-2">
                        {/* Fase */}
                        <select
                            value={filterPhase}
                            onChange={e => setFilterPhase(e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                        >
                            <option value="">Todas las fases</option>
                            {phases.map(p => <option key={p} value={p}>{PHASE_LABELS[p] ?? p}</option>)}
                        </select>

                        {/* Grupo */}
                        {groups.length > 0 && (
                            <select
                                value={filterGroup}
                                onChange={e => setFilterGroup(e.target.value)}
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                            >
                                <option value="">Todos los grupos</option>
                                {groups.map(g => <option key={g} value={g}>Grupo {g}</option>)}
                            </select>
                        )}

                        {/* Ordenar */}
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                        >
                            <option value="date">Ordenar por fecha</option>
                            <option value="phase">Ordenar por fase</option>
                            <option value="group">Ordenar por grupo</option>
                            <option value="number">Ordenar por N°</option>
                        </select>

                        {/* Agrupar */}
                        <select
                            value={groupBy}
                            onChange={e => setGroupBy(e.target.value as any)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                        >
                            <option value="phase">Agrupar por fase</option>
                            <option value="group">Agrupar por grupo</option>
                            <option value="date">Agrupar por fecha</option>
                            <option value="none">Sin agrupación</option>
                        </select>

                        {/* Acciones masivas */}
                        <div className="ml-auto flex gap-1.5">
                            <button
                                onClick={selectAll}
                                className="text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-colors hover:bg-slate-50 border-slate-200 text-slate-600"
                            >
                                Todos ({filtered.length})
                            </button>
                            <button
                                onClick={selectNone}
                                className="text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-colors hover:bg-slate-50 border-slate-200 text-slate-600"
                            >
                                Ninguno
                            </button>
                        </div>
                    </div>

                    {/* Contadores de estado */}
                    <div className="flex gap-3 text-xs text-slate-500">
                        <span>Mostrando <strong className="text-slate-700">{filtered.length}</strong> partidos</span>
                        {filterPhase && <span className="text-amber-600 font-medium">• {PHASE_LABELS[filterPhase] ?? filterPhase}</span>}
                        {filterGroup && <span className="text-amber-600 font-medium">• Grupo {filterGroup}</span>}
                    </div>
                </div>

                {/* Lista de partidos */}
                <div className="flex-1 overflow-y-auto px-5 py-3">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-40 gap-2 text-slate-400">
                            <Loader2 size={24} className="animate-spin text-slate-300" />
                            <p className="text-xs">Cargando partidos...</p>
                        </div>
                    ) : loadError ? (
                        <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                            <AlertTriangle size={28} className="mb-2 text-red-300" />
                            <p className="text-sm font-semibold text-red-500">Error al cargar partidos</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-xs">{loadError}</p>
                            <button
                                onClick={() => {
                                    setLoading(true);
                                    setLoadError(null);
                                    request<{ matches: MatchItem[]; total: number }>(`/corp/tournaments/${tournamentId}/matches`)
                                        .then(({ matches: m }) => { setMatches(m); setSelected(new Set(m.map(x => x.id))); })
                                        .catch((e) => setLoadError(e?.message ?? 'Error al cargar partidos.'))
                                        .finally(() => setLoading(false));
                                }}
                                className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <Search size={28} className="mb-2 text-slate-200" />
                            <p className="text-sm font-medium">Sin resultados</p>
                            <p className="text-xs mt-1">Prueba con otros filtros</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sortedGroupKeys.map(gKey => {
                                const gMatches = grouped[gKey];
                                const gIds = gMatches.map(m => m.id);
                                const allGroupSel = gIds.every(id => selected.has(id));
                                const someGroupSel = gIds.some(id => selected.has(id));
                                return (
                                    <div key={gKey}>
                                        {groupBy !== 'none' && gKey && (
                                            <div className="flex items-center gap-2 mb-2">
                                                <button
                                                    onClick={() => toggleGroup(gIds)}
                                                    className="flex items-center gap-1.5 text-xs font-black text-slate-600 hover:text-slate-900 transition-colors"
                                                >
                                                    {allGroupSel
                                                        ? <CheckSquare size={13} style={{ color: 'var(--color-primary,#f59e0b)' }} />
                                                        : someGroupSel
                                                        ? <CheckSquare size={13} className="text-slate-400" />
                                                        : <Square size={13} className="text-slate-300" />
                                                    }
                                                    <span className="uppercase tracking-wide">{gKey}</span>
                                                </button>
                                                <span className="text-xs text-slate-400 font-normal">({gIds.length} partidos)</span>
                                                <div className="flex-1 h-px bg-slate-100" />
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            {gMatches.map(match => {
                                                const isSel = selected.has(match.id);
                                                return (
                                                    <button
                                                        key={match.id}
                                                        onClick={() => toggleMatch(match.id)}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                                                            isSel
                                                                ? 'border-current'
                                                                : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                        style={isSel ? {
                                                            borderColor: 'var(--color-primary,#f59e0b)',
                                                            backgroundColor: 'color-mix(in srgb, var(--color-primary,#f59e0b) 8%, white)',
                                                        } : {}}
                                                    >
                                                        {/* Checkbox */}
                                                        <div className="shrink-0">
                                                            {isSel
                                                                ? <CheckSquare size={16} style={{ color: 'var(--color-primary,#f59e0b)' }} />
                                                                : <Square size={16} className="text-slate-300" />
                                                            }
                                                        </div>

                                                        {/* Número */}
                                                        {match.matchNumber && (
                                                            <span className="shrink-0 text-xs font-bold text-slate-400 w-6 text-right">
                                                                #{match.matchNumber}
                                                            </span>
                                                        )}

                                                        {/* Equipos */}
                                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                {match.homeTeam.flagUrl && (
                                                                    <img src={match.homeTeam.flagUrl} alt="" className="w-5 h-4 object-cover rounded-sm shrink-0" />
                                                                )}
                                                                <span className="text-sm font-bold text-slate-800 truncate">{match.homeTeam.name}</span>
                                                            </div>
                                                            <span className="text-xs text-slate-400 font-bold shrink-0">vs</span>
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                {match.awayTeam.flagUrl && (
                                                                    <img src={match.awayTeam.flagUrl} alt="" className="w-5 h-4 object-cover rounded-sm shrink-0" />
                                                                )}
                                                                <span className="text-sm font-bold text-slate-800 truncate">{match.awayTeam.name}</span>
                                                            </div>
                                                        </div>

                                                        {/* Meta */}
                                                        <div className="shrink-0 text-right hidden sm:block">
                                                            <p className="text-xs font-semibold text-slate-600">{formatDate(match.matchDate)}</p>
                                                            <p className="text-xs text-slate-400">{formatTime(match.matchDate)}</p>
                                                        </div>

                                                        {/* Fase/Grupo badge */}
                                                        <div className="shrink-0 hidden md:flex flex-col items-end gap-1">
                                                            {match.group && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                                    G-{match.group}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                                                                {PHASE_LABELS[match.phase] ?? match.phase}
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-100 shrink-0 flex items-center gap-3">
                    <div className="flex-1">
                        <p className="text-sm font-bold text-slate-700">
                            {selected.size === 0
                                ? 'Sin partidos seleccionados'
                                : selected.size === matches.length
                                ? `Todos los partidos seleccionados (${selected.size})`
                                : `${selected.size} de ${matches.length} partidos seleccionados`
                            }
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {selected.size === 0
                                ? 'Selecciona al menos un partido para continuar'
                                : 'Los participantes podrán pronosticar estos partidos'
                            }
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm(selected)}
                        className="px-5 py-2 rounded-xl text-sm font-bold text-black transition-all hover:brightness-90"
                        style={{ backgroundColor: 'var(--color-primary,#f59e0b)' }}
                    >
                        <span className="flex items-center gap-1.5">
                            <Check size={14} />
                            Confirmar selección
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminCorpLeagues() {
    const [leagues, setLeagues] = useState<CorpLeague[]>([]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);

    const [modal, setModal] = useState<ModalMode>(null);
    const [editTarget, setEditTarget] = useState<CorpLeague | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [deleteTarget, setDeleteTarget] = useState<CorpLeague | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [showMatchSelector, setShowMatchSelector] = useState(false);
    const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        Promise.all([
            request<CorpLeague[]>('/corp/leagues'),
            request<Tournament[]>('/corp/tournaments'),
        ])
            .then(([l, t]) => { setLeagues(l); setTournaments(t); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    async function handleTournamentChange(tournamentId: string) {
        setForm(f => ({ ...f, primaryTournamentId: tournamentId }));
        setSelectedMatchIds(new Set());
        if (tournamentId) {
            try {
                const { matches } = await request<{ matches: MatchItem[]; total: number }>(
                    `/corp/tournaments/${tournamentId}/matches`
                );
                setSelectedMatchIds(new Set(matches.map(m => m.id)));
            } catch { /* silencioso */ }
        }
    }

    function openCreate() {
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setSelectedMatchIds(new Set());
        setError(null);
        setModal('create');
    }

    function openEdit(league: CorpLeague) {
        setEditTarget(league);
        setForm({
            name: league.name,
            description: league.description ?? '',
            privacy: league.isPublic ? 'PUBLIC' : 'PRIVATE',
            maxParticipants: '',
            primaryTournamentId: league.primaryTournamentId ?? '',
        });
        setSelectedMatchIds(new Set());
        setError(null);
        setModal('edit');
    }

    function closeModal() {
        setModal(null);
        setEditTarget(null);
        setError(null);
        setShowMatchSelector(false);
    }

    async function handleSave() {
        if (!form.name.trim()) { setError('El nombre es obligatorio.'); return; }
        setSaving(true);
        setError(null);
        try {
            if (modal === 'create') {
                const payload: any = {
                    name: form.name.trim(),
                    description: form.description.trim() || undefined,
                    privacy: form.privacy,
                    ...(form.maxParticipants ? { maxParticipants: parseInt(form.maxParticipants) } : {}),
                    ...(form.primaryTournamentId ? { primaryTournamentId: form.primaryTournamentId } : {}),
                };
                const created = await request<any>('/corp/leagues', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                const newLeague: CorpLeague = {
                    id: created.id,
                    name: created.name,
                    description: created.description,
                    isPublic: created.privacy === 'PUBLIC',
                    participantsCount: 1,
                    isMember: true,
                    myPoints: 0,
                    status: created.status,
                    primaryTournamentId: created.primaryTournamentId,
                };
                setLeagues((prev) => [newLeague, ...prev]);
                setSuccess(selectedMatchIds.size > 0
                    ? `Polla creada con ${selectedMatchIds.size} partidos asignados.`
                    : 'Polla creada exitosamente.');
            } else if (modal === 'edit' && editTarget) {
                const updatePayload: any = {
                    name: form.name.trim(),
                    description: form.description.trim() || undefined,
                    privacy: form.privacy,
                    ...(form.maxParticipants ? { maxParticipants: parseInt(form.maxParticipants) } : {}),
                };
                await request(`/corp/leagues/${editTarget.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(updatePayload),
                });
                if (form.primaryTournamentId !== (editTarget.primaryTournamentId ?? '')) {
                    await request(`/corp/leagues/${editTarget.id}/tournament`, {
                        method: 'POST',
                        body: JSON.stringify({ tournamentId: form.primaryTournamentId || null }),
                    });
                }
                setLeagues((prev) =>
                    prev.map((l) =>
                        l.id === editTarget.id
                            ? { ...l, name: form.name.trim(), description: form.description.trim() || null, isPublic: form.privacy === 'PUBLIC', primaryTournamentId: form.primaryTournamentId || null }
                            : l,
                    ),
                );
                setSuccess('Polla actualizada.');
            }
            closeModal();
            setTimeout(() => setSuccess(null), 4000);
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Error al guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await request(`/corp/leagues/${deleteTarget.id}`, { method: 'DELETE' });
            setLeagues((prev) => prev.filter((l) => l.id !== deleteTarget.id));
            setDeleteTarget(null);
            setSuccess('Polla eliminada.');
            setTimeout(() => setSuccess(null), 4000);
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'No se pudo eliminar la polla.');
            setDeleteTarget(null);
        } finally {
            setDeleting(false);
        }
    }

    const activeTournaments = tournaments.filter((t) => t.active);
    const inactiveTournaments = tournaments.filter((t) => !t.active);
    const selectedTournament = tournaments.find(t => t.id === form.primaryTournamentId);

    return (
        <CorpLayout>
            {/* Header */}
            <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Trophy size={20} className="text-amber-500" />
                        <h1 className="text-2xl font-black text-slate-900">Gestión de pollas</h1>
                    </div>
                    <p className="text-slate-500 text-sm">Crea y administra las pollas de tu organización</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black shadow-sm hover:brightness-90 transition-all"
                    style={{ backgroundColor: 'var(--color-primary, #f59e0b)' }}
                >
                    <Plus size={16} />
                    Nueva polla
                </button>
            </div>

            {/* Success toast */}
            {success && (
                <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium">
                    <Check size={16} />
                    {success}
                </div>
            )}

            {/* Error toast */}
            {error && !modal && (
                <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            {/* Lista de pollas */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-black text-slate-900">Pollas del tenant</h2>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2.5 py-1">
                        {leagues.length} pollas
                    </span>
                </div>

                {loading ? (
                    <div className="p-10 flex justify-center">
                        <Loader2 size={24} className="animate-spin text-slate-400" />
                    </div>
                ) : leagues.length === 0 ? (
                    <div className="p-10 text-center">
                        <Trophy size={36} className="mx-auto mb-3 text-slate-200" />
                        <p className="text-slate-500 font-semibold">No hay pollas creadas aún</p>
                        <p className="text-slate-400 text-sm mt-1">Crea la primera polla para tu organización</p>
                        <button
                            onClick={openCreate}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black"
                            style={{ backgroundColor: 'var(--color-primary, #f59e0b)' }}
                        >
                            <Plus size={15} />
                            Crear polla
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {leagues.map((league) => {
                            const tournament = tournaments.find((t) => t.id === league.primaryTournamentId);
                            return (
                                <div key={league.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 12%, white)' }}
                                    >
                                        <Trophy size={16} style={{ color: 'var(--color-primary, #f59e0b)' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-slate-800 text-sm truncate">{league.name}</p>
                                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full ${league.isPublic ? 'bg-sky-50 text-sky-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {league.isPublic ? <Globe size={10} /> : <Lock size={10} />}
                                                {league.isPublic ? 'Pública' : 'Privada'}
                                            </span>
                                            {league.status && (
                                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${league.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : league.status === 'SETUP' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {league.status === 'ACTIVE' ? 'Activa' : league.status === 'SETUP' ? 'Configurando' : league.status}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                                            <span className="flex items-center gap-1"><Users size={10} />{league.participantsCount} participantes</span>
                                            {tournament && (
                                                <span className="flex items-center gap-1">
                                                    <Flag size={10} />
                                                    {tournament.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Link
                                            to={`/pollas/${league.id}`}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                            title="Ver polla"
                                        >
                                            <ChevronRight size={15} />
                                        </Link>
                                        <button
                                            onClick={() => openEdit(league)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                            title="Editar"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteTarget(league)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal crear / editar */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-900 text-lg">
                                {modal === 'create' ? 'Nueva polla' : 'Editar polla'}
                            </h3>
                            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {error && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-sm">
                                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}

                            {/* Nombre */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre de la polla *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="ej. Polla Mundial 2026"
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent"
                                    style={{ '--tw-ring-color': 'var(--color-primary, #f59e0b)' } as any}
                                />
                            </div>

                            {/* Descripción */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Descripción</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Descripción opcional de la polla..."
                                    rows={2}
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent resize-none"
                                />
                            </div>

                            {/* Privacidad */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Privacidad</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['PRIVATE', 'PUBLIC'] as const).map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, privacy: p }))}
                                            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${form.privacy === p ? 'border-current' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                            style={form.privacy === p ? { borderColor: 'var(--color-primary, #f59e0b)', backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 10%, white)', color: 'var(--color-primary, #f59e0b)' } : {}}
                                        >
                                            {p === 'PRIVATE' ? <Lock size={14} /> : <Globe size={14} />}
                                            {p === 'PRIVATE' ? 'Privada' : 'Pública'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Máx participantes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Máximo de participantes</label>
                                <input
                                    type="number"
                                    min={2}
                                    max={500}
                                    value={form.maxParticipants}
                                    onChange={(e) => setForm((f) => ({ ...f, maxParticipants: e.target.value }))}
                                    placeholder="Sin límite"
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent"
                                />
                                <p className="text-xs text-slate-400 mt-1">Déjalo vacío para sin límite (máx 500)</p>
                            </div>

                            {/* Torneo */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Torneo / Competición</label>
                                <select
                                    value={form.primaryTournamentId}
                                    onChange={(e) => handleTournamentChange(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                                >
                                    <option value="">— Sin torneo asignado —</option>
                                    {activeTournaments.length > 0 && (
                                        <optgroup label="Torneos activos">
                                            {activeTournaments.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name}{t.season ? ` (${t.season})` : ''}{t.country ? ` · ${t.country}` : ''}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {inactiveTournaments.length > 0 && (
                                        <optgroup label="Torneos anteriores">
                                            {inactiveTournaments.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name}{t.season ? ` (${t.season})` : ''}{t.country ? ` · ${t.country}` : ''}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>

                            {/* Selector de partidos */}
                            {form.primaryTournamentId && (
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-4 py-3 bg-slate-50 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-slate-700">Partidos de la polla</p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {selectedMatchIds.size === 0
                                                    ? 'Ningún partido seleccionado'
                                                    : `${selectedMatchIds.size} partido${selectedMatchIds.size !== 1 ? 's' : ''} seleccionado${selectedMatchIds.size !== 1 ? 's' : ''}`}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowMatchSelector(true)}
                                            className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors hover:bg-white"
                                            style={{ borderColor: 'var(--color-primary,#f59e0b)', color: 'var(--color-primary,#f59e0b)' }}
                                        >
                                            <ListFilter size={13} />
                                            {selectedMatchIds.size === 0 ? 'Seleccionar' : 'Editar selección'}
                                        </button>
                                    </div>
                                    {selectedMatchIds.size > 0 && (
                                        <div className="px-4 py-2.5 flex items-center gap-2 text-xs text-slate-500">
                                            <CheckSquare size={13} style={{ color: 'var(--color-primary,#f59e0b)' }} />
                                            <span>
                                                <strong className="text-slate-700">{selectedMatchIds.size}</strong> partidos habilitados
                                                {selectedTournament && <span className="text-slate-400"> · {selectedTournament.name}</span>}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={closeModal}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-60 transition-all hover:brightness-90"
                                style={{ backgroundColor: 'var(--color-primary, #f59e0b)' }}
                            >
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                                {modal === 'create' ? 'Crear polla' : 'Guardar cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal confirmar eliminación */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                        <div className="px-6 py-5 text-center">
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Trash2 size={22} className="text-red-500" />
                            </div>
                            <h3 className="font-black text-slate-900 text-lg mb-1">¿Eliminar polla?</h3>
                            <p className="text-slate-500 text-sm">
                                Vas a eliminar <strong className="text-slate-700">"{deleteTarget.name}"</strong>. Esta acción no se puede deshacer.
                            </p>
                            {error && (
                                <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-sm">
                                    <AlertTriangle size={14} className="shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>
                        <div className="px-6 pb-5 flex gap-3">
                            <button
                                onClick={() => { setDeleteTarget(null); setError(null); }}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-60 transition-colors"
                            >
                                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Modal selector de partidos ───────────────────────────── */}
            {showMatchSelector && form.primaryTournamentId && (
                <MatchSelectorModal
                    tournamentId={form.primaryTournamentId}
                    selectedIds={selectedMatchIds}
                    onConfirm={(ids) => { setSelectedMatchIds(ids); setShowMatchSelector(false); }}
                    onClose={() => setShowMatchSelector(false)}
                />
            )}
        </CorpLayout>
    );
}
