import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Home, Trophy, BarChart2, LogOut, Menu, X,
    Building2, Shield, Users, HelpCircle, Bell, BellOff, PlusCircle, Settings, ShieldCheck, Activity,
} from 'lucide-react';
import { useTenantStore } from '../stores/tenant.store';
import { useAuthStore } from '../stores/auth.store';
import { usePushNotifications } from '../hooks/usePushNotifications';
import NotificationBell from '../components/NotificationBell';
import { BASE_URL } from '../api';

const NAV_ITEMS = [
    { path: '/', label: 'Inicio', icon: Home },
    { path: '/pollas', label: 'Participar', icon: Trophy },
    { path: '/ranking', label: 'Ranking', icon: BarChart2 },
    { path: '/help', label: 'Ayuda', icon: HelpCircle },
];

const ADMIN_NAV_ITEMS = [
    { path: '/admin', label: 'Panel Admin', icon: Shield },
    { path: '/admin/participation', label: 'Participación', icon: Activity },
    { path: '/admin/members', label: 'Gestión de usuarios', icon: Users },
    { path: '/admin/pollas', label: 'Gestionar Pollas', icon: PlusCircle },
    { path: '/admin/roles', label: 'Roles y Permisos', icon: ShieldCheck },
    { path: '/admin/settings', label: 'Configuración', icon: Settings },
];

export function CorpLayout({ children }: { children: React.ReactNode }) {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const tenant = useTenantStore((s) => s.tenant);
    const { user, logout } = useAuthStore();
    const [mobileOpen, setMobileOpen] = useState(false);
    const { supported, permission, subscribed, loading, error, subscribe, unsubscribe } = usePushNotifications();
    const pushAvailable = supported && permission !== 'denied';

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'Portal Corporativo';
    const isAdmin = user?.tenantRole === 'OWNER' || user?.tenantRole === 'ADMIN';
    const isStaff = user?.tenantRole === 'STAFF';
    const primaryColor = 'var(--color-primary, #f59e0b)';

    const avatarUrl = user?.avatar
        ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'U')}&background=random`;

    const isActive = (path: string) =>
        path === '/' ? pathname === '/' : pathname.startsWith(path);

    const SidebarLink = ({ path, label, icon: Icon, highlight }: { path: string; label: string; icon: React.FC<{ size?: number }>; highlight?: boolean }) => {
        const active = isActive(path);
        let style: React.CSSProperties = {};
        let cls = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ';
        if (active) {
            style = { backgroundColor: primaryColor };
            cls += 'text-black';
        } else if (highlight) {
            style = { backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, transparent)', color: 'var(--color-primary, #f59e0b)' };
        } else {
            cls += 'text-slate-400 hover:text-white hover:bg-slate-900';
        }
        return (
            <Link to={path} onClick={() => setMobileOpen(false)} className={cls} style={style}>
                <Icon size={20} />
                <span>{label}</span>
            </Link>
        );
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">

            {/* ── Desktop Sidebar ── */}
            <aside className="hidden md:flex flex-col w-64 bg-black text-white h-screen sticky top-0 shadow-xl z-20">
                {/* Logo / Org name */}
                <div className="p-6">
                    <Link to="/" className="mb-8 flex h-20 w-full items-center justify-center rounded-xl">
                        {tenant?.branding?.logoUrl ? (
                            <img
                                src={tenant.branding.logoUrl}
                                alt={orgName}
                                className="max-h-16 w-full object-contain"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto"
                                style={{ backgroundColor: primaryColor }}>
                                <Building2 size={20} className="text-white" />
                            </div>
                        )}
                    </Link>

                    {/* Primary nav */}
                    <nav className="space-y-1">
                        {NAV_ITEMS.map((item) => (
                            <SidebarLink key={item.path} {...item} />
                        ))}
                    </nav>

                    {/* Admin nav */}
                    {(isAdmin || isStaff) && (
                        <div className="mt-6">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 px-4 mb-2">
                                Administración
                            </p>
                            <nav className="space-y-1">
                                {(isStaff
                                    ? ADMIN_NAV_ITEMS.filter(i => i.path === '/admin/members' || i.path === '/admin/participation')
                                    : ADMIN_NAV_ITEMS
                                ).map((item) => (
                                    <SidebarLink key={item.path} {...item} highlight />
                                ))}
                            </nav>
                        </div>
                    )}
                </div>

                {/* Notification toggle */}
                {pushAvailable && (
                    <div className="px-4 pb-4">
                        {error && (
                            <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{error}</p>
                        )}
                        <button
                            onClick={subscribed ? unsubscribe : subscribe}
                            disabled={loading}
                            aria-pressed={subscribed}
                            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                                loading ? 'opacity-60 pointer-events-none' : ''
                            }`}
                            style={subscribed
                                ? { borderColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 50%, #86efac)', backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 12%, #f0fdf4)', color: '#14532d' }
                                : { borderColor: '#e2e8f0', backgroundColor: '#ffffff', color: '#334155' }
                            }
                        >
                            {subscribed
                                ? <Bell size={18} className="shrink-0" style={{ color: 'var(--color-primary, #f59e0b)' }} />
                                : <BellOff size={18} className="shrink-0 text-slate-400" />
                            }
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold">
                                    {loading ? 'Procesando...' : subscribed ? 'Notificaciones activas' : 'Activar notificaciones'}
                                </p>
                                <p className="text-xs" style={{ color: subscribed ? '#166534' : '#94a3b8' }}>
                                    {subscribed ? 'Recibirás avisos de partidos, cierres y resultados' : 'Avisos de partidos, cierres y resultados'}
                                </p>
                            </div>
                            <span
                                className="inline-block h-5 w-9 rounded-full transition-colors shrink-0"
                                style={{ backgroundColor: subscribed ? 'var(--color-primary, #f59e0b)' : '#cbd5e1' }}
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                )}

                {/* Sidebar branding image */}
                {tenant?.branding?.sidebarImageUrl && (
                    <div className="px-4 pb-4">
                        <img
                            src={tenant.branding.sidebarImageUrl.startsWith('http') || tenant.branding.sidebarImageUrl.startsWith('data:') ? tenant.branding.sidebarImageUrl : `${BASE_URL}${tenant.branding.sidebarImageUrl}`}
                            alt="Branding"
                            className="w-full rounded-xl object-cover"
                            style={{ aspectRatio: '1 / 1', maxHeight: '160px' }}
                        />
                    </div>
                )}

                {/* User profile — bottom */}
                <div className="mt-auto p-6 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <img
                                src={avatarUrl}
                                alt={user?.name ?? 'Avatar'}
                                className="w-10 h-10 rounded-full object-cover shrink-0"
                                style={{ boxShadow: `0 0 0 2px var(--color-primary, #f59e0b)` }}
                            />
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate max-w-[110px]">
                                    {user?.name ?? 'Usuario'}
                                </p>
                                {user?.username && (
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[110px]">
                                        {user.username}
                                    </p>
                                )}
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                    {isAdmin ? (user?.tenantRole === 'OWNER' ? 'Propietario' : 'Administrador') : 'Participante'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-slate-400 hover:text-rose-400 transition-colors shrink-0 ml-2"
                            title="Cerrar sesión"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Mobile Header ── */}
            <header className="md:hidden flex items-center justify-between px-4 py-3 bg-black text-white sticky top-0 z-30 shadow-md">
                <Link to="/" className="flex items-center">
                    {tenant?.branding?.logoUrl ? (
                        <img src={tenant.branding.logoUrl} alt={orgName} className="h-8 object-contain" />
                    ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: primaryColor }}>
                            <Building2 size={16} className="text-white" />
                        </div>
                    )}
                </Link>
                <div className="flex items-center gap-2">
                    {/* User avatar — toca para abrir menú con datos completos */}
                    <button
                        onClick={() => setMobileOpen(true)}
                        title={user?.name ?? 'Mi perfil'}
                        className="rounded-full hover:opacity-80 transition-opacity"
                    >
                        <img
                            src={avatarUrl}
                            alt={user?.name ?? 'Avatar'}
                            className="w-8 h-8 rounded-full object-cover"
                            style={{ boxShadow: `0 0 0 2px var(--color-primary, #f59e0b)` }}
                        />
                    </button>
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800"
                    >
                        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </header>

            {/* ── Mobile Menu Overlay ── */}
            {mobileOpen && (
                <div className="fixed inset-0 bg-slate-950 z-50 md:hidden flex flex-col">
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
                        <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center">
                            {tenant?.branding?.logoUrl ? (
                                <img src={tenant.branding.logoUrl} alt={orgName} className="h-8 object-contain" />
                            ) : (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: primaryColor }}>
                                    <Building2 size={16} className="text-white" />
                                </div>
                            )}
                        </Link>
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* User card */}
                    <div className="px-5 py-4 border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-3">
                            <img
                                src={avatarUrl}
                                alt={user?.name ?? 'Avatar'}
                                className="w-12 h-12 rounded-full object-cover shrink-0"
                                style={{ boxShadow: `0 0 0 2px var(--color-primary, #f59e0b)` }}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-bold truncate">{user?.name ?? 'Usuario'}</p>
                                {user?.username && (
                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                                        {user.username}
                                    </p>
                                )}
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {isAdmin ? (user?.tenantRole === 'OWNER' ? 'Propietario' : 'Administrador') : 'Participante'}
                                </p>
                            </div>
                            <button
                                onClick={() => { handleLogout(); setMobileOpen(false); }}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                        {NAV_ITEMS.map((item) => (
                            <SidebarLink key={item.path} {...item} />
                        ))}
                        {(isAdmin || isStaff) && (
                            <>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 px-4 pt-4 pb-1">
                                    Administración
                                </p>
                                {(isStaff
                                    ? ADMIN_NAV_ITEMS.filter(i => i.path === '/admin/members' || i.path === '/admin/participation')
                                    : ADMIN_NAV_ITEMS
                                ).map((item) => (
                                    <SidebarLink key={item.path} {...item} highlight />
                                ))}
                            </>
                        )}
                    </nav>

                    {/* Notification toggle mobile */}
                    {pushAvailable && (
                        <div className="px-4 pb-3">
                            {error && (
                                <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{error}</p>
                            )}
                            <button
                                onClick={subscribed ? unsubscribe : subscribe}
                                disabled={loading}
                                aria-pressed={subscribed}
                                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                                    loading ? 'opacity-60 pointer-events-none' : ''
                                }`}
                                style={subscribed
                                    ? { borderColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 50%, #86efac)', backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 12%, #f0fdf4)', color: '#14532d' }
                                    : { borderColor: '#334155', backgroundColor: '#1e293b', color: '#94a3b8' }
                                }
                            >
                                {subscribed
                                    ? <Bell size={18} className="shrink-0" style={{ color: 'var(--color-primary, #f59e0b)' }} />
                                    : <BellOff size={18} className="shrink-0 text-slate-500" />
                                }
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold">
                                        {loading ? 'Procesando...' : subscribed ? 'Notificaciones activas' : 'Activar notificaciones'}
                                    </p>
                                    <p className="text-xs" style={{ color: subscribed ? '#166534' : '#64748b' }}>
                                        {subscribed ? 'Recibirás avisos de partidos, cierres y resultados' : 'Avisos de partidos, cierres y resultados'}
                                    </p>
                                </div>
                                <span
                                    className="inline-block h-5 w-9 rounded-full transition-colors shrink-0"
                                    style={{ backgroundColor: subscribed ? 'var(--color-primary, #f59e0b)' : '#334155' }}
                                    aria-hidden="true"
                                />
                            </button>
                        </div>
                    )}

                    {/* Bottom logout */}
                    <div className="px-4 pb-6 pt-3 border-t border-slate-800 shrink-0">
                        <button
                            onClick={() => { handleLogout(); setMobileOpen(false); }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-rose-400 hover:bg-rose-400/10 transition-colors"
                        >
                            <LogOut size={18} />
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ── Main Content ── */}
            <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
                <div className="max-w-6xl mx-auto p-4 md:p-8">
                    {children}
                </div>
            </main>

            {/* ── Campana de notificaciones flotante ── */}
            <NotificationBell />

            {/* ── Mobile Bottom Nav ── */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-30 shadow-lg">
                {NAV_ITEMS.slice(0, 4).map(({ path, label, icon: Icon }) => {
                    const active = isActive(path);
                    return (
                        <Link
                            key={path}
                            to={path}
                            className="flex flex-col items-center gap-1 transition-colors"
                            style={{ color: active ? primaryColor : '#94a3b8' }}
                        >
                            <Icon size={20} />
                            <span className="text-[10px] font-medium">{label}</span>
                        </Link>
                    );
                })}
                {(isAdmin || isStaff) && (
                    <Link
                        to={isStaff ? '/admin/members' : '/admin'}
                        className="flex flex-col items-center gap-1 transition-colors"
                        style={{ color: isActive('/admin') ? primaryColor : '#94a3b8' }}
                    >
                        <Shield size={20} />
                        <span className="text-[10px] font-medium">Admin</span>
                    </Link>
                )}
            </nav>

        </div>
    );
}
