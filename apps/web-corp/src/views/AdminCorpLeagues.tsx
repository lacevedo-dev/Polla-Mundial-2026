import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Trophy, Plus, Pencil, Trash2, Globe, Lock, ChevronRight,
    X, Check, AlertTriangle, Loader2, Flag, Users,
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

    useEffect(() => {
        Promise.all([
            request<CorpLeague[]>('/corp/leagues'),
            request<Tournament[]>('/corp/tournaments'),
        ])
            .then(([l, t]) => { setLeagues(l); setTournaments(t); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    function openCreate() {
        setEditTarget(null);
        setForm(EMPTY_FORM);
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
        setError(null);
        setModal('edit');
    }

    function closeModal() {
        setModal(null);
        setEditTarget(null);
        setError(null);
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
                setSuccess('Polla creada exitosamente.');
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
                                    onChange={(e) => setForm((f) => ({ ...f, primaryTournamentId: e.target.value }))}
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
                                <p className="text-xs text-slate-400 mt-1">Define qué partidos estarán disponibles para pronosticar</p>
                            </div>
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
        </CorpLayout>
    );
}
