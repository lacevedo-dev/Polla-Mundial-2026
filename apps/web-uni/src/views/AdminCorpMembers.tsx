import React, { useEffect, useState } from 'react';
import {
    Users, Search, Crown, Shield, User, Mail, Copy, Check,
    Plus, Pencil, Trash2, X, Loader2, AlertTriangle, Upload,
    Send, KeyRound, EyeOff, Eye, RefreshCw, Hash,
} from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request, ApiError } from '../api';
import { useTenantStore } from '../stores/tenant.store';
import { useAuthStore } from '../stores/auth.store';

interface Member {
    id: string;
    userId: string;
    name: string;
    email: string;
    username: string;
    avatar: string | null;
    role: 'OWNER' | 'ADMIN' | 'STAFF' | 'PLAYER';
    status: 'ACTIVE' | 'INACTIVE';
    mustChangePassword: boolean;
    emailVerified: boolean;
    joinedAt: string;
    createdAt: string;
}

type ModalType = 'create' | 'edit' | 'delete' | 'bulk' | null;

const ROLE_DESCS: Record<Member['role'], string> = {
    OWNER: 'Control total: configura el sistema, branding y puede asignar cualquier rol.',
    ADMIN: 'Gestiona pollas y miembros. No puede cambiar la configuración del sistema.',
    STAFF: 'Operativo: crea y modifica miembros, importa usuarios y reenvía credenciales.',
    PLAYER: 'Participa en pollas y hace pronósticos. Sin acceso a funciones administrativas.',
};

const ROLE_CONFIG = {
    OWNER: { label: 'Propietario', icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50' },
    ADMIN: { label: 'Admin', icon: Shield, color: 'text-violet-600', bg: 'bg-violet-50' },
    STAFF: { label: 'Usuario', icon: Users, color: 'text-sky-600', bg: 'bg-sky-50' },
    PLAYER: { label: 'Jugador', icon: User, color: 'text-slate-500', bg: 'bg-slate-100' },
};

function CopyBtn({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button onClick={() => { navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} className="ml-1 text-slate-300 hover:text-slate-500 transition-colors">
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
        </button>
    );
}

function Avatar({ member }: { member: Member }) {
    return (
        <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center">
            {member.avatar
                ? <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                : <span className="text-sm font-black text-slate-400">{member.name.charAt(0).toUpperCase()}</span>}
        </div>
    );
}

export default function AdminCorpMembers() {
    const authUser = useAuthStore((s) => s.user);
    const tenant = useTenantStore((s) => s.tenant);
    const callerIsStaff = authUser?.tenantRole === 'STAFF';
    const callerIsAdmin = authUser?.tenantRole === 'ADMIN' || authUser?.tenantRole === 'OWNER';
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [success, setSuccess] = useState<string | null>(null);
    const [globalError, setGlobalError] = useState<string | null>(null);

    const [modal, setModal] = useState<ModalType>(null);
    const [target, setTarget] = useState<Member | null>(null);
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    const [form, setForm] = useState({ documentNumber: '', name: '', email: '', role: 'PLAYER' as Member['role'], tempPassword: '', sendEmail: true });
    const [showPass, setShowPass] = useState(false);

    const [bulkText, setBulkText] = useState('');
    const [bulkSharedPass, setBulkSharedPass] = useState('');
    const [bulkSendEmail, setBulkSendEmail] = useState(true);
    const [bulkResults, setBulkResults] = useState<any[] | null>(null);

    const [resending, setResending] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'la organización';

    function loadMembers() {
        setLoading(true);
        request<Member[]>('/corp/members')
            .then(setMembers)
            .catch(() => setMembers([]))
            .finally(() => setLoading(false));
    }

    useEffect(() => { loadMembers(); }, []);

    function showSuccess(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); }

    function openCreate() {
        setForm({ documentNumber: '', name: '', email: '', role: 'PLAYER', tempPassword: '', sendEmail: true });
        setModalError(null); setModal('create');
    }
    function openEdit(m: Member) {
        setTarget(m); setForm({ documentNumber: m.username ?? '', name: m.name, email: m.email, role: m.role, tempPassword: '', sendEmail: false });
        setModalError(null); setModal('edit');
    }
    function openDelete(m: Member) { setTarget(m); setModalError(null); setModal('delete'); }
    function closeModal() { setModal(null); setTarget(null); setModalError(null); setBulkResults(null); }

    async function handleCreate() {
        if (!form.documentNumber.trim() || !form.name.trim() || !form.email.trim()) { setModalError('Documento, nombre y email son obligatorios.'); return; }
        setSaving(true); setModalError(null);
        try {
            await request('/corp/members', {
                method: 'POST',
                body: JSON.stringify({ documentNumber: form.documentNumber.trim(), name: form.name.trim(), email: form.email.trim(), role: form.role, tempPassword: form.tempPassword || undefined, sendEmail: form.sendEmail }),
            });
            loadMembers();
            closeModal();
            showSuccess(form.sendEmail ? `Usuario creado y credenciales enviadas a ${form.email.trim()}.` : 'Usuario creado exitosamente.');
        } catch (e) { setModalError(e instanceof ApiError ? e.message : 'Error al crear usuario.'); }
        finally { setSaving(false); }
    }

    async function handleEdit() {
        if (!target) return;
        if (!form.name.trim() || !form.email.trim() || !form.documentNumber.trim()) {
            setModalError('Nombre, correo y documento son obligatorios.'); return;
        }
        setSaving(true); setModalError(null);
        try {
            const payload: any = { role: form.role };
            if (form.name.trim() !== target.name) payload.name = form.name.trim();
            if (form.email.trim().toLowerCase() !== target.email.toLowerCase()) payload.email = form.email.trim();
            if (form.documentNumber.trim() !== target.username) payload.documentNumber = form.documentNumber.trim();
            await request(`/corp/members/${target.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
            setMembers(prev => prev.map(m => m.id === target.id ? {
                ...m,
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                username: form.documentNumber.trim(),
                role: form.role,
            } : m));
            closeModal(); showSuccess('Usuario actualizado correctamente.');
        } catch (e) { setModalError(e instanceof ApiError ? e.message : 'Error al actualizar.'); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        if (!target) return;
        setSaving(true); setModalError(null);
        try {
            await request(`/corp/members/${target.id}`, { method: 'DELETE' });
            setMembers(prev => prev.filter(m => m.id !== target.id));
            closeModal(); showSuccess('Miembro eliminado del equipo.');
        } catch (e) { setModalError(e instanceof ApiError ? e.message : 'Error al eliminar.'); }
        finally { setSaving(false); }
    }

    async function handleSyncLeagues() {
        setSyncing(true);
        try {
            const res = await request<{ synced: number; members: number; leagues: number }>('/corp/members/sync-leagues', { method: 'POST' });
            showSuccess(`Sincronización completa: ${res.members} miembro${res.members !== 1 ? 's' : ''} enrolados en ${res.leagues} polla${res.leagues !== 1 ? 's' : ''}.`);
        } catch (e) { setGlobalError(e instanceof ApiError ? e.message : 'Error al sincronizar.'); setTimeout(() => setGlobalError(null), 4000); }
        finally { setSyncing(false); }
    }

    async function handleResend(member: Member) {
        setResending(member.id);
        try {
            await request(`/corp/members/${member.id}/resend-credentials`, { method: 'POST' });
            showSuccess(`Credenciales reenviadas a ${member.email}.`);
        } catch (e) { setGlobalError(e instanceof ApiError ? e.message : 'No se pudo reenviar.'); setTimeout(() => setGlobalError(null), 4000); }
        finally { setResending(null); }
    }

    async function handleBulk() {
        setModalError(null);
        setBulkResults(null);
    
        const rawText = bulkText.trim();
    
        if (!rawText) {
            setModalError('Ingresa al menos un usuario.');
            return;
        }
    
        const VALID_ROLES = ['OWNER', 'ADMIN', 'STAFF', 'PLAYER'];
    
        const ROLE_ALIASES: Record<string, string> = {
            OWNER: 'OWNER',
            ADMIN: 'ADMIN',
            ADMINISTRADOR: 'ADMIN',
            STAFF: 'STAFF',
            USUARIO: 'PLAYER',
            PLAYER: 'PLAYER',
            JUGADOR: 'PLAYER',
            PARTICIPANTE: 'PLAYER',
        };
    
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
        const normalizeValue = (value?: string) => {
            return (value || '')
                .replace(/\u00A0/g, ' ')
                .replace(/\uFEFF/g, '')
                .trim();
        };
    
        const detectSeparator = (line: string) => {
            if (line.includes('\t')) return '\t';
            if (line.includes(';')) return ';';
            return ',';
        };
    
        const lines = rawText
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);
    
        const users: any[] = [];
        const errors: string[] = [];
        const seenDocuments = new Set<string>();
    
        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const sep = detectSeparator(line);
            const parts = line.split(sep).map(normalizeValue);
    
            const firstCol = parts[0]?.toLowerCase();
            const secondCol = parts[1]?.toLowerCase();
            const thirdCol = parts[2]?.toLowerCase();
    
            if (
                lineNumber === 1 &&
                (
                    firstCol?.includes('documento') ||
                    firstCol?.includes('cedula') ||
                    firstCol?.includes('cédula') ||
                    secondCol?.includes('nombre') ||
                    thirdCol?.includes('email') ||
                    thirdCol?.includes('correo')
                )
            ) {
                return;
            }
    
            if (parts.length < 3) {
                errors.push(`Línea ${lineNumber}: formato inválido. Usa Documento, Nombre, Email[, Rol[, Contraseña]].`);
                return;
            }
    
            const [documentNumberRaw, nameRaw, emailRaw, col4Raw, col5Raw] = parts;
    
            const documentNumber = normalizeValue(documentNumberRaw);
            const name = normalizeValue(nameRaw);
            const email = normalizeValue(emailRaw).toLowerCase();
            const col4 = normalizeValue(col4Raw);
            const col5 = normalizeValue(col5Raw);
    
            if (!documentNumber) {
                errors.push(`Línea ${lineNumber}: el documento es obligatorio.`);
                return;
            }
    
            if (!name) {
                errors.push(`Línea ${lineNumber}: el nombre es obligatorio.`);
                return;
            }
    
            if (!email || !emailRegex.test(email)) {
                errors.push(`Línea ${lineNumber}: correo inválido "${emailRaw}".`);
                return;
            }
    
            if (seenDocuments.has(documentNumber)) {
                errors.push(`Línea ${lineNumber}: documento duplicado en el archivo "${documentNumber}".`);
                return;
            }
    
            seenDocuments.add(documentNumber);
    
            let role = 'PLAYER';
            let tempPassword: string | undefined = undefined;
    
            const col4Upper = col4.toUpperCase();
            const col5Upper = col5.toUpperCase();
    
            if (col4 && ROLE_ALIASES[col4Upper]) {
                role = ROLE_ALIASES[col4Upper];
                tempPassword = col5 || undefined;
            } else if (col4 && col5 && ROLE_ALIASES[col5Upper]) {
                tempPassword = col4;
                role = ROLE_ALIASES[col5Upper];
            } else if (col4) {
                tempPassword = col4;
            }
    
            if (!VALID_ROLES.includes(role)) {
                errors.push(`Línea ${lineNumber}: rol inválido "${role}".`);
                return;
            }
    
            users.push({
                documentNumber,
                name,
                email,
                role,
                tempPassword,
            });
        });
    
        if (errors.length > 0) {
            setModalError(
                errors.slice(0, 20).join('\n') +
                (errors.length > 20 ? `\n\nY ${errors.length - 20} errores adicionales.` : '')
            );
            return;
        }
    
        if (!users.length) {
            setModalError('No se encontraron usuarios válidos para importar.');
            return;
        }
    
        setSaving(true);
        setBulkProgress({ done: 0, total: users.length });
    
        /**
         * Recomendación:
         * 100 o 200 es más estable para importaciones grandes.
         * Si además envías correo, usa 50 o 100.
         */
        const CHUNK_SIZE = bulkSendEmail ? 50 : 200;
    
        const visibleResults: any[] = [];
        const failedChunks: string[] = [];
    
        let totalSuccessful = 0;
        let totalFailed = 0;
        let totalProcessed = 0;
    
        try {
            for (let i = 0; i < users.length; i += CHUNK_SIZE) {
                const chunk = users.slice(i, i + CHUNK_SIZE);
                const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
                const from = i + 1;
                const to = Math.min(i + CHUNK_SIZE, users.length);
    
                try {
                    const payload = {
                        users: chunk,
                        sharedTempPassword: bulkSharedPass?.trim() || undefined,
                        sendEmail: bulkSendEmail,
                    };
    
                    const res = await request<any>('/corp/members/bulk', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                    });
    
                    const results = Array.isArray(res?.results) ? res.results : [];
    
                    totalSuccessful += Number(res?.successful || 0);
    
                    const failedResults = results.filter((r: any) => !r.ok);
                    totalFailed += failedResults.length;
    
                    /**
                     * No guardar miles de registros en memoria/render.
                     * Solo mostramos errores y una muestra de éxitos.
                     */
                    visibleResults.push(
                        ...failedResults.map((r: any) => ({
                            ...r,
                            chunk: chunkNumber,
                        }))
                    );
    
                    const successSample = results
                        .filter((r: any) => r.ok)
                        .slice(0, 3)
                        .map((r: any) => ({
                            ...r,
                            chunk: chunkNumber,
                        }));
    
                    if (visibleResults.length < 100) {
                        visibleResults.push(...successSample);
                    }
    
                } catch (chunkError) {
                    console.error(`Error en lote ${chunkNumber}, registros ${from}-${to}:`, chunkError);
    
                    totalFailed += chunk.length;
    
                    const msg = chunkError instanceof ApiError
                        ? chunkError.message
                        : 'Error desconocido en el lote.';
    
                    failedChunks.push(`Lote ${chunkNumber} registros ${from}-${to}: ${msg}`);
    
                    visibleResults.push({
                        ok: false,
                        email: `Registros ${from}-${to}`,
                        error: msg,
                        chunk: chunkNumber,
                    });
    
                    /**
                     * Si quieres que continúe con los siguientes lotes, deja este bloque así.
                     * Si prefieres detener todo al primer error, descomenta:
                     *
                     * throw chunkError;
                     */
                }
    
                totalProcessed += chunk.length;
    
                setBulkProgress({
                    done: Math.min(totalProcessed, users.length),
                    total: users.length,
                });
    
                /**
                 * Pequeña pausa para no saturar backend/correos.
                 */
                await new Promise(resolve => setTimeout(resolve, 250));
            }
    
            setBulkResults(visibleResults.slice(0, 150));
    
            await loadMembers();
    
            if (failedChunks.length > 0 || totalFailed > 0) {
                setModalError(
                    `Importación finalizada con novedades.\n` +
                    `Procesados: ${users.length}\n` +
                    `Exitosos: ${totalSuccessful}\n` +
                    `Fallidos aproximados: ${totalFailed}\n\n` +
                    failedChunks.slice(0, 10).join('\n') +
                    (failedChunks.length > 10 ? `\n\nY ${failedChunks.length - 10} lotes adicionales con error.` : '')
                );
            } else {
                showSuccess(`${totalSuccessful} de ${users.length} usuarios importados correctamente.`);
            }
    
        } catch (e) {
            console.error('Error general importación masiva:', e);
    
            setModalError(
                e instanceof ApiError
                    ? e.message
                    : 'Error general en la importación masiva.'
            );
        } finally {
            setSaving(false);
            setBulkProgress(null);
        }
    }

    const filtered = members
        .filter(m => m.status === 'ACTIVE')
        .filter(m => !roleFilter || m.role === roleFilter)
        .filter(m =>
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase()) ||
            m.username?.toLowerCase().includes(search.toLowerCase()),
        );

    return (
        <CorpLayout>
            {/* Header */}
            <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Users size={20} className="text-sky-600" />
                        <h1 className="text-2xl font-black text-slate-900">Gestión de usuarios</h1>
                    </div>
                    <p className="text-slate-500 text-sm">{loading ? 'Cargando...' : `${members.filter(m => m.status === 'ACTIVE').length} miembro${members.length !== 1 ? 's' : ''} en ${orgName}`}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSyncLeagues} disabled={syncing}
                        title="Enrola a todos los miembros activos en todas las pollas del tenant"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                        {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Sincronizar pollas
                    </button>
                    <button onClick={() => { setBulkText(''); setBulkSharedPass(''); setBulkSendEmail(true); setBulkResults(null); setModalError(null); setModal('bulk'); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                        <Upload size={14} /> Importar
                    </button>
                    <button onClick={openCreate}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-black hover:brightness-90 transition-all"
                        style={{ backgroundColor: 'var(--color-primary,#f59e0b)' }}>
                        <Plus size={15} /> Nuevo usuario
                    </button>
                </div>
            </div>

            {success && <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium"><Check size={15} />{success}</div>}
            {globalError && <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium"><AlertTriangle size={15} />{globalError}</div>}

            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, email, usuario..."
                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                        style={{ '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any} />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none text-slate-600">
                    <option value="">Todos los roles</option>
                    <option value="OWNER">Propietario</option>
                    <option value="ADMIN">Admin</option>
                    <option value="STAFF">Usuario</option>
                    <option value="PLAYER">Jugador</option>
                </select>
                <button onClick={loadMembers} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-400 hover:text-slate-600">
                    <RefreshCw size={15} />
                </button>
            </div>

            {/* Role badges */}
            {!loading && members.length > 0 && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {(Object.keys(ROLE_CONFIG) as Array<keyof typeof ROLE_CONFIG>).map((role) => {
                        const count = members.filter(m => m.role === role && m.status === 'ACTIVE').length;
                        if (!count) return null;
                        const cfg = ROLE_CONFIG[role];
                        return (
                            <button key={role} onClick={() => setRoleFilter(roleFilter === role ? '' : role)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${roleFilter === role ? 'ring-2 ring-offset-1' : ''} ${cfg.bg} ${cfg.color}`}
                                style={roleFilter === role ? { '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any : {}}>
                                <cfg.icon size={10} />{count} {cfg.label}{count !== 1 ? 's' : ''}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-black text-slate-800 text-sm">Miembros activos</h2>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">{filtered.length}</span>
                </div>
                {loading ? (
                    <div className="p-12 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
                ) : !filtered.length ? (
                    <div className="p-10 text-center">
                        <Users size={32} className="mx-auto mb-2 text-slate-200" />
                        <p className="text-slate-400 text-sm">{search || roleFilter ? 'Sin resultados para esa búsqueda.' : 'Aún no hay miembros. ¡Crea el primero!'}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map(member => {
                            const roleCfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.PLAYER;
                            const RoleIcon = roleCfg.icon;
                            return (
                                <div key={member.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors">
                                    <Avatar member={member} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-slate-800 text-sm truncate">{member.name}</p>
                                            <span className={`flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-full ${roleCfg.bg} ${roleCfg.color}`}>
                                                <RoleIcon size={9} />{roleCfg.label}
                                            </span>
                                            {member.mustChangePassword && (
                                                <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                                                    <KeyRound size={9} /> Cambio pendiente
                                                </span>
                                            )}
                                        </div>
                                        {member.username && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Hash size={9} className="text-slate-300 shrink-0" />
                                                <span className="text-[11px] text-slate-400 font-mono">{member.username}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <Mail size={10} className="text-slate-300 shrink-0" />
                                            <span className="text-xs text-slate-400 truncate">{member.email}</span>
                                            <CopyBtn value={member.email} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => handleResend(member)} disabled={resending === member.id} title="Reenviar credenciales"
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors disabled:opacity-40">
                                            {resending === member.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                        </button>
                                        <button onClick={() => openEdit(member)} title="Editar rol"
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                            <Pencil size={14} />
                                        </button>
                                        {callerIsAdmin && (
                                            <button onClick={() => openDelete(member)} title="Eliminar"
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Modal: Crear usuario ── */}
            {modal === 'create' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-900">Nuevo usuario</h3>
                            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={17} /></button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            {modalError && <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-sm"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{modalError}</div>}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Documento *</label>
                                <input value={form.documentNumber} onChange={e => setForm(f => ({ ...f, documentNumber: e.target.value }))} placeholder="Cédula o documento" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre completo *</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. María García" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Correo electrónico *</label>
                                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@empresa.com" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Rol</label>
                                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Member['role'] }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none bg-white">
                                    <option value="PLAYER">Jugador</option>
                                    {!callerIsStaff && <option value="STAFF">Usuario (Staff)</option>}
                                    {!callerIsStaff && <option value="ADMIN">Administrador</option>}
                                    {!callerIsStaff && <option value="OWNER">Propietario</option>}
                                </select>
                                <p className="text-xs text-slate-400 mt-1.5">{ROLE_DESCS[form.role]}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Contraseña temporal</label>
                                <div className="relative">
                                    <input type={showPass ? 'text' : 'password'} value={form.tempPassword} onChange={e => setForm(f => ({ ...f, tempPassword: e.target.value }))} placeholder="Se genera automáticamente si se deja vacío" className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any} />
                                    <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">El usuario deberá cambiarla al primer ingreso.</p>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={form.sendEmail} onChange={e => setForm(f => ({ ...f, sendEmail: e.target.checked }))} className="w-4 h-4 rounded accent-amber-500" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">Enviar credenciales por correo</p>
                                    <p className="text-xs text-slate-400">El usuario recibirá su email y contraseña temporal.</p>
                                </div>
                            </label>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                            <button onClick={closeModal} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                            <button onClick={handleCreate} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-60 hover:brightness-90" style={{ backgroundColor: 'var(--color-primary,#f59e0b)' }}>
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear usuario
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Editar usuario ── */}
            {modal === 'edit' && target && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-900">Editar usuario</h3>
                            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={17} /></button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            {modalError && <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-sm"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{modalError}</div>}
                            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                                <Avatar member={target} />
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{target.name}</p>
                                    <p className="text-xs text-slate-400">{target.email}</p>
                                    {target.username && (
                                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                                            <span className="text-slate-400">Doc:</span> {target.username}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nombre completo *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent"
                                    style={{ '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Correo electrónico *</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent"
                                    style={{ '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Número de documento *</label>
                                <input
                                    type="text"
                                    value={form.documentNumber}
                                    onChange={e => setForm(f => ({ ...f, documentNumber: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent font-mono"
                                    style={{ '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Rol</label>
                                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Member['role'] }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none bg-white">
                                    <option value="PLAYER">Jugador</option>
                                    {!callerIsStaff && <option value="STAFF">Usuario (Staff)</option>}
                                    {!callerIsStaff && <option value="ADMIN">Administrador</option>}
                                    {!callerIsStaff && <option value="OWNER">Propietario</option>}
                                </select>
                                <p className="text-xs text-slate-400 mt-1.5">{ROLE_DESCS[form.role]}</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                            <button onClick={closeModal} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                            <button onClick={handleEdit} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-60 hover:brightness-90" style={{ backgroundColor: 'var(--color-primary,#f59e0b)' }}>
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Eliminar ── */}
            {modal === 'delete' && target && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                        <div className="px-6 py-5 text-center">
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3"><Trash2 size={20} className="text-red-500" /></div>
                            <h3 className="font-black text-slate-900 text-lg mb-1">¿Eliminar miembro?</h3>
                            <p className="text-slate-500 text-sm">Se eliminará permanentemente a <strong>{target.name}</strong> del equipo. Esta acción no se puede deshacer.</p>
                            {modalError && <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm"><AlertTriangle size={13} />{modalError}</div>}
                        </div>
                        <div className="px-6 pb-5 flex gap-3">
                            <button onClick={closeModal} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                            <button onClick={handleDelete} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-60">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Importación masiva ── */}
            {modal === 'bulk' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-black text-slate-900">Importar usuarios masivamente</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Un usuario por línea: <code className="bg-slate-100 px-1 rounded">Documento,Nombre,email[,ROL[,PasswordTemporal]]</code></p>
                            </div>
                            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={17} /></button>
                        </div>
                        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                            {modalError && <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-sm"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{modalError}</div>}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Lista de usuarios *</label>
                                <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={8} placeholder={"123456789,Carlos Pérez,carlos@empresa.com,PLAYER,TempPass1\n987654321,Ana Torres,ana@empresa.com,ADMIN\n555555555,Juan López,juan@empresa.com,,MiClave123"}
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent resize-y font-mono"
                                    style={{ '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any} />
                                <p className="text-xs text-slate-400 mt-1">Roles disponibles: <code>PLAYER</code> (defecto), <code>STAFF</code>, <code>ADMIN</code>, <code>OWNER</code>.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Contraseña temporal compartida</label>
                                <input value={bulkSharedPass} onChange={e => setBulkSharedPass(e.target.value)} placeholder="Se genera automáticamente para cada uno" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent" style={{ '--tw-ring-color': 'var(--color-primary,#f59e0b)' } as any} />
                                <p className="text-xs text-slate-400 mt-1">Solo se usa si una línea no incluye su propia contraseña. Si la dejas vacía y una línea tampoco la tiene, se genera automáticamente.</p>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={bulkSendEmail} onChange={e => setBulkSendEmail(e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">Enviar credenciales por correo a cada usuario</p>
                                    <p className="text-xs text-slate-400">Solo aplica a usuarios nuevos.</p>
                                </div>
                            </label>
                            {bulkResults && (
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-600">Resultados de importación</div>
                                    <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                                    {bulkResults.length >= 50 && (
                                        <div className="px-3 py-2 text-xs text-amber-600 bg-amber-50 border-t border-amber-100">
                                            Solo se muestran los primeros 50 resultados para evitar sobrecargar la pantalla.
                                        </div>
                                    )}
                                    {bulkResults.map((r, i) => (
                                        <div key={i} className={`px-3 py-2 text-xs ${r.ok ? 'text-slate-600' : 'text-red-500 bg-red-50'}`}>
                                                <div className="flex items-center justify-between">
                                                    <span className="truncate">{r.email}</span>
                                                    <span className={`font-bold shrink-0 ml-2 ${r.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {r.ok ? (r.isNewUser ? '✓ Creado' : '✓ Vinculado') : `✗ ${r.error}`}
                                                    </span>
                                                </div>
                                            {r.ok && r.tempPassword && (
                                                <div className="mt-0.5 text-[10px] text-slate-400">Clave temporal: <span className="font-mono font-bold text-amber-600">{r.tempPassword}</span></div>
                                            )}
                                        </div>
                                    ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {bulkProgress && (
                            <div className="px-6 pb-2 shrink-0">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                    <span>Importando usuarios...</span>
                                    <span className="font-bold">{bulkProgress.done} / {bulkProgress.total}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{ width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%`, backgroundColor: 'var(--color-primary,#f59e0b)' }}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                            <button onClick={closeModal} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{bulkResults ? 'Cerrar' : 'Cancelar'}</button>
                            {!bulkResults && (
                                <button onClick={handleBulk} disabled={saving || !bulkText.trim()} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-60 hover:brightness-90" style={{ backgroundColor: 'var(--color-primary,#f59e0b)' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </CorpLayout>
    );
}
