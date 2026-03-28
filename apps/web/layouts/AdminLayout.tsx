import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    BarChart3, Users, Trophy, Swords, CreditCard, Layers,
    Settings, LogOut, Shield, X, Target, ArrowLeft, RefreshCw,
    Sparkles, Coins, ChevronLeft, ChevronRight, MoreHorizontal,
    PanelLeftClose, PanelLeftOpen, Bell, Mail,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { useFootballSyncStore } from '../stores/football-sync.store';

/* ─────────────── Nav items ─────────────── */
const primaryNavItems = [
    { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
    { to: '/admin/users', label: 'Usuarios', icon: Users },
    { to: '/admin/leagues', label: 'Pollas', icon: Trophy },
    { to: '/admin/matches', label: 'Partidos', icon: Swords },
];

const secondaryNavItems = [
    { to: '/admin/plans', label: 'Planes', icon: CreditCard },
    { to: '/admin/affiliations', label: 'Afiliaciones', icon: Layers },
    { to: '/admin/predictions', label: 'Pronósticos', icon: Target },
    { to: '/admin/payments', label: 'Pagos', icon: Coins },
    { to: '/admin/ai-usage', label: 'Consultas IA', icon: Sparkles },
    { to: '/admin/football-sync', label: 'Football Sync', icon: RefreshCw },
    { to: '/admin/football-sync/plan', label: 'Plan de Sync', icon: BarChart3 },
    { to: '/admin/automation', label: 'Automatización', icon: Bell },
    { to: '/admin/email-providers', label: 'SMTP / Correo', icon: Mail },
    { to: '/admin/settings', label: 'Sistema', icon: Settings },
];

const allNavItems = [...primaryNavItems, ...secondaryNavItems];

/* ─────────────── Section titles ─────────────── */
const sectionTitles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/users': 'Usuarios',
    '/admin/leagues': 'Pollas',
    '/admin/matches': 'Partidos',
    '/admin/plans': 'Planes',
    '/admin/affiliations': 'Afiliaciones',
    '/admin/predictions': 'Pronósticos',
    '/admin/payments': 'Pagos',
    '/admin/ai-usage': 'Consultas IA',
    '/admin/football-sync': 'Football Sync',
    '/admin/automation': 'Automatización',
    '/admin/email-providers': 'SMTP / Correo',
    '/admin/settings': 'Sistema',
};

/* ─────────────── NavLink class helpers ─────────────── */
function sidebarLink(isActive: boolean, collapsed: boolean) {
    const base =
        'group relative flex items-center gap-3 rounded-xl transition-all duration-150 font-semibold text-sm';
    const size = collapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5';
    const color = isActive
        ? 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/30'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/70';
    return `${base} ${size} ${color}`;
}

/* ─────────────── Sidebar NavItem ─────────────── */
interface SidebarItemProps {
    item: (typeof allNavItems)[number];
    collapsed: boolean;
    usageSummary: { percentage: number; used: number; limit: number } | null;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ item, collapsed, usageSummary }) => (
    <NavLink
        to={item.to}
        end={'end' in item ? Boolean(item.end) : undefined}
        className={({ isActive }) => sidebarLink(isActive, collapsed)}
        title={collapsed ? item.label : undefined}
    >
        <item.icon size={18} className="shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && item.to === '/admin/football-sync' && usageSummary && (
            <SyncBadge summary={usageSummary} />
        )}
        {collapsed && item.to === '/admin/football-sync' && usageSummary && usageSummary.percentage >= 70 && (
            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                usageSummary.percentage >= 90 ? 'bg-rose-500' : 'bg-amber-400'
            }`} />
        )}
        {/* Tooltip on collapsed */}
        {collapsed && (
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
                {item.label}
            </span>
        )}
    </NavLink>
);

/* ─────────────── Sync badge ─────────────── */
const SyncBadge: React.FC<{ summary: { percentage: number; used: number; limit: number } }> = ({ summary }) => (
    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
        summary.percentage >= 90
            ? 'bg-rose-500/20 text-rose-400'
            : summary.percentage >= 70
            ? 'bg-amber-400/20 text-amber-400'
            : 'bg-slate-700 text-slate-400'
    }`}>
        {summary.used}/{summary.limit}
    </span>
);

/* ─────────────── User avatar helper ─────────────── */
function avatarUrl(name: string, avatar?: string | null) {
    if (avatar) return avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f59e0b&color=000&size=72`;
}

/* ─────────────── Main layout ─────────────── */
const AdminLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, isSuperAdmin, checkAuth, sessionChecked } = useAuthStore();
    const { usageSummary, fetchUsageSummary } = useFootballSyncStore();

    const [collapsed, setCollapsed] = React.useState(false);
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const hasStoredToken = Boolean(localStorage.getItem('token'));

    /* Fetch API usage every minute */
    React.useEffect(() => {
        fetchUsageSummary();
        const id = window.setInterval(fetchUsageSummary, 60_000);
        return () => window.clearInterval(id);
    }, [fetchUsageSummary]);

    /* Auth guard — run once on mount, not on every user change */
    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        void checkAuth().then((ok) => {
            if (!ok) { navigate('/login'); return; }
            if (!useAuthStore.getState().isSuperAdmin()) navigate('/dashboard');
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, checkAuth]);

    /* Close drawer on route change */
    React.useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

    const handleLogout = () => { logout(); navigate('/'); };

    /* Derive current section title for mobile header */
    const currentTitle = React.useMemo(() => {
        const exact = sectionTitles[location.pathname];
        if (exact) return exact;
        const match = Object.entries(sectionTitles)
            .filter(([k]) => k !== '/admin')
            .find(([k]) => location.pathname.startsWith(k));
        return match ? match[1] : 'Admin';
    }, [location.pathname]);

    if (hasStoredToken && !sessionChecked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 px-6">
                <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-amber-400" />
                    <p className="mt-4 text-sm font-semibold text-slate-700">Validando sesión…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-slate-100">

            {/* ── Desktop Sidebar ── */}
            <aside className={`hidden lg:flex flex-col bg-slate-950 text-white h-screen sticky top-0 shadow-xl z-20 transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
                {/* Brand */}
                <div className={`flex items-center h-16 border-b border-slate-800/60 shrink-0 ${collapsed ? 'justify-center px-3' : 'gap-3 px-5'}`}>
                    <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center shrink-0">
                        <Shield size={16} className="text-slate-950" />
                    </div>
                    {!collapsed && (
                        <div className="min-w-0">
                            <p className="font-brand text-sm tracking-tight leading-none text-white truncate">
                                POLLA<span className="text-amber-400">2026</span>
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 mt-0.5">
                                Super Admin
                            </p>
                        </div>
                    )}
                </div>

                {/* Scrollable nav */}
                <div className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
                    {/* Back to app */}
                    <NavLink
                        to="/dashboard"
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800/70 transition-colors mb-2 ${collapsed ? 'justify-center' : ''}`}
                        title={collapsed ? 'Volver al App' : undefined}
                    >
                        <ArrowLeft size={16} className="shrink-0" />
                        {!collapsed && <span className="text-xs">Volver al App</span>}
                        {collapsed && (
                            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50 group relative">
                                Volver al App
                            </span>
                        )}
                    </NavLink>

                    <div className="h-px bg-slate-800/60 mx-1 mb-2" />

                    {/* Primary nav */}
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-1 ${collapsed ? 'hidden' : 'px-3'}`}>
                        Principal
                    </p>
                    {primaryNavItems.map((item) => (
                        <SidebarItem key={item.to} item={item} collapsed={collapsed} usageSummary={usageSummary} />
                    ))}

                    <div className="h-px bg-slate-800/60 mx-1 my-2" />

                    {/* Secondary nav */}
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-1 ${collapsed ? 'hidden' : 'px-3'}`}>
                        Gestión
                    </p>
                    {secondaryNavItems.map((item) => (
                        <SidebarItem key={item.to} item={item} collapsed={collapsed} usageSummary={usageSummary} />
                    ))}
                </div>

                {/* Collapse toggle */}
                <div className="px-2 py-2 border-t border-slate-800/60">
                    <button
                        onClick={() => setCollapsed((c) => !c)}
                        className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800/70 transition-colors text-xs ${collapsed ? 'justify-center' : ''}`}
                        aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                        title={collapsed ? 'Expandir' : 'Colapsar'}
                    >
                        {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} /><span>Colapsar</span></>}
                    </button>
                </div>

                {/* User footer */}
                <div className={`border-t border-slate-800/60 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
                    {collapsed ? (
                        <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 transition-colors p-2" title="Cerrar sesión">
                            <LogOut size={18} />
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <img
                                src={avatarUrl(user?.name ?? 'Admin', user?.avatar)}
                                className="w-9 h-9 rounded-full ring-2 ring-amber-400/60 object-cover shrink-0"
                                alt="Avatar"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-white truncate leading-tight">{user?.name}</p>
                                <p className="text-[10px] font-black uppercase tracking-tighter text-amber-400">Superadmin</p>
                            </div>
                            <button onClick={handleLogout} className="text-slate-500 hover:text-rose-400 transition-colors shrink-0" title="Cerrar sesión">
                                <LogOut size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* ── Mobile/Tablet wrapper ── */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Mobile top header */}
                <header className="lg:hidden sticky top-0 z-30 bg-slate-950 text-white shadow-lg">
                    <div className="flex items-center justify-between h-14 px-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 bg-amber-400 rounded-md flex items-center justify-center">
                                <Shield size={14} className="text-slate-950" />
                            </div>
                            <span className="font-bold text-sm text-white">{currentTitle}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <NavLink
                                to="/dashboard"
                                className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors text-xs px-2 py-1.5 rounded-lg hover:bg-slate-800"
                            >
                                <ChevronLeft size={14} />
                                App
                            </NavLink>
                            <button
                                onClick={() => setDrawerOpen(true)}
                                className="text-slate-300 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
                                aria-label="Abrir menú"
                            >
                                <MoreHorizontal size={20} />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main content */}
                <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">
                    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                        <Outlet />
                    </div>
                </main>

                {/* ── Mobile bottom nav (4 primary + more) ── */}
                <nav
                    className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-950 border-t border-slate-800/80 safe-area-bottom"
                    aria-label="Navegación principal"
                >
                    <div className="flex items-stretch h-16">
                        {primaryNavItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={'end' in item ? Boolean(item.end) : undefined}
                                className={({ isActive }) =>
                                    `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold tracking-wide transition-colors ${
                                        isActive ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-amber-400/15' : ''}`}>
                                            <item.icon size={20} />
                                        </div>
                                        <span>{item.label}</span>
                                    </>
                                )}
                            </NavLink>
                        ))}

                        {/* More button */}
                        <button
                            onClick={() => setDrawerOpen(true)}
                            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold tracking-wide transition-colors ${
                                drawerOpen ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                            }`}
                            aria-label="Más opciones"
                        >
                            <div className={`relative p-1.5 rounded-xl transition-colors ${drawerOpen ? 'bg-amber-400/15' : ''}`}>
                                <MoreHorizontal size={20} />
                                {usageSummary && usageSummary.percentage >= 70 && (
                                    <span className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full border border-slate-950 ${
                                        usageSummary.percentage >= 90 ? 'bg-rose-500' : 'bg-amber-400'
                                    }`} />
                                )}
                            </div>
                            <span>Más</span>
                        </button>
                    </div>
                </nav>
            </div>

            {/* ── Mobile Drawer (secondary nav) ── */}
            {drawerOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                        onClick={() => setDrawerOpen(false)}
                        aria-hidden="true"
                    />
                    {/* Drawer panel */}
                    <div
                        className="fixed bottom-0 inset-x-0 z-50 bg-slate-950 rounded-t-2xl shadow-2xl lg:hidden max-h-[85vh] flex flex-col"
                        role="dialog"
                        aria-label="Menú de navegación"
                        aria-modal="true"
                    >
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-1 shrink-0">
                            <div className="w-10 h-1 rounded-full bg-slate-700" />
                        </div>

                        {/* Drawer header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <img
                                    src={avatarUrl(user?.name ?? 'Admin', user?.avatar)}
                                    className="w-9 h-9 rounded-full ring-2 ring-amber-400/60 object-cover"
                                    alt="Avatar"
                                />
                                <div>
                                    <p className="text-sm font-bold text-white leading-tight">{user?.name}</p>
                                    <p className="text-[10px] font-black uppercase tracking-tighter text-amber-400">Superadmin</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDrawerOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors p-2 rounded-xl hover:bg-slate-800"
                                aria-label="Cerrar menú"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer nav items */}
                        <div className="overflow-y-auto flex-1 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 px-2 mb-2">
                                Gestión
                            </p>
                            <div className="space-y-0.5">
                                {secondaryNavItems.map((item) => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        className={({ isActive }) =>
                                            `flex items-center gap-4 px-3 py-3.5 rounded-xl transition-colors ${
                                                isActive
                                                    ? 'bg-amber-400 text-slate-950 font-bold'
                                                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                            }`
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <item.icon size={20} className="shrink-0" />
                                                <span className="flex-1 text-base font-semibold">{item.label}</span>
                                                {item.to === '/admin/football-sync' && usageSummary && (
                                                    <SyncBadge summary={usageSummary} />
                                                )}
                                                {isActive && <ChevronRight size={16} className="shrink-0 opacity-60" />}
                                            </>
                                        )}
                                    </NavLink>
                                ))}
                            </div>

                            <div className="h-px bg-slate-800 my-3" />

                            {/* Logout */}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-4 px-3 py-3.5 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                                <LogOut size={20} className="shrink-0" />
                                <span className="text-base font-semibold">Cerrar sesión</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AdminLayout;
