import React from 'react';
import { Shield, Database, Key, Users, Trophy, Target, Swords, CreditCard, Layers, Settings, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';

const PERMISSIONS_MATRIX = [
    { role: 'USER', label: 'Usuario', color: 'text-slate-600', permissions: {
        dashboard: true, predictions: true, leagues: true, ranking: true,
        adminDashboard: false, adminUsers: false, adminLeagues: false, adminMatches: false, adminPlans: false,
    }},
    { role: 'ADMIN', label: 'Admin (Liga)', color: 'text-blue-600', permissions: {
        dashboard: true, predictions: true, leagues: true, ranking: true,
        adminDashboard: false, adminUsers: false, adminLeagues: false, adminMatches: false, adminPlans: false,
    }},
    { role: 'SUPERADMIN', label: 'Super Admin', color: 'text-amber-600', permissions: {
        dashboard: true, predictions: true, leagues: true, ranking: true,
        adminDashboard: true, adminUsers: true, adminLeagues: true, adminMatches: true, adminPlans: true,
    }},
];

const PERMISSION_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
    dashboard: { label: 'Dashboard', icon: BarChart3 },
    predictions: { label: 'Pronósticos', icon: Target },
    leagues: { label: 'Pollas', icon: Trophy },
    ranking: { label: 'Ranking', icon: Users },
    adminDashboard: { label: 'Panel Admin', icon: Shield },
    adminUsers: { label: 'Gestión Usuarios', icon: Users },
    adminLeagues: { label: 'Gestión Pollas', icon: Trophy },
    adminMatches: { label: 'Gestión Partidos', icon: Swords },
    adminPlans: { label: 'Gestión Planes', icon: CreditCard },
};

const AdminSettings: React.FC = () => {
    const { user } = useAuthStore();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black text-slate-900 font-brand uppercase tracking-tight">Configuración del Sistema</h1>
                <p className="text-sm text-slate-500 mt-1">Información del sistema, roles y permisos</p>
            </div>

            {/* System Info */}
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                        <Database size={18} className="text-amber-600" />
                    </div>
                    <p className="font-black text-slate-900">Información del Sistema</p>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {[
                        { label: 'Aplicación', value: 'Polla 2026' },
                        { label: 'Versión', value: '1.0.0' },
                        { label: 'Entorno', value: import.meta.env.MODE },
                        { label: 'API URL', value: import.meta.env.VITE_API_URL ?? 'localhost:3004' },
                        { label: 'Usuario Admin', value: user?.name ?? '—' },
                        { label: 'Rol', value: user?.systemRole ?? 'SUPERADMIN' },
                    ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
                            <p className="text-sm font-bold text-slate-800 mt-0.5 break-all">{value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Roles & Permissions Matrix */}
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Shield size={18} className="text-blue-600" />
                    </div>
                    <p className="font-black text-slate-900">Roles y Permisos</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="text-left py-2 pr-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-48">
                                    Permiso
                                </th>
                                {PERMISSIONS_MATRIX.map((r) => (
                                    <th key={r.role} className="text-center py-2 px-3">
                                        <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${r.color}`}>
                                            {r.label}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {Object.entries(PERMISSION_LABELS).map(([key, { label, icon: Icon }]) => (
                                <tr key={key} className="hover:bg-slate-50">
                                    <td className="py-2.5 pr-4">
                                        <div className="flex items-center gap-2">
                                            <Icon size={14} className="text-slate-400" />
                                            <span className="text-sm text-slate-700 font-medium">{label}</span>
                                        </div>
                                    </td>
                                    {PERMISSIONS_MATRIX.map((r) => (
                                        <td key={r.role} className="py-2.5 px-3 text-center">
                                            {(r.permissions as any)[key] ? (
                                                <span className="inline-flex w-5 h-5 rounded-full bg-lime-100 items-center justify-center text-lime-600 text-xs font-black">✓</span>
                                            ) : (
                                                <span className="inline-flex w-5 h-5 rounded-full bg-slate-100 items-center justify-center text-slate-300 text-xs">—</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* JWT Info */}
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Key size={18} className="text-slate-600" />
                    </div>
                    <p className="font-black text-slate-900">Sesión Activa</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-24">ID</span>
                        <span className="text-xs font-mono text-slate-600">{user?.id ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-24">Email</span>
                        <span className="text-sm text-slate-700">{user?.email ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-24">Username</span>
                        <span className="text-sm text-slate-700">@{user?.username ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 w-24">System Role</span>
                        <span className="text-sm font-black text-amber-600">{user?.systemRole ?? 'SUPERADMIN'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
