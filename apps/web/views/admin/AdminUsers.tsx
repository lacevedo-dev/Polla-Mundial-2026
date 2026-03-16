import React from 'react';
import { Search, Edit3, Ban, CheckCircle, Trash2, ChevronDown } from 'lucide-react';
import { useAdminUsersStore } from '../../stores/admin.users.store';
import StatusBadge from '../../components/admin/StatusBadge';
import AdminPagination from '../../components/admin/AdminPagination';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';

const PLANS = ['FREE', 'GOLD', 'DIAMOND'];
const SYSTEM_ROLES = ['USER', 'ADMIN', 'SUPERADMIN'];

const EditUserDialog: React.FC<{
    user: any;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}> = ({ user, open, onOpenChange }) => {
    const { updateUser, isSaving } = useAdminUsersStore();
    const [plan, setPlan] = React.useState(user?.plan ?? 'FREE');
    const [systemRole, setSystemRole] = React.useState(user?.systemRole ?? 'USER');

    React.useEffect(() => {
        if (user) { setPlan(user.plan); setSystemRole(user.systemRole); }
    }, [user]);

    const handleSave = async () => {
        await updateUser(user.id, { plan, systemRole });
        onOpenChange(false);
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
                <DialogPrimitive.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-[1.75rem] shadow-2xl p-6">
                    <DialogPrimitive.Title className="font-black text-lg text-slate-900 mb-1">
                        Editar Usuario
                    </DialogPrimitive.Title>
                    <p className="text-sm text-slate-500 mb-5">{user?.name} — {user?.email}</p>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Plan</label>
                            <select
                                value={plan}
                                onChange={(e) => setPlan(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-1.5">Rol de Sistema</label>
                            <select
                                value={systemRole}
                                onChange={(e) => setSystemRole(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                                {SYSTEM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
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
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

const AdminUsers: React.FC = () => {
    const { users, total, filters, isLoading, isSaving, fetchUsers, banUser, activateUser, deleteUser, setFilters } = useAdminUsersStore();

    const [editUser, setEditUser] = React.useState<any>(null);
    const [confirmAction, setConfirmAction] = React.useState<{ type: string; userId: string; name: string } | null>(null);
    const [searchInput, setSearchInput] = React.useState('');

    React.useEffect(() => {
        fetchUsers();
    }, [filters, fetchUsers]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setFilters({ search: searchInput, page: 1 });
    };

    const handleConfirm = async () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'ban') await banUser(confirmAction.userId);
        else if (confirmAction.type === 'activate') await activateUser(confirmAction.userId);
        else if (confirmAction.type === 'delete') await deleteUser(confirmAction.userId);
        setConfirmAction(null);
    };

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">Usuarios</h1>
                <p className="text-sm text-slate-500 mt-1">{total.toLocaleString()} usuarios registrados</p>
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
                                placeholder="Buscar por nombre, email o usuario..."
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
                                value={filters.plan ?? ''}
                                onChange={(e) => setFilters({ plan: e.target.value || undefined, page: 1 })}
                                className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                                <option value="">Todos los planes</option>
                                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <div className="relative">
                            <select
                                value={filters.systemRole ?? ''}
                                onChange={(e) => setFilters({ systemRole: e.target.value || undefined, page: 1 })}
                                className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                                <option value="">Todos los roles</option>
                                {SYSTEM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Usuario</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Plan</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Rol</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Acciones</p>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No se encontraron usuarios</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {users.map((user) => (
                            <div key={user.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <img
                                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=e2e8f0&color=64748b`}
                                        alt={user.name}
                                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                    </div>
                                </div>
                                <StatusBadge status={user.plan} />
                                <StatusBadge status={user.systemRole} />
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setEditUser(user)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-all"
                                        title="Editar"
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                    <button
                                        onClick={() => setConfirmAction({ type: 'ban', userId: user.id, name: user.name })}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
                                        title="Banear"
                                    >
                                        <Ban size={14} />
                                    </button>
                                    <button
                                        onClick={() => setConfirmAction({ type: 'activate', userId: user.id, name: user.name })}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-lime-50 text-slate-400 hover:text-lime-600 transition-all"
                                        title="Activar"
                                    >
                                        <CheckCircle size={14} />
                                    </button>
                                    <button
                                        onClick={() => setConfirmAction({ type: 'delete', userId: user.id, name: user.name })}
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

            {/* Edit dialog */}
            <EditUserDialog
                user={editUser}
                open={!!editUser}
                onOpenChange={(v) => { if (!v) setEditUser(null); }}
            />

            {/* Confirm dialog */}
            <ConfirmDialog
                open={!!confirmAction}
                onOpenChange={(v) => { if (!v) setConfirmAction(null); }}
                title={
                    confirmAction?.type === 'delete' ? 'Eliminar usuario' :
                    confirmAction?.type === 'ban' ? 'Banear usuario' : 'Activar usuario'
                }
                description={
                    confirmAction?.type === 'delete'
                        ? `¿Estás seguro de eliminar a "${confirmAction?.name}"? Esta acción no se puede deshacer.`
                        : confirmAction?.type === 'ban'
                        ? `¿Banear a "${confirmAction?.name}" de todas las ligas?`
                        : `¿Reactivar a "${confirmAction?.name}"?`
                }
                confirmLabel={confirmAction?.type === 'delete' ? 'Eliminar' : confirmAction?.type === 'ban' ? 'Banear' : 'Activar'}
                variant={confirmAction?.type === 'activate' ? 'warning' : 'danger'}
                isLoading={isSaving}
                onConfirm={handleConfirm}
            />
        </div>
    );
};

export default AdminUsers;
