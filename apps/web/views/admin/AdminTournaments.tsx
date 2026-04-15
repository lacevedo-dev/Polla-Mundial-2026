import React from 'react';
import { ChevronDown, Edit3, Plus, Search, Trash2, Trophy, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useAdminTournamentsStore } from '../../stores/admin.tournaments.store';
import AdminPagination from '../../components/admin/AdminPagination';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import StatusBadge from '../../components/admin/StatusBadge';

const TOURNAMENT_TYPES = [
    { value: 'WORLD_CUP', label: 'Copa del Mundo' },
    { value: 'CONTINENTAL', label: 'Continental' },
    { value: 'LEAGUE', label: 'Liga' },
    { value: 'CUP', label: 'Copa' },
    { value: 'OTHER', label: 'Otro' },
];

const formatDate = (d: string) => new Date(d).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
});

const TournamentDialog: React.FC<{
    tournament: any;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}> = ({ tournament, open, onOpenChange }) => {
    const { createTournament, updateTournament, isSaving } = useAdminTournamentsStore();
    const isEdit = Boolean(tournament);

    const [form, setForm] = React.useState({
        name: tournament?.name ?? '',
        country: tournament?.country ?? '',
        season: tournament?.season ?? new Date().getFullYear(),
        logoUrl: tournament?.logoUrl ?? '',
        type: tournament?.type ?? 'WORLD_CUP',
        active: tournament?.active ?? true,
    });

    React.useEffect(() => {
        if (tournament) {
            setForm({
                name: tournament.name,
                country: tournament.country ?? '',
                season: tournament.season,
                logoUrl: tournament.logoUrl ?? '',
                type: tournament.type,
                active: tournament.active,
            });
        }
    }, [tournament]);

    const handleSave = async () => {
        try {
            if (isEdit) {
                await updateTournament(tournament.id, form);
            } else {
                await createTournament(form);
            }
            onOpenChange(false);
            setForm({
                name: '',
                country: '',
                season: new Date().getFullYear(),
                logoUrl: '',
                type: 'WORLD_CUP',
                active: true,
            });
        } catch (error) {
            console.error('Error saving tournament:', error);
        }
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <DialogPrimitive.Title className="text-xl font-bold text-slate-900">
                            {isEdit ? 'Editar Torneo' : 'Crear Torneo'}
                        </DialogPrimitive.Title>
                        <DialogPrimitive.Close className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                            <X size={20} />
                        </DialogPrimitive.Close>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                Nombre del Torneo *
                            </label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                placeholder="Ej: Copa Mundial FIFA 2026"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                    País
                                </label>
                                <input
                                    type="text"
                                    value={form.country}
                                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                    placeholder="Ej: México"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                    Temporada *
                                </label>
                                <input
                                    type="number"
                                    value={form.season}
                                    onChange={(e) => setForm({ ...form, season: parseInt(e.target.value) })}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                    placeholder="2026"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                Tipo de Torneo *
                            </label>
                            <div className="relative">
                                <select
                                    value={form.type}
                                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                                    className="w-full appearance-none rounded-xl border border-slate-300 px-4 py-2.5 pr-10 text-sm focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                >
                                    {TOURNAMENT_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                URL del Logo
                            </label>
                            <input
                                type="text"
                                value={form.logoUrl}
                                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                placeholder="https://..."
                            />
                            {form.logoUrl && (
                                <div className="mt-2 flex items-center gap-2">
                                    <img
                                        src={form.logoUrl}
                                        alt="Preview"
                                        className="h-12 w-12 object-contain rounded-lg border border-slate-200"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                    <span className="text-xs text-slate-500">Vista previa</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="active"
                                checked={form.active}
                                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                                className="h-5 w-5 rounded border-slate-300 text-lime-500 focus:ring-2 focus:ring-lime-400/20"
                            />
                            <label htmlFor="active" className="text-sm font-bold text-slate-700">
                                Torneo activo
                            </label>
                        </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                        <DialogPrimitive.Close className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
                            Cancelar
                        </DialogPrimitive.Close>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !form.name || !form.season}
                            className="flex-1 rounded-xl bg-lime-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear'}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

const AdminTournaments: React.FC = () => {
    const { tournaments, total, filters, isLoading, fetchTournaments, deleteTournament, setFilters } = useAdminTournamentsStore();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [editTournament, setEditTournament] = React.useState<any>(null);
    const [showCreate, setShowCreate] = React.useState(false);
    const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

    React.useEffect(() => {
        fetchTournaments();
    }, [fetchTournaments]);

    const handleDelete = async (id: string) => {
        try {
            await deleteTournament(id);
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting tournament:', error);
        }
    };

    const filteredTournaments = React.useMemo(() => {
        if (!searchQuery) return tournaments;
        const q = searchQuery.toLowerCase();
        return tournaments.filter((t) =>
            t.name.toLowerCase().includes(q) ||
            t.country?.toLowerCase().includes(q) ||
            String(t.season).includes(q)
        );
    }, [tournaments, searchQuery]);

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 md:text-3xl">Torneos</h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Gestiona los torneos disponibles en la plataforma
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-lime-500 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-lime-500/30 transition-all hover:bg-lime-600 hover:shadow-md hover:shadow-lime-500/40"
                >
                    <Plus size={18} />
                    Crear Torneo
                </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar por nombre, país o temporada..."
                                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                            />
                        </div>

                        <div className="flex gap-2">
                            <div className="relative">
                                <select
                                    value={filters.active === undefined ? '' : String(filters.active)}
                                    onChange={(e) => setFilters({ active: e.target.value === '' ? undefined : e.target.value === 'true', page: 1 })}
                                    className="appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-sm font-bold focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                >
                                    <option value="">Todos</option>
                                    <option value="true">Activos</option>
                                    <option value="false">Inactivos</option>
                                </select>
                                <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>

                            <div className="relative">
                                <select
                                    value={filters.type ?? ''}
                                    onChange={(e) => setFilters({ type: e.target.value || undefined, page: 1 })}
                                    className="appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-sm font-bold focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-400/20"
                                >
                                    <option value="">Todos los tipos</option>
                                    {TOURNAMENT_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-lime-500" />
                    </div>
                ) : filteredTournaments.length === 0 ? (
                    <div className="py-16 text-center">
                        <Trophy size={48} className="mx-auto mb-3 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-600">
                            {searchQuery ? 'No se encontraron torneos' : 'No hay torneos creados'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => setShowCreate(true)}
                                className="mt-4 text-sm font-bold text-lime-600 hover:text-lime-700"
                            >
                                Crear el primer torneo
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-slate-200">
                            {filteredTournaments.map((tournament) => (
                                <div
                                    key={tournament.id}
                                    className="flex items-center gap-4 p-4 transition-colors hover:bg-slate-50"
                                >
                                    {tournament.logoUrl && (
                                        <img
                                            src={tournament.logoUrl}
                                            alt={tournament.name}
                                            className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-contain"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="truncate text-base font-bold text-slate-900">
                                                {tournament.name}
                                            </h3>
                                            <StatusBadge
                                                status={tournament.active ? 'active' : 'inactive'}
                                                label={tournament.active ? 'Activo' : 'Inactivo'}
                                            />
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                                            {tournament.country && (
                                                <span className="font-semibold">{tournament.country}</span>
                                            )}
                                            <span className="font-semibold">Temporada {tournament.season}</span>
                                            <span className="text-slate-400">
                                                {TOURNAMENT_TYPES.find((t) => t.value === tournament.type)?.label ?? tournament.type}
                                            </span>
                                            <span className="text-slate-400">
                                                Creado {formatDate(tournament.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        <button
                                            onClick={() => setEditTournament(tournament)}
                                            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                            title="Editar"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(tournament.id)}
                                            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-slate-200 p-4">
                            <AdminPagination
                                currentPage={filters.page}
                                totalPages={Math.ceil(total / filters.limit)}
                                onPageChange={(page) => setFilters({ page })}
                            />
                        </div>
                    </>
                )}
            </div>

            <TournamentDialog
                tournament={editTournament}
                open={!!editTournament || showCreate}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditTournament(null);
                        setShowCreate(false);
                    }
                }}
            />

            <ConfirmDialog
                open={!!deleteConfirm}
                onOpenChange={(open) => !open && setDeleteConfirm(null)}
                title="Eliminar Torneo"
                description="¿Estás seguro de que deseas eliminar este torneo? Esta acción no se puede deshacer."
                onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
                confirmText="Eliminar"
                variant="danger"
            />
        </div>
    );
};

export default AdminTournaments;
