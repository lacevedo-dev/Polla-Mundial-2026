import React, { useEffect, useState } from 'react';
import {
    ShieldCheck, Users, ToggleLeft, Crown, Shield, User,
    Check, X, Loader2, AlertTriangle, ChevronDown, Ban,
    UserCheck, UserX, RefreshCw, Lock, Unlock, Eye,
    Trophy, BarChart2, Settings, PlusCircle, Send, Pencil,
} from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request, ApiError } from '../api';
import { useAuthStore } from '../stores/auth.store';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TenantRole = 'OWNER' | 'ADMIN' | 'STAFF' | 'PLAYER';
type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED';

interface Member {
    id: string;
    userId: string;
    name: string;
    email: string;
    username: string;
    avatar: string | null;
    role: TenantRole;
    status: MemberStatus;
    joinedAt: string;
}

interface TenantConfig {
    enablePayments: boolean;
    enableAiInsights: boolean;
    enablePublicLeagues: boolean;
    enableUserSelfRegister: boolean;
    requireInvitation: boolean;
    enableEmailNotif: boolean;
    enablePushNotif: boolean;
    enableStageFees: boolean;
}

// ─── Configuración visual de roles ───────────────────────────────────────────

const ROLE_CFG = {
    OWNER: { label: 'Propietario', icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-300',
        desc: 'Control total de la organización. Configura branding, planes, feature flags y puede asignar cualquier rol. Solo debe existir uno.' },
    ADMIN: { label: 'Administrador', icon: Shield, color: 'text-violet-600', bg: 'bg-violet-50', ring: 'ring-violet-300',
        desc: 'Gestiona pollas, miembros y accesos. Puede crear usuarios, cambiar roles y ver reportes. No puede modificar la configuración del sistema.' },
    STAFF: { label: 'Usuario (Staff)', icon: Users, color: 'text-sky-600', bg: 'bg-sky-50', ring: 'ring-sky-300',
        desc: 'Rol operativo: crea y modifica miembros, importa usuarios y reenvía credenciales. No puede acceder a pollas ni a la configuración.' },
    PLAYER: { label: 'Jugador', icon: User, color: 'text-slate-500', bg: 'bg-slate-100', ring: 'ring-slate-300',
        desc: 'Rol estándar. Participa en pollas, hace pronósticos y consulta el ranking. Sin acceso a funciones administrativas.' },
} as const;

const STATUS_CFG = {
    ACTIVE: { label: 'Activo', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: UserCheck },
    INACTIVE: { label: 'Inactivo', color: 'text-slate-400', bg: 'bg-slate-100', icon: UserX },
    BANNED: { label: 'Bloqueado', color: 'text-red-600', bg: 'bg-red-50', icon: Ban },
} as const;

// ─── Matriz de capacidades por rol ───────────────────────────────────────────

const CAPABILITIES = [
    { group: 'Pollas', items: [
        { label: 'Ver pollas del tenant', OWNER: true, ADMIN: true, STAFF: false, PLAYER: true },
        { label: 'Hacer pronósticos', OWNER: true, ADMIN: true, STAFF: false, PLAYER: true },
        { label: 'Ver ranking', OWNER: true, ADMIN: true, STAFF: false, PLAYER: true },
        { label: 'Crear / editar pollas', OWNER: true, ADMIN: true, STAFF: false, PLAYER: false },
        { label: 'Eliminar pollas', OWNER: true, ADMIN: false, STAFF: false, PLAYER: false },
        { label: 'Asignar torneo a polla', OWNER: true, ADMIN: true, STAFF: false, PLAYER: false },
    ]},
    { group: 'Miembros', items: [
        { label: 'Ver lista de miembros', OWNER: true, ADMIN: true, STAFF: true, PLAYER: false },
        { label: 'Crear / invitar miembros', OWNER: true, ADMIN: true, STAFF: true, PLAYER: false },
        { label: 'Cambiar rol (solo a Jugador)', OWNER: true, ADMIN: true, STAFF: true, PLAYER: false },
        { label: 'Cambiar rol a Admin / STAFF', OWNER: true, ADMIN: true, STAFF: false, PLAYER: false },
        { label: 'Bloquear / inactivar miembro', OWNER: true, ADMIN: true, STAFF: true, PLAYER: false },
        { label: 'Importación masiva', OWNER: true, ADMIN: true, STAFF: true, PLAYER: false },
        { label: 'Reenviar credenciales', OWNER: true, ADMIN: true, STAFF: true, PLAYER: false },
    ]},
    { group: 'Administración', items: [
        { label: 'Acceder al panel de miembros', OWNER: true, ADMIN: true, STAFF: true, PLAYER: false },
        { label: 'Acceder al panel admin general', OWNER: true, ADMIN: true, STAFF: false, PLAYER: false },
        { label: 'Cambiar branding / apariencia', OWNER: true, ADMIN: false, STAFF: false, PLAYER: false },
        { label: 'Configurar funciones del sistema', OWNER: true, ADMIN: false, STAFF: false, PLAYER: false },
        { label: 'Gestionar permisos y roles', OWNER: true, ADMIN: true, STAFF: false, PLAYER: false },
    ]},
];

// ─── Configuración de las feature flags ──────────────────────────────────────

const CONFIG_FIELDS: { key: keyof TenantConfig; label: string; description: string; icon: React.FC<any> }[] = [
    { key: 'enablePayments', label: 'Pagos y cobros', description: 'Permite configurar cuotas y planes de pago en las pollas.', icon: Trophy },
    { key: 'enableAiInsights', label: 'Análisis con IA', description: 'Muestra insights y predicciones generadas por inteligencia artificial.', icon: BarChart2 },
    { key: 'enablePublicLeagues', label: 'Pollas públicas', description: 'Permite crear pollas visibles para usuarios sin invitación.', icon: Eye },
    { key: 'enableUserSelfRegister', label: 'Auto-registro de usuarios', description: 'Los usuarios pueden registrarse sin ser invitados por un admin.', icon: UserCheck },
    { key: 'requireInvitation', label: 'Requerir invitación', description: 'Solo usuarios con invitación pueden unirse al portal.', icon: Send },
    { key: 'enableEmailNotif', label: 'Notificaciones por correo', description: 'Envía recordatorios y resultados por email a los miembros.', icon: Send },
    { key: 'enablePushNotif', label: 'Notificaciones push', description: 'Envía notificaciones push a dispositivos suscritos.', icon: Bell },
    { key: 'enableStageFees', label: 'Cuotas por fase', description: 'Permite cobrar cuotas adicionales en cada fase del torneo.', icon: PlusCircle },
];

function Bell(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>; }

// ─── Componente Avatar ────────────────────────────────────────────────────────

function Avatar({ member }: { member: Member }) {
    return (
        <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center">
            {member.avatar
                ? <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                : <span className="text-xs font-black text-slate-400">{member.name.charAt(0).toUpperCase()}</span>}
        </div>
    );
}

// ─── Componente Toggle ────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!value)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${value ? '' : 'bg-slate-200'}`}
            style={value ? { backgroundColor: 'var(--color-primary, #f59e0b)' } : {}}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    );
}

// ─── Vista principal ──────────────────────────────────────────────────────────

type Tab = 'roles' | 'miembros' | 'funciones';

export default function AdminCorpRoles() {
    const user = useAuthStore((s) => s.user);
    const isOwner = user?.tenantRole === 'OWNER';
    const isAdmin = isOwner || user?.tenantRole === 'ADMIN';

    const [tab, setTab] = useState<Tab>('roles');

    // ── Estado miembros ──
    const [members, setMembers] = useState<Member[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // ── Estado config ──
    const [config, setConfig] = useState<TenantConfig | null>(null);
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [savingConfig, setSavingConfig] = useState(false);

    // ── Feedback global ──
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    function flash(msg: string, kind: 'ok' | 'err') {
        if (kind === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); }
        else { setError(msg); setTimeout(() => setError(null), 4000); }
    }

    // ── Carga de datos ──
    function loadMembers() {
        setLoadingMembers(true);
        request<Member[]>('/corp/members')
            .then(setMembers)
            .catch(() => setMembers([]))
            .finally(() => setLoadingMembers(false));
    }

    function loadConfig() {
        setLoadingConfig(true);
        request<TenantConfig>('/corp/config')
            .then(setConfig)
            .catch(() => setConfig(null))
            .finally(() => setLoadingConfig(false));
    }

    useEffect(() => { loadMembers(); loadConfig(); }, []);

    // ── Actualizar rol o estado de un miembro ──
    async function updateMember(id: string, patch: { role?: TenantRole; status?: MemberStatus }) {
        setUpdatingId(id);
        try {
            await request(`/corp/members/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
            setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
            flash('Miembro actualizado correctamente.', 'ok');
        } catch (e) {
            flash(e instanceof ApiError ? e.message : 'Error al actualizar miembro.', 'err');
        } finally {
            setUpdatingId(null);
        }
    }

    // ── Guardar feature flags ──
    async function saveConfig(patch: Partial<TenantConfig>) {
        if (!config) return;
        const newCfg = { ...config, ...patch };
        setConfig(newCfg);
        setSavingConfig(true);
        try {
            const saved = await request<TenantConfig>('/corp/config', { method: 'PATCH', body: JSON.stringify(patch) });
            setConfig(saved);
            flash('Configuración guardada.', 'ok');
        } catch (e) {
            setConfig(config);
            flash(e instanceof ApiError ? e.message : 'Error al guardar configuración.', 'err');
        } finally {
            setSavingConfig(false);
        }
    }

    const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
        { id: 'roles', label: 'Roles y Capacidades', icon: ShieldCheck },
        { id: 'miembros', label: 'Acceso de Miembros', icon: Users },
        { id: 'funciones', label: 'Funciones del Sistema', icon: ToggleLeft },
    ];

    return (
        <CorpLayout>
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck size={20} className="text-violet-600" />
                    <h1 className="text-2xl font-black text-slate-900">Roles y Permisos</h1>
                </div>
                <p className="text-slate-500 text-sm">Gestiona los accesos y capacidades de cada miembro del portal.</p>
            </div>

            {/* Feedback */}
            {success && (
                <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium">
                    <Check size={15} />{success}
                </div>
            )}
            {error && (
                <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
                    <AlertTriangle size={15} />{error}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-2xl w-fit">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Icon size={15} />{label}
                    </button>
                ))}
            </div>

            {/* ── TAB: Roles y Capacidades ── */}
            {tab === 'roles' && (
                <div className="space-y-4">
                    {/* Leyenda de roles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        {(Object.keys(ROLE_CFG) as TenantRole[]).map(role => {
                            const cfg = ROLE_CFG[role];
                            const Icon = cfg.icon;
                            const count = members.filter(m => m.role === role && m.status === 'ACTIVE').length;
                            return (
                                <div key={role} className={`flex flex-col gap-3 p-4 rounded-2xl border ${cfg.bg} border-transparent`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ring-2 ${cfg.ring} ${cfg.bg}`}>
                                            <Icon size={16} className={cfg.color} />
                                        </div>
                                        <div>
                                            <p className={`font-black text-sm ${cfg.color}`}>{cfg.label}</p>
                                            <p className="text-xs text-slate-400">{count} miembro{count !== 1 ? 's' : ''} activo{count !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">{cfg.desc}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Matriz de capacidades */}
                    {CAPABILITIES.map(group => (
                        <div key={group.group} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="font-black text-slate-800 text-sm">{group.group}</h2>
                                <div className="hidden sm:flex items-center gap-4 pr-1">
                                    {(['OWNER', 'ADMIN', 'STAFF', 'PLAYER'] as TenantRole[]).map(r => {
                                        const cfg = ROLE_CFG[r];
                                        const Icon = cfg.icon;
                                        return (
                                            <span key={r} className={`text-[10px] font-black flex items-center gap-1 w-16 justify-center ${cfg.color}`}>
                                                <Icon size={10} />{cfg.label}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {group.items.map(item => (
                                    <div key={item.label} className="flex items-center justify-between px-5 py-3">
                                        <span className="text-sm text-slate-600">{item.label}</span>
                                        <div className="flex items-center gap-4 sm:gap-4">
                                            {(['OWNER', 'ADMIN', 'STAFF', 'PLAYER'] as TenantRole[]).map(role => (
                                                <div key={role} className="w-16 flex justify-center">
                                                    {(item as any)[role]
                                                        ? <Check size={16} className="text-emerald-500" />
                                                        : <X size={14} className="text-slate-200" />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── TAB: Acceso de Miembros ── */}
            {tab === 'miembros' && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-black text-slate-800 text-sm">
                            Miembros
                            <span className="ml-2 text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                                {members.length}
                            </span>
                        </h2>
                        <button onClick={loadMembers} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                            <RefreshCw size={14} />
                        </button>
                    </div>

                    {loadingMembers ? (
                        <div className="p-12 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
                    ) : !members.length ? (
                        <div className="p-10 text-center text-slate-400 text-sm">Sin miembros registrados.</div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {/* Cabecera de columnas */}
                            <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                <span>Miembro</span>
                                <span className="w-32 text-center">Rol</span>
                                <span className="w-28 text-center">Estado</span>
                            </div>

                            {members.map(member => {
                                const roleCfg = ROLE_CFG[member.role] ?? ROLE_CFG.PLAYER;
                                const stCfg = STATUS_CFG[member.status] ?? STATUS_CFG.ACTIVE;
                                const StIcon = stCfg.icon;
                                const isUpdating = updatingId === member.id;
                                const isSelf = member.userId === user?.id;

                                return (
                                    <div key={member.id} className={`flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto] gap-3 sm:gap-4 px-5 py-3.5 items-start sm:items-center hover:bg-slate-50/70 transition-colors ${member.status === 'BANNED' ? 'opacity-60' : ''}`}>
                                        {/* Info */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar member={member} />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <p className="font-bold text-slate-800 text-sm truncate">{member.name}</p>
                                                    {isSelf && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-900 text-white">Tú</span>}
                                                </div>
                                                <p className="text-xs text-slate-400 truncate">{member.email}</p>
                                            </div>
                                        </div>

                                        {/* Rol */}
                                        <div className="w-32">
                                            {isUpdating ? (
                                                <div className="flex justify-center"><Loader2 size={14} className="animate-spin text-slate-300" /></div>
                                            ) : (
                                                <div className="relative">
                                                    <select
                                                        value={member.role}
                                                        disabled={!isAdmin || isSelf || member.role === 'OWNER'}
                                                        onChange={e => updateMember(member.id, { role: e.target.value as TenantRole })}
                                                        className={`w-full appearance-none pl-2.5 pr-6 py-1.5 text-xs font-black rounded-lg border focus:outline-none cursor-pointer disabled:cursor-default ${roleCfg.bg} ${roleCfg.color} border-transparent`}
                                                    >
                                                        <option value="OWNER">Propietario</option>
                                                        <option value="ADMIN">Admin</option>
                                                        <option value="STAFF">Usuario</option>
                                                        <option value="PLAYER">Jugador</option>
                                                    </select>
                                                    <ChevronDown size={10} className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${roleCfg.color}`} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Estado */}
                                        <div className="w-28">
                                            {isUpdating ? null : (
                                                <div className="relative">
                                                    <select
                                                        value={member.status}
                                                        disabled={!isAdmin || isSelf || member.role === 'OWNER'}
                                                        onChange={e => updateMember(member.id, { status: e.target.value as MemberStatus })}
                                                        className={`w-full appearance-none pl-2 pr-6 py-1.5 text-xs font-bold rounded-lg border focus:outline-none cursor-pointer disabled:cursor-default ${stCfg.bg} ${stCfg.color} border-transparent`}
                                                    >
                                                        <option value="ACTIVE">Activo</option>
                                                        <option value="INACTIVE">Inactivo</option>
                                                        <option value="BANNED">Bloqueado</option>
                                                    </select>
                                                    <ChevronDown size={10} className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${stCfg.color}`} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Leyenda de estados */}
                    <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap gap-3">
                        {(Object.keys(STATUS_CFG) as MemberStatus[]).map(s => {
                            const cfg = STATUS_CFG[s];
                            const Icon = cfg.icon;
                            return (
                                <span key={s} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                                    <Icon size={10} />{cfg.label}
                                </span>
                            );
                        })}
                        <span className="text-[10px] text-slate-400 self-center ml-1">· Los cambios de rol y estado se aplican de inmediato.</span>
                    </div>
                </div>
            )}

            {/* ── TAB: Funciones del Sistema ── */}
            {tab === 'funciones' && (
                <div className="space-y-4">
                    {!isOwner && (
                        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <Lock size={15} className="text-amber-500 shrink-0" />
                            <p className="text-sm text-amber-700">Solo el <strong>Propietario</strong> puede modificar las funciones del sistema.</p>
                        </div>
                    )}

                    {loadingConfig ? (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex justify-center">
                            <Loader2 size={24} className="animate-spin text-slate-300" />
                        </div>
                    ) : !config ? (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center text-slate-400 text-sm">
                            No se pudo cargar la configuración.
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="font-black text-slate-800 text-sm">Funciones habilitadas</h2>
                                {savingConfig && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <Loader2 size={12} className="animate-spin" /> Guardando…
                                    </div>
                                )}
                            </div>

                            <div className="divide-y divide-slate-50">
                                {CONFIG_FIELDS.map(({ key, label, description, icon: Icon }) => (
                                    <div key={key} className="flex items-center justify-between px-5 py-4 gap-4">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                                                <Icon size={15} className="text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{label}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-2">
                                            <span className={`text-xs font-bold hidden sm:block ${config[key] ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                {config[key] ? 'Activo' : 'Inactivo'}
                                            </span>
                                            <Toggle
                                                value={config[key]}
                                                onChange={v => saveConfig({ [key]: v })}
                                                disabled={!isOwner || savingConfig}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {isOwner && (
                                <div className="px-5 py-3 border-t border-slate-100">
                                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                        <Unlock size={10} /> Los cambios en las funciones del sistema se aplican de forma inmediata para todos los miembros.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </CorpLayout>
    );
}
