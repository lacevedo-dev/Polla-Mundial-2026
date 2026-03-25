import React from 'react';
import { Search, Eye, ChevronDown, Trophy, Plus, X, Globe, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useAdminLeaguesStore } from '../../stores/admin.leagues.store';
import StatusBadge from '../../components/admin/StatusBadge';
import AdminPagination from '../../components/admin/AdminPagination';

/* ─── constants ─── */
const STATUSES = ['SETUP', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED'];
const PLANS = ['FREE', 'GOLD', 'DIAMOND'];

const planBadge: Record<string, string> = {
    FREE: 'bg-slate-100 text-slate-600',
    GOLD: 'bg-amber-100 text-amber-700',
    DIAMOND: 'bg-purple-100 text-purple-700',
};

const statusChips: { value: string; label: string; active: string; inactive: string }[] = [
    { value: '', label: 'Todas', active: 'bg-slate-900 text-white', inactive: 'bg-white text-slate-500 border border-slate-200' },
    { value: 'ACTIVE', label: 'Activas', active: 'bg-lime-500 text-white', inactive: 'bg-white text-slate-500 border border-slate-200' },
    { value: 'SETUP', label: 'En Setup', active: 'bg-blue-500 text-white', inactive: 'bg-white text-slate-500 border border-slate-200' },
    { value: 'PAUSED', label: 'Pausadas', active: 'bg-amber-500 text-white', inactive: 'bg-white text-slate-500 border border-slate-200' },
    { value: 'FINISHED', label: 'Finalizadas', active: 'bg-slate-500 text-white', inactive: 'bg-white text-slate-500 border border-slate-200' },
];

/* ─── debounce hook ─── */
function useDebounce<T>(value: T, delay = 400): T {
    const [d, setD] = React.useState(value);
    React.useEffect(() => {
        const id = setTimeout(() => setD(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return d;
}

/* ─── Create League Dialog ─── */
const CreateLeagueDialog: React.FC<{
    open: boolean;
    onOpenChange: (v: boolean) => void;
}> = ({ open, onOpenChange }) => {
    const { createLeague, isSaving } = useAdminLeaguesStore();
    const navigate = useNavigate();
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [plan, setPlan] = React.useState('FREE');
    const [privacy, setPrivacy] = React.useState('PUBLIC');
    const [error, setError] = React.useState('');

    const handleCreate = async () => {
        if (!name.trim()) { setError('El nombre es obligatorio'); return; }
        setError('');
        try {
            const league = await createLeague({ name: name.trim(), description: description.trim() || undefined, plan, privacy });
            onOpenChange(false);
            setName(''); setDescription(''); setPlan('FREE'); setPrivacy('PUBLIC');
            navigate(`/admin/leagues/${league.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al crear la polla');
        }
    };

    React.useEffect(() => {
        if (!open) { setName(''); setDescription(''); setError(''); setPlan('FREE'); setPrivacy('PUBLIC'); }
    }, [open]);

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
                <DialogPrimitive.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100vw-2rem)] max-w-md bg-white rounded-[1.75rem] shadow-2xl p-6">
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <DialogPrimitive.Title className="font-black text-lg text-slate-900 leading-tight">
                                Nueva Polla
                            </DialogPrimitive.Title>
                            <p className="text-xs text-slate-400 mt-0.5">Crear una liga de pronósticos</p>
                        </div>
                        <DialogPrimitive.Close className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                            <X size={18} />
                        </DialogPrimitive.Close>
                    </div>

                    <div className="space-y-4">
                        {/* Name */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">
                                Nombre de la polla *
                            </label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej: Polla Mundial 2026"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                autoFocus
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">
                                Descripción (opcional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Descripción breve de la polla…"
                                rows={2}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                            />
                        </div>

                        {/* Plan */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-2">Plan</label>
                            <div className="grid grid-cols-3 gap-2">
                                {PLANS.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPlan(p)}
                                        className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                                            plan === p
                                                ? p === 'DIAMOND' ? 'border-purple-400 bg-purple-50 text-purple-700 ring-2 ring-purple-200'
                                                : p === 'GOLD' ? 'border-amber-400 bg-amber-50 text-amber-700 ring-2 ring-amber-200'
                                                : 'border-slate-400 bg-slate-50 text-slate-700 ring-2 ring-slate-200'
                                                : 'border-slate-200 text-slate-400 hover:border-slate-300'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Privacy */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-2">Privacidad</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setPrivacy('PUBLIC')}
                                    className={`flex items-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-bold transition-all ${
                                        privacy === 'PUBLIC'
                                            ? 'border-lime-400 bg-lime-50 text-lime-700 ring-2 ring-lime-200'
                                            : 'border-slate-200 text-slate-400 hover:border-slate-300'
                                    }`}
                                >
                                    <Globe size={14} /> Pública
                                </button>
                                <button
                                    onClick={() => setPrivacy('PRIVATE')}
                                    className={`flex items-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-bold transition-all ${
                                        privacy === 'PRIVATE'
                                            ? 'border-slate-500 bg-slate-50 text-slate-700 ring-2 ring-slate-200'
                                            : 'border-slate-200 text-slate-400 hover:border-slate-300'
                                    }`}
                                >
                                    <Lock size={14} /> Privada
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p className="text-sm text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                                {error}
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 mt-6">
                        <DialogPrimitive.Close className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                            Cancelar
                        </DialogPrimitive.Close>
                        <button
                            onClick={handleCreate}
                            disabled={isSaving || !name.trim()}
                            className="flex-1 py-3 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-500 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <><span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" /> Creando…</>
                            ) : (
                                <><Plus size={16} /> Crear Polla</>
                            )}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

/* ─── Main component ─── */
const AdminLeagues: React.FC = () => {
    const navigate = useNavigate();
    const { leagues, total, filters, isLoading, fetchLeagues, setFilters } = useAdminLeaguesStore();
    const [searchInput, setSearchInput] = React.useState('');
    const [createOpen, setCreateOpen] = React.useState(false);

    const debouncedSearch = useDebounce(searchInput, 400);

    React.useEffect(() => {
        setFilters({ search: debouncedSearch, page: 1 });
    }, [debouncedSearch, setFilters]);

    React.useEffect(() => {
        fetchLeagues();
    }, [filters, fetchLeagues]);

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-brand uppercase tracking-tight leading-tight">
                        Pollas
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <Trophy size={12} />
                        {total.toLocaleString('es-CO')} pollas en el sistema
                    </p>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-amber-400 px-3 sm:px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-500 transition-colors shadow-sm shrink-0"
                >
                    <Plus size={16} />
                    <span className="hidden sm:inline">Nueva Polla</span>
                    <span className="sm:hidden">Nueva</span>
                </button>
            </div>

            {/* ── Status chips ── */}
            <div className="flex gap-2 flex-wrap">
                {statusChips.map((chip) => (
                    <button
                        key={chip.value}
                        onClick={() => setFilters({ status: chip.value || undefined, page: 1 })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                            (filters.status ?? '') === chip.value ? chip.active : chip.inactive
                        }`}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {/* ── Search + plan filter ── */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Buscar por nombre…"
                            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                        />
                        {searchInput && (
                            <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <select
                            value={filters.plan ?? ''}
                            onChange={(e) => setFilters({ plan: e.target.value || undefined, page: 1 })}
                            className="appearance-none w-full pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">Todos los planes</option>
                            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* ── Loading skeleton ── */}
            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-20 bg-slate-200 rounded-2xl animate-pulse" />
                    ))}
                </div>
            )}

            {/* ── Empty state ── */}
            {!isLoading && leagues.length === 0 && (
                <div className="rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-sm">
                    <Trophy size={32} className="text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-500">No se encontraron pollas</p>
                    <p className="text-sm text-slate-400 mt-1">Prueba con otros filtros o crea la primera</p>
                    <button
                        onClick={() => setCreateOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-500"
                    >
                        <Plus size={16} /> Nueva Polla
                    </button>
                </div>
            )}

            {!isLoading && leagues.length > 0 && (
                <>
                    {/* ── Mobile cards (< md) ── */}
                    <div className="md:hidden space-y-3">
                        {leagues.map((league) => (
                            <button
                                key={league.id}
                                onClick={() => navigate(`/admin/leagues/${league.id}`)}
                                className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 hover:shadow-md transition-all"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-slate-900 truncate">{league.name}</p>
                                        <p className="text-xs text-slate-400 font-mono mt-0.5">{league.code}</p>
                                    </div>
                                    <Eye size={16} className="text-slate-300 shrink-0 mt-0.5" />
                                </div>
                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${planBadge[league.plan] ?? 'bg-slate-100 text-slate-600'}`}>
                                        {league.plan}
                                    </span>
                                    <StatusBadge status={league.status} size="sm" />
                                    <span className="text-xs text-slate-400">
                                        {league._count?.members ?? 0} miembros
                                    </span>
                                    {league.primaryTournamentId && (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                            <Trophy size={9} /> Torneo
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* ── Desktop table (≥ md) ── */}
                    <div className="hidden md:block rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="grid grid-cols-[2.5fr_1fr_1fr_80px_130px_40px] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/80">
                            {['Polla', 'Plan', 'Estado', 'Miembros', 'Torneo', ''].map((h) => (
                                <p key={h} className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{h}</p>
                            ))}
                        </div>
                        <div className="divide-y divide-slate-100">
                            {leagues.map((league) => (
                                <div
                                    key={league.id}
                                    onClick={() => navigate(`/admin/leagues/${league.id}`)}
                                    className="grid grid-cols-[2.5fr_1fr_1fr_80px_130px_40px] gap-4 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{league.name}</p>
                                        <p className="text-xs text-slate-400 font-mono truncate">{league.code}</p>
                                    </div>
                                    <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-black uppercase w-fit ${planBadge[league.plan] ?? 'bg-slate-100 text-slate-600'}`}>
                                        {league.plan}
                                    </span>
                                    <StatusBadge status={league.status} />
                                    <p className="text-sm font-bold text-slate-600 tabular-nums">{league._count?.members ?? 0}</p>
                                    <div>
                                        {league.primaryTournamentId ? (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg w-fit">
                                                <Trophy size={10} /> Vinculado
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-300">Sin torneo</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/leagues/${league.id}`); }}
                                        className="p-1.5 rounded-lg text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                                        aria-label="Ver detalle"
                                    >
                                        <Eye size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {!isLoading && total > filters.limit && (
                <AdminPagination
                    page={filters.page}
                    limit={filters.limit}
                    total={total}
                    onPageChange={(p) => setFilters({ page: p })}
                />
            )}

            <CreateLeagueDialog open={createOpen} onOpenChange={setCreateOpen} />
        </div>
    );
};

export default AdminLeagues;
