import React from 'react';
import { Search, X } from 'lucide-react';
import { useAdminPlansStore } from '../../stores/admin.plans.store';
import StatusBadge from '../../components/admin/StatusBadge';
import AdminPagination from '../../components/admin/AdminPagination';

const PLANS = ['FREE', 'GOLD', 'DIAMOND'];

function useDebounce<T>(value: T, delay = 450): T {
    const [deb, setDeb] = React.useState(value);
    React.useEffect(() => {
        const t = setTimeout(() => setDeb(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return deb;
}

const PLAN_COLORS: Record<string, string> = {
    FREE: 'border-slate-300 text-slate-600 hover:border-slate-400',
    GOLD: 'border-amber-300 text-amber-700 hover:border-amber-500',
    DIAMOND: 'border-cyan-300 text-cyan-700 hover:border-cyan-500',
};
const PLAN_ACTIVE: Record<string, string> = {
    FREE: 'bg-slate-200 border-slate-400 text-slate-900',
    GOLD: 'bg-amber-400 border-amber-400 text-slate-950',
    DIAMOND: 'bg-cyan-400 border-cyan-400 text-slate-950',
};

const AdminAffiliations: React.FC = () => {
    const { affiliations, totalAffiliations, affiliationsPage, isSaving, isLoading, fetchAffiliations, updateAffiliation } = useAdminPlansStore();
    const [search, setSearch] = React.useState('');
    const [planFilter, setPlanFilter] = React.useState('');
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editingPlan, setEditingPlan] = React.useState('');

    const debouncedSearch = useDebounce(search, 450);

    // Auto-trigger on debounced search or plan filter change
    React.useEffect(() => {
        fetchAffiliations(1, debouncedSearch, planFilter);
    }, [debouncedSearch, planFilter]);

    // Fetch on page change (keeping current search/filter)
    React.useEffect(() => {
        fetchAffiliations(affiliationsPage, debouncedSearch, planFilter);
    }, [affiliationsPage]);

    const handleSavePlan = async (userId: string) => {
        await updateAffiliation(userId, editingPlan);
        setEditingId(null);
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-brand uppercase tracking-tight leading-tight">Afiliaciones</h1>
                <p className="text-xs text-slate-400 mt-1">Gestiona el plan de cada usuario</p>
            </div>

            {/* Filters */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                {/* Search */}
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nombre o email..."
                        className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Plan filter pills */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setPlanFilter('')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            planFilter === '' ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'
                        }`}
                    >
                        Todos
                    </button>
                    {PLANS.map((p) => (
                        <button
                            key={p}
                            onClick={() => setPlanFilter(planFilter === p ? '' : p)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                planFilter === p ? PLAN_ACTIVE[p] : PLAN_COLORS[p]
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading state */}
            {isLoading && (
                <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 flex items-center gap-3 animate-pulse">
                            <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-32 bg-slate-200 rounded-lg" />
                                <div className="h-3 w-48 bg-slate-100 rounded-lg" />
                            </div>
                            <div className="h-6 w-16 bg-slate-100 rounded-full" />
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {!isLoading && affiliations.length === 0 && (
                <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <p className="text-slate-400 text-sm">No se encontraron usuarios</p>
                    {(search || planFilter) && (
                        <button
                            onClick={() => { setSearch(''); setPlanFilter(''); }}
                            className="mt-3 text-xs font-bold text-amber-600 hover:underline"
                        >
                            Limpiar filtros
                        </button>
                    )}
                </div>
            )}

            {/* Mobile cards */}
            {!isLoading && affiliations.length > 0 && (
                <div className="md:hidden space-y-2">
                    {affiliations.map((user) => (
                        <div key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <img
                                    src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=e2e8f0&color=64748b`}
                                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                    alt={user.name}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                </div>
                                <StatusBadge status={user.plan} size="md" />
                            </div>

                            {/* Plan editor */}
                            <div className="mt-3 pt-3 border-t border-slate-100">
                                {editingId === user.id ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mr-1">Nuevo plan:</p>
                                        {PLANS.map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => setEditingPlan(p)}
                                                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                                                    editingPlan === p ? PLAN_ACTIVE[p] : `${PLAN_COLORS[p]} bg-white`
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => handleSavePlan(user.id)}
                                            disabled={isSaving || editingPlan === user.plan}
                                            className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-500 disabled:opacity-50 transition-all ml-auto"
                                        >
                                            {isSaving ? 'Guardando...' : 'Guardar'}
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="px-3 py-1 rounded-xl text-xs font-bold border border-slate-200 text-slate-500 hover:bg-slate-50"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { setEditingId(user.id); setEditingPlan(user.plan); }}
                                        className="text-xs font-bold text-amber-600 hover:underline"
                                    >
                                        Cambiar plan →
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Desktop table */}
            {!isLoading && affiliations.length > 0 && (
                <div className="hidden md:block rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Usuario</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Plan Actual</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cambiar Plan</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {affiliations.map((user) => (
                            <div key={user.id} className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-3.5 items-center hover:bg-slate-50/50 transition-colors">
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
                                <StatusBadge status={user.plan} size="md" />
                                <div>
                                    {editingId === user.id ? (
                                        <div className="flex items-center gap-1.5">
                                            {PLANS.map((p) => (
                                                <button
                                                    key={p}
                                                    onClick={() => setEditingPlan(p)}
                                                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
                                                        editingPlan === p ? PLAN_ACTIVE[p] : `${PLAN_COLORS[p]} bg-white`
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => handleSavePlan(user.id)}
                                                disabled={isSaving || editingPlan === user.plan}
                                                className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-500 disabled:opacity-50 transition-all"
                                            >
                                                {isSaving ? '...' : 'OK'}
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                            >
                                                <X size={12} />
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
                </div>
            )}

            <AdminPagination
                page={affiliationsPage}
                limit={20}
                total={totalAffiliations}
                onPageChange={(p) => fetchAffiliations(p, debouncedSearch, planFilter)}
            />
        </div>
    );
};

export default AdminAffiliations;
