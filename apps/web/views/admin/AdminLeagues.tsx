import React from 'react';
import { Search, Eye, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminLeaguesStore } from '../../stores/admin.leagues.store';
import StatusBadge from '../../components/admin/StatusBadge';
import AdminPagination from '../../components/admin/AdminPagination';

const STATUSES = ['SETUP', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED'];
const PLANS = ['FREE', 'GOLD', 'DIAMOND'];

const AdminLeagues: React.FC = () => {
    const navigate = useNavigate();
    const { leagues, total, filters, isLoading, fetchLeagues, setFilters } = useAdminLeaguesStore();
    const [searchInput, setSearchInput] = React.useState('');

    React.useEffect(() => {
        fetchLeagues();
    }, [filters, fetchLeagues]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setFilters({ search: searchInput, page: 1 });
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">Pollas</h1>
                <p className="text-sm text-slate-500 mt-1">{total.toLocaleString()} pollas en el sistema</p>
            </div>

            {/* Filters */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-3">
                    <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Buscar por nombre..."
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                        <button type="submit" className="px-4 py-2.5 bg-amber-400 text-slate-950 font-bold rounded-xl text-sm hover:bg-amber-500 transition-all">
                            Buscar
                        </button>
                    </form>
                    <div className="flex gap-2">
                        <div className="relative">
                            <select
                                value={filters.status ?? ''}
                                onChange={(e) => setFilters({ status: e.target.value || undefined, page: 1 })}
                                className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                                <option value="">Todos los estados</option>
                                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <div className="relative">
                            <select
                                value={filters.plan ?? ''}
                                onChange={(e) => setFilters({ plan: e.target.value || undefined, page: 1 })}
                                className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                                <option value="">Todos los planes</option>
                                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr_80px_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Polla</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Plan</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Miembros</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ver</p>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
                ) : leagues.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No se encontraron pollas</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {leagues.map((league) => (
                            <div key={league.id} className="grid grid-cols-[2fr_1fr_1fr_80px_auto] gap-4 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-800 truncate">{league.name}</p>
                                    <p className="text-xs text-slate-400 font-mono truncate">{league.code}</p>
                                </div>
                                <StatusBadge status={league.plan} />
                                <StatusBadge status={league.status} />
                                <p className="text-sm font-bold text-slate-600">{league._count?.members ?? 0}</p>
                                <button
                                    onClick={() => navigate(`/admin/leagues/${league.id}`)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-all"
                                >
                                    <Eye size={14} />
                                </button>
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

export default AdminLeagues;
