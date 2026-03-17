import React from 'react';
import { Search, ChevronDown, Save } from 'lucide-react';
import { useAdminPlansStore } from '../../stores/admin.plans.store';
import StatusBadge from '../../components/admin/StatusBadge';
import AdminPagination from '../../components/admin/AdminPagination';

const PLANS = ['FREE', 'GOLD', 'DIAMOND'];

const AdminAffiliations: React.FC = () => {
    const { affiliations, totalAffiliations, affiliationsPage, isSaving, isLoading, fetchAffiliations, updateAffiliation } = useAdminPlansStore();
    const [search, setSearch] = React.useState('');
    const [planFilter, setPlanFilter] = React.useState('');
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editingPlan, setEditingPlan] = React.useState('');

    React.useEffect(() => {
        fetchAffiliations(affiliationsPage, search, planFilter);
    }, [affiliationsPage]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchAffiliations(1, search, planFilter);
    };

    const handleSavePlan = async (userId: string) => {
        await updateAffiliation(userId, editingPlan);
        setEditingId(null);
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">Afiliaciones</h1>
                <p className="text-sm text-slate-500 mt-1">Gestiona el plan de cada usuario</p>
            </div>

            {/* Filters */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-3">
                    <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nombre o email..."
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                        <button type="submit" className="px-4 py-2.5 bg-amber-400 text-slate-950 font-bold rounded-xl text-sm hover:bg-amber-500 transition-all">
                            Buscar
                        </button>
                    </form>
                    <div className="relative">
                        <select
                            value={planFilter}
                            onChange={(e) => { setPlanFilter(e.target.value); fetchAffiliations(1, search, e.target.value); }}
                            className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">Todos los planes</option>
                            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="grid grid-cols-[2fr_auto] md:grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Usuario</p>
                    <p className="hidden md:block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Plan Actual</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cambiar Plan</p>
                </div>
                {isLoading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
                ) : affiliations.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No se encontraron usuarios</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {affiliations.map((user) => (
                            <div key={user.id} className="grid grid-cols-[2fr_auto] md:grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-3.5 items-center">
                                <div className="flex items-center gap-3 min-w-0">
                                    <img
                                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=e2e8f0&color=64748b`}
                                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                        alt={user.name}
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                    </div>
                                </div>
                                <div className="hidden md:block"><StatusBadge status={user.plan} size="md" /></div>
                                <div>
                                    {editingId === user.id ? (
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <select
                                                value={editingPlan}
                                                onChange={(e) => setEditingPlan(e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                            >
                                                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                            <button
                                                onClick={() => handleSavePlan(user.id)}
                                                disabled={isSaving}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-500 disabled:opacity-60 transition-all"
                                            >
                                                <Save size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setEditingId(user.id); setEditingPlan(user.plan); }}
                                            className="text-xs font-bold text-amber-600 hover:underline"
                                        >
                                            Cambiar
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AdminPagination
                page={affiliationsPage}
                limit={20}
                total={totalAffiliations}
                onPageChange={(p) => fetchAffiliations(p, search, planFilter)}
            />
        </div>
    );
};

export default AdminAffiliations;
