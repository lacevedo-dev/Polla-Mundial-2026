import React from 'react';
import { ChevronDown, FileDown, Plus, Search, Trophy, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminTournamentsStore } from '../../stores/admin.tournaments.store';
import AdminPagination from '../../components/admin/AdminPagination';
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


const AdminTournaments: React.FC = () => {
    const navigate = useNavigate();
    const { tournaments, total, filters, isLoading, updateTournament, fetchTournaments, setFilters } = useAdminTournamentsStore();
    const [searchQuery, setSearchQuery] = React.useState('');

    React.useEffect(() => {
        fetchTournaments();
    }, [fetchTournaments]);

    const handleToggleActive = async (id: string, currentActive: boolean) => {
        try {
            await updateTournament(id, { active: !currentActive });
        } catch (error) {
            console.error('Error updating tournament:', error);
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
                        Torneos importados desde la API de Football. Para agregar nuevos torneos, usa la opción "Importar torneo" en Partidos.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/admin/matches')}
                    className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-amber-500/30 transition-all hover:bg-amber-600 hover:shadow-md hover:shadow-amber-500/40"
                >
                    <FileDown size={18} />
                    Importar Torneo
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
                            {searchQuery ? 'No se encontraron torneos' : 'No hay torneos importados'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => navigate('/admin/matches')}
                                className="mt-4 text-sm font-bold text-amber-600 hover:text-amber-700"
                            >
                                Ir a Partidos para importar torneos
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
                                            onClick={() => handleToggleActive(tournament.id, tournament.active)}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                                                tournament.active
                                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                    : 'bg-lime-100 text-lime-700 hover:bg-lime-200'
                                            }`}
                                            title={tournament.active ? 'Desactivar' : 'Activar'}
                                        >
                                            {tournament.active ? 'Desactivar' : 'Activar'}
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

        </div>
    );
};

export default AdminTournaments;
