import React from 'react';
import { Plus, Edit3, Trash2, ChevronDown } from 'lucide-react';
import { useAdminMatchesStore } from '../../stores/admin.matches.store';
import StatusBadge from '../../components/admin/StatusBadge';
import AdminPagination from '../../components/admin/AdminPagination';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';

const PHASES = ['GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER', 'SEMI', 'THIRD_PLACE', 'FINAL'];
const STATUSES_MATCH = ['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED'];

const ScoreDialog: React.FC<{
    match: any;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}> = ({ match, open, onOpenChange }) => {
    const { updateScore, isSaving } = useAdminMatchesStore();
    const [home, setHome] = React.useState(match?.homeScore ?? 0);
    const [away, setAway] = React.useState(match?.awayScore ?? 0);

    React.useEffect(() => {
        if (match) { setHome(match.homeScore ?? 0); setAway(match.awayScore ?? 0); }
    }, [match]);

    const handleSave = async () => {
        await updateScore(match.id, Number(home), Number(away));
        onOpenChange(false);
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
                <DialogPrimitive.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white rounded-[1.75rem] shadow-2xl p-6">
                    <DialogPrimitive.Title className="font-black text-lg text-slate-900 mb-1">
                        Actualizar Resultado
                    </DialogPrimitive.Title>
                    <p className="text-sm text-slate-500 mb-5">
                        {match?.homeTeam?.name} vs {match?.awayTeam?.name}
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">
                                {match?.homeTeam?.name}
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={home}
                                onChange={(e) => setHome(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-2xl font-black text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                        <span className="text-2xl font-black text-slate-300 mt-4">–</span>
                        <div className="flex-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">
                                {match?.awayTeam?.name}
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={away}
                                onChange={(e) => setAway(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-2xl font-black text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={() => onOpenChange(false)}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 py-2.5 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-500 transition-all disabled:opacity-60"
                        >
                            {isSaving ? 'Guardando...' : 'Guardar resultado'}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

const CreateMatchDialog: React.FC<{
    open: boolean;
    onOpenChange: (v: boolean) => void;
}> = ({ open, onOpenChange }) => {
    const { teams, createMatch, isSaving } = useAdminMatchesStore();
    const [form, setForm] = React.useState({
        homeTeamId: '',
        awayTeamId: '',
        phase: 'GROUP',
        matchDate: '',
        venue: '',
        group: '',
    });

    const handleCreate = async () => {
        await createMatch(form as any);
        onOpenChange(false);
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
                <DialogPrimitive.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-[1.75rem] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <DialogPrimitive.Title className="font-black text-lg text-slate-900 mb-5">Crear Partido</DialogPrimitive.Title>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Equipo Local</label>
                                <select
                                    value={form.homeTeamId}
                                    onChange={(e) => setForm({ ...form, homeTeamId: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                    <option value="">Seleccionar...</option>
                                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Equipo Visitante</label>
                                <select
                                    value={form.awayTeamId}
                                    onChange={(e) => setForm({ ...form, awayTeamId: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                    <option value="">Seleccionar...</option>
                                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Fase</label>
                                <select
                                    value={form.phase}
                                    onChange={(e) => setForm({ ...form, phase: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                    {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Grupo</label>
                                <input
                                    value={form.group}
                                    onChange={(e) => setForm({ ...form, group: e.target.value })}
                                    placeholder="Ej: A"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Fecha y Hora</label>
                            <input
                                type="datetime-local"
                                value={form.matchDate}
                                onChange={(e) => setForm({ ...form, matchDate: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Estadio / Sede</label>
                            <input
                                value={form.venue}
                                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                                placeholder="Ej: Estadio Azteca"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => onOpenChange(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={isSaving || !form.homeTeamId || !form.awayTeamId || !form.matchDate}
                            className="flex-1 py-2.5 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-500 transition-all disabled:opacity-60"
                        >
                            {isSaving ? 'Creando...' : 'Crear Partido'}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

const AdminMatches: React.FC = () => {
    const { matches, total, filters, isLoading, isSaving, fetchMatches, fetchTeams, deleteMatch, setFilters } = useAdminMatchesStore();
    const [scoreMatch, setScoreMatch] = React.useState<any>(null);
    const [showCreate, setShowCreate] = React.useState(false);
    const [confirmDelete, setConfirmDelete] = React.useState<{ id: string; name: string } | null>(null);

    React.useEffect(() => {
        fetchMatches();
        fetchTeams();
    }, [filters, fetchMatches, fetchTeams]);

    const formatDate = (d: string) => new Date(d).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">Partidos</h1>
                    <p className="text-sm text-slate-500 mt-1">{total.toLocaleString()} partidos</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 text-slate-950 font-bold rounded-xl text-sm hover:bg-amber-500 transition-all"
                >
                    <Plus size={16} />
                    Nuevo Partido
                </button>
            </div>

            {/* Filters */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap gap-3">
                <div className="relative">
                    <select
                        value={filters.phase ?? ''}
                        onChange={(e) => setFilters({ phase: e.target.value || undefined, page: 1 })}
                        className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                        <option value="">Todas las fases</option>
                        {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) => setFilters({ status: e.target.value || undefined, page: 1 })}
                        className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                        <option value="">Todos los estados</option>
                        {STATUSES_MATCH.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Partido</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Resultado</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Acciones</p>
                </div>
                {isLoading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
                ) : matches.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No se encontraron partidos</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {matches.map((match) => (
                            <div key={match.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors">
                                <div>
                                    <p className="text-sm font-bold text-slate-800">
                                        {match.homeTeam.name} <span className="text-slate-400 font-normal">vs</span> {match.awayTeam.name}
                                    </p>
                                    <p className="text-xs text-slate-400">{formatDate(match.matchDate)} — {match.phase}</p>
                                </div>
                                <p className="text-sm font-black text-slate-700">
                                    {match.homeScore != null ? `${match.homeScore} – ${match.awayScore}` : '– – –'}
                                </p>
                                <StatusBadge status={match.status} />
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setScoreMatch(match)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-all"
                                        title="Editar resultado"
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete({
                                            id: match.id,
                                            name: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
                                        })}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
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

            <ScoreDialog match={scoreMatch} open={!!scoreMatch} onOpenChange={(v) => { if (!v) setScoreMatch(null); }} />
            <CreateMatchDialog open={showCreate} onOpenChange={setShowCreate} />
            <ConfirmDialog
                open={!!confirmDelete}
                onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}
                title="Eliminar partido"
                description={`¿Eliminar "${confirmDelete?.name}"? Se eliminarán también todos sus pronósticos.`}
                confirmLabel="Eliminar"
                isLoading={isSaving}
                onConfirm={async () => {
                    if (confirmDelete) {
                        await deleteMatch(confirmDelete.id);
                        setConfirmDelete(null);
                    }
                }}
            />
        </div>
    );
};

export default AdminMatches;
