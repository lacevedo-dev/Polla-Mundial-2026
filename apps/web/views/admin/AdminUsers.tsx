import React from 'react';
import {
    Search, Edit3, Ban, CheckCircle, Trash2,
    ChevronDown, X, Shield, Users, Sparkles, MoreVertical,
} from 'lucide-react';
import { useAdminUsersStore } from '../../stores/admin.users.store';
import StatusBadge from '../../components/admin/StatusBadge';
import AdminPagination from '../../components/admin/AdminPagination';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';

const PLANS = ['FREE', 'GOLD', 'DIAMOND'];
const SYSTEM_ROLES = ['USER', 'ADMIN', 'SUPERADMIN'];

/* ─── helpers ─── */
function useDebounce<T>(value: T, delay = 400): T {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

function avatarUrl(name: string, avatar?: string | null) {
    if (avatar) return avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e2e8f0&color=64748b&size=72`;
}

const planBadge: Record<string, string> = {
    FREE: 'bg-slate-100 text-slate-600',
    GOLD: 'bg-amber-100 text-amber-700',
    DIAMOND: 'bg-purple-100 text-purple-700',
};

const roleBadge: Record<string, string> = {
    USER: 'bg-slate-100 text-slate-600',
    ADMIN: 'bg-blue-100 text-blue-700',
    SUPERADMIN: 'bg-rose-100 text-rose-700',
};

type UserStatusAction = {
    type: 'status';
    userId: string;
    name: string;
    nextStatus: 'ACTIVE' | 'INACTIVE';
};

type HardDeleteAction = {
    type: 'hard-delete';
    userId: string;
    name: string;
};

type UserConfirmAction = UserStatusAction | HardDeleteAction;

function isInactiveUser(status?: string) {
    return status === 'INACTIVE' || status === 'BANNED';
}

function isStatusConfirmAction(action: UserConfirmAction | null): action is UserStatusAction {
    return action?.type === 'status';
}

function getStatusActionMeta(status?: string) {
    const inactive = isInactiveUser(status);
    return {
        label: inactive ? 'Reactivar' : 'Inactivar',
        icon: inactive ? CheckCircle : Ban,
        color: inactive ? 'text-lime-600 hover:bg-lime-50' : 'text-amber-600 hover:bg-amber-50',
        confirmLabel: inactive ? 'Reactivar' : 'Inactivar',
        nextStatus: inactive ? 'ACTIVE' : 'INACTIVE',
        description: inactive
            ? 'El usuario volverá a mostrarse como activo y podrá usar la plataforma normalmente.'
            : 'El usuario quedará inactivo, pero su información se conservará para auditoría y recuperación.',
    } as const;
}

/* ─── Edit User Dialog ─── */
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
                <DialogPrimitive.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100vw-2rem)] max-w-md bg-white rounded-[1.75rem] shadow-2xl p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <DialogPrimitive.Title className="font-black text-lg text-slate-900 leading-tight">
                                Editar Usuario
                            </DialogPrimitive.Title>
                            <p className="text-sm text-slate-500 mt-0.5 truncate">{user?.email}</p>
                        </div>
                        <DialogPrimitive.Close className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                            <X size={18} />
                        </DialogPrimitive.Close>
                    </div>

                    {/* Avatar + name */}
                    <div className="flex items-center gap-3 mb-5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <img
                            src={avatarUrl(user?.name ?? '', user?.avatar)}
                            alt={user?.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                        <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{user?.name}</p>
                            <p className="text-xs text-slate-500 truncate">@{user?.username}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Plan */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-2">
                                Plan de suscripción
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {PLANS.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPlan(p)}
                                        className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                                            plan === p
                                                ? p === 'DIAMOND' ? 'border-purple-400 bg-purple-50 text-purple-700 ring-2 ring-purple-300'
                                                : p === 'GOLD' ? 'border-amber-400 bg-amber-50 text-amber-700 ring-2 ring-amber-300'
                                                : 'border-slate-400 bg-slate-50 text-slate-700 ring-2 ring-slate-300'
                                                : 'border-slate-200 text-slate-400 hover:border-slate-300'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* System Role */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 block mb-2">
                                Rol de sistema
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {SYSTEM_ROLES.map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setSystemRole(r)}
                                        className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                                            systemRole === r
                                                ? r === 'SUPERADMIN' ? 'border-rose-400 bg-rose-50 text-rose-700 ring-2 ring-rose-300'
                                                : r === 'ADMIN' ? 'border-blue-400 bg-blue-50 text-blue-700 ring-2 ring-blue-300'
                                                : 'border-slate-400 bg-slate-50 text-slate-700 ring-2 ring-slate-300'
                                                : 'border-slate-200 text-slate-400 hover:border-slate-300'
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <DialogPrimitive.Close className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                            Cancelar
                        </DialogPrimitive.Close>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 py-3 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-500 transition-all disabled:opacity-60"
                        >
                            {isSaving ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

/* ─── User Action Menu (custom dropdown) ─── */
const UserActionMenu: React.FC<{
    user: any;
    onEdit: () => void;
    onToggleStatus: () => void;
    onHardDelete: () => void;
    onResetCredits: () => void;
}> = ({ user, onEdit, onToggleStatus, onHardDelete, onResetCredits }) => {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    const statusMeta = getStatusActionMeta(user?.status);

    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const actions = [
        { label: 'Editar', icon: Edit3, onClick: onEdit, color: 'text-amber-600 hover:bg-amber-50' },
        { label: 'Resetear créditos IA', icon: Sparkles, onClick: onResetCredits, color: 'text-sky-600 hover:bg-sky-50' },
        { label: statusMeta.label, icon: statusMeta.icon, onClick: onToggleStatus, color: statusMeta.color },
        { label: 'Eliminar definitivamente', icon: Trash2, onClick: onHardDelete, color: 'text-rose-700 hover:bg-rose-50' },
    ];

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Acciones de usuario"
                aria-expanded={open}
                aria-haspopup="menu"
            >
                <MoreVertical size={16} />
            </button>
            {open && (
                <div
                    className="absolute right-0 top-full mt-1 z-50 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5"
                    role="menu"
                >
                    {actions.map((a) => (
                        <button
                            key={a.label}
                            role="menuitem"
                            onClick={() => { a.onClick(); setOpen(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${a.color}`}
                        >
                            <a.icon size={15} className="shrink-0" />
                            {a.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ─── Main component ─── */
const AdminUsers: React.FC = () => {
    const {
        users, total, filters, isLoading, isSaving,
        fetchUsers, setUserStatus, permanentlyDeleteUser, resetUserCredits, setFilters,
    } = useAdminUsersStore();

    const [editUser, setEditUser] = React.useState<any>(null);
    const [confirmAction, setConfirmAction] = React.useState<UserConfirmAction | null>(null);
    const [resetCreditsUserId, setResetCreditsUserId] = React.useState<string | null>(null);
    const [searchInput, setSearchInput] = React.useState('');

    const debouncedSearch = useDebounce(searchInput, 450);

    React.useEffect(() => {
        setFilters({ search: debouncedSearch || undefined, page: 1 });
    }, [debouncedSearch, setFilters]);

    React.useEffect(() => {
        fetchUsers();
    }, [filters, fetchUsers]);

    const handleConfirm = async () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'status') {
            await setUserStatus(confirmAction.userId, confirmAction.nextStatus);
        } else if (confirmAction.type === 'hard-delete') {
            await permanentlyDeleteUser(confirmAction.userId);
        }
        setConfirmAction(null);
    };

    const handleResetCredits = async () => {
        if (!resetCreditsUserId) return;
        await resetUserCredits(resetCreditsUserId);
        setResetCreditsUserId(null);
    };

    const isHardDeleteAction = confirmAction?.type === 'hard-delete';
    const isInactivateAction = isStatusConfirmAction(confirmAction)
        ? confirmAction.nextStatus === 'INACTIVE'
        : false;

    return (
        <div className="space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-brand uppercase tracking-tight leading-tight">
                        Usuarios
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <Users size={12} />
                        {total.toLocaleString('es-CO')} usuarios registrados
                    </p>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                {/* Search */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Buscar por nombre, email o usuario…"
                        className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                    />
                    {searchInput && (
                        <button
                            onClick={() => setSearchInput('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            aria-label="Limpiar búsqueda"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Select filters */}
                <div className="flex flex-wrap gap-2">
                    {/* Plan filter */}
                    <div className="relative flex-1 min-w-[140px]">
                        <select
                            value={filters.plan ?? ''}
                            onChange={(e) => setFilters({ plan: e.target.value || undefined, page: 1 })}
                            className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">Todos los planes</option>
                            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Role filter */}
                    <div className="relative flex-1 min-w-[140px]">
                        <select
                            value={filters.systemRole ?? ''}
                            onChange={(e) => setFilters({ systemRole: e.target.value || undefined, page: 1 })}
                            className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                            <option value="">Todos los roles</option>
                            {SYSTEM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Reset filters */}
                    {(filters.plan || filters.systemRole || filters.search) && (
                        <button
                            onClick={() => { setSearchInput(''); setFilters({ plan: undefined, systemRole: undefined, search: undefined, page: 1 }); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                            <X size={13} /> Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* ── Loading / Empty ── */}
            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-20 bg-slate-200 rounded-2xl animate-pulse" />
                    ))}
                </div>
            )}

            {!isLoading && users.length === 0 && (
                <div className="rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-sm">
                    <Users size={32} className="text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-500">No se encontraron usuarios</p>
                    <p className="text-sm text-slate-400 mt-1">Prueba con otros filtros de búsqueda</p>
                </div>
            )}

            {!isLoading && users.length > 0 && (
                <>
                    {/* ── Mobile cards (< md) ── */}
                    <div className="md:hidden space-y-3">
                        {users.map((user) => (
                            <div key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <img
                                        src={avatarUrl(user.name, user.avatar)}
                                        alt={user.name}
                                        className="w-11 h-11 rounded-full object-cover border-2 border-slate-100 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-900 truncate text-sm">{user.name}</p>
                                                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                            </div>
                                            <UserActionMenu
                                                user={user}
                                                onEdit={() => setEditUser(user)}
                                                onToggleStatus={() => setConfirmAction({
                                                    type: 'status',
                                                    userId: user.id,
                                                    name: user.name,
                                                    nextStatus: isInactiveUser(user.status) ? 'ACTIVE' : 'INACTIVE',
                                                })}
                                                onHardDelete={() => setConfirmAction({ type: 'hard-delete', userId: user.id, name: user.name })}
                                                onResetCredits={() => setResetCreditsUserId(user.id)}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide ${planBadge[user.plan] ?? 'bg-slate-100 text-slate-600'}`}>
                                                {user.plan}
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide ${roleBadge[user.systemRole] ?? 'bg-slate-100 text-slate-600'}`}>
                                                {user.systemRole === 'SUPERADMIN' && <Shield size={9} />}
                                                {user.systemRole}
                                            </span>
                                            <StatusBadge status={user.status ?? 'ACTIVE'} size="sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Desktop table (≥ md) ── */}
                    <div className="hidden md:block rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/80">
                            {['Usuario', 'Plan', 'Rol', 'Estado', 'Acciones'].map((h) => (
                                <p key={h} className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{h}</p>
                            ))}
                        </div>

                        <div className="divide-y divide-slate-100">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    className="grid grid-cols-[2.5fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 items-center hover:bg-slate-50/80 transition-colors"
                                >
                                    {/* User info */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <img
                                            src={avatarUrl(user.name, user.avatar)}
                                            alt={user.name}
                                            className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                                            <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                        </div>
                                    </div>

                                    {/* Plan */}
                                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide w-fit ${planBadge[user.plan] ?? 'bg-slate-100 text-slate-600'}`}>
                                        {user.plan}
                                    </span>

                                    {/* Role */}
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide w-fit ${roleBadge[user.systemRole] ?? 'bg-slate-100 text-slate-600'}`}>
                                        {user.systemRole === 'SUPERADMIN' && <Shield size={10} />}
                                        {user.systemRole}
                                    </span>

                                    {/* Status */}
                                    <StatusBadge status={user.status ?? 'ACTIVE'} />

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => setEditUser(user)}
                                            className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                                            title="Editar usuario"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        <button
                                            onClick={() => setResetCreditsUserId(user.id)}
                                            className="p-1.5 rounded-lg hover:bg-sky-50 text-slate-400 hover:text-sky-600 transition-colors"
                                            title="Resetear créditos IA"
                                        >
                                            <Sparkles size={14} />
                                        </button>
                                        <button
                                            onClick={() => setConfirmAction({
                                                type: 'status',
                                                userId: user.id,
                                                name: user.name,
                                                nextStatus: isInactiveUser(user.status) ? 'ACTIVE' : 'INACTIVE',
                                            })}
                                            className={`p-1.5 rounded-lg transition-colors ${
                                                isInactiveUser(user.status)
                                                    ? 'hover:bg-lime-50 text-slate-400 hover:text-lime-600'
                                                    : 'hover:bg-amber-50 text-slate-400 hover:text-amber-600'
                                            }`}
                                            title={isInactiveUser(user.status) ? 'Reactivar usuario' : 'Inactivar usuario'}
                                        >
                                            {isInactiveUser(user.status) ? <CheckCircle size={14} /> : <Ban size={14} />}
                                        </button>
                                        <button
                                            onClick={() => setConfirmAction({ type: 'hard-delete', userId: user.id, name: user.name })}
                                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-700 transition-colors"
                                            title="Eliminar definitivamente"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Pagination */}
            {!isLoading && total > filters.limit && (
                <AdminPagination
                    page={filters.page}
                    limit={filters.limit}
                    total={total}
                    onPageChange={(p) => setFilters({ page: p })}
                />
            )}

            {/* ── Dialogs ── */}
            <EditUserDialog
                user={editUser}
                open={!!editUser}
                onOpenChange={(v) => { if (!v) setEditUser(null); }}
            />

            <ConfirmDialog
                open={!!confirmAction}
                onOpenChange={(v) => { if (!v) setConfirmAction(null); }}
                title={
                    isHardDeleteAction
                        ? 'Eliminar definitivamente'
                        : isInactivateAction
                            ? 'Inactivar usuario'
                            : 'Reactivar usuario'
                }
                description={
                    isHardDeleteAction
                        ? `¿Eliminar definitivamente a "${confirmAction?.name}"? Esta acción borrará también toda la información hija asociada y no se puede deshacer.`
                        : isInactivateAction
                            ? `¿Inactivar a "${confirmAction?.name}"? Su información se conservará, pero dejará de figurar como activo.`
                            : `¿Reactivar la cuenta de "${confirmAction?.name}"? Volverá a figurar como activa.`
                }
                confirmLabel={
                    isHardDeleteAction
                        ? 'Eliminar definitivamente'
                        : isInactivateAction
                            ? 'Inactivar'
                            : 'Reactivar'
                }
                variant={isHardDeleteAction ? 'danger' : 'warning'}
                isLoading={isSaving}
                onConfirm={handleConfirm}
            />

            <ConfirmDialog
                open={!!resetCreditsUserId}
                onOpenChange={(v) => { if (!v) setResetCreditsUserId(null); }}
                title="Resetear créditos IA"
                description="Los créditos de Smart Insights se restaurarán al máximo permitido por el plan del usuario."
                confirmLabel="Resetear créditos"
                variant="warning"
                isLoading={isSaving}
                onConfirm={handleResetCredits}
            />
        </div>
    );
};

export default AdminUsers;
