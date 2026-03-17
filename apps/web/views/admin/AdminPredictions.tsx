import React from 'react';
import { Filter } from 'lucide-react';
import { useAdminPredictionsStore } from '../../stores/admin.predictions.store';
import AdminPagination from '../../components/admin/AdminPagination';

const AdminPredictions: React.FC = () => {
    const { predictions, total, filters, isLoading, error, fetchPredictions, setFilters } = useAdminPredictionsStore();

    React.useEffect(() => {
        fetchPredictions();
    }, [filters, fetchPredictions]);

    const formatDate = (d: string) => new Date(d).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
    });

    const getResultColor = (pred: any) => {
        if (!pred.match.homeScore == null) return 'text-slate-400';
        if (pred.homeScore === pred.match.homeScore && pred.awayScore === pred.match.awayScore) return 'text-lime-600';
        return 'text-slate-600';
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">Pronósticos</h1>
                <p className="text-sm text-slate-500 mt-1">{total.toLocaleString()} pronósticos en el sistema</p>
            </div>

            {/* Filters */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <Filter size={16} className="text-slate-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Filtros de búsqueda</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    <input
                        value={filters.matchId ?? ''}
                        onChange={(e) => setFilters({ matchId: e.target.value || undefined, page: 1 })}
                        placeholder="ID del partido..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                        value={filters.leagueId ?? ''}
                        onChange={(e) => setFilters({ leagueId: e.target.value || undefined, page: 1 })}
                        placeholder="ID de la liga..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                        value={filters.userId ?? ''}
                        onChange={(e) => setFilters({ userId: e.target.value || undefined, page: 1 })}
                        placeholder="ID del usuario..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="grid grid-cols-[1fr_2fr_auto] md:grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Usuario</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Partido</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Predicho</p>
                    <p className="hidden md:block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Real</p>
                    <p className="hidden md:block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Puntos</p>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
                ) : error ? (
                    <div className="p-8 text-center text-rose-500 text-sm">{error}</div>
                ) : predictions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No se encontraron pronósticos</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {predictions.map((pred) => (
                            <div key={pred.id} className="grid grid-cols-[1fr_2fr_auto] md:grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 items-center hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-2 min-w-0">
                                    <img
                                        src={pred.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(pred.user.name)}&background=e2e8f0&color=64748b`}
                                        className="w-7 h-7 rounded-full flex-shrink-0"
                                        alt={pred.user.name}
                                    />
                                    <p className="text-xs font-bold text-slate-700 truncate">{pred.user.name}</p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">
                                        {pred.match.homeTeam.name} vs {pred.match.awayTeam.name}
                                    </p>
                                    <p className="text-[10px] text-slate-400">{pred.league.name}</p>
                                </div>
                                <p className={`text-sm font-black ${getResultColor(pred)}`}>
                                    {pred.homeScore} – {pred.awayScore}
                                </p>
                                <p className="hidden md:block text-sm text-slate-500">
                                    {pred.match.homeScore != null
                                        ? `${pred.match.homeScore} – ${pred.match.awayScore}`
                                        : '—'}
                                </p>
                                <p className={`hidden md:block text-sm font-black ${pred.points != null && pred.points > 0 ? 'text-lime-600' : 'text-slate-400'}`}>
                                    {pred.points ?? '—'}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AdminPagination
                page={filters.page}
                limit={filters.limit}
                total={total}
                onPageChange={(p) => setFilters({ page: p })}
            />
        </div>
    );
};

export default AdminPredictions;
