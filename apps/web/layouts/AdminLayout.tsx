import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
    BarChart3, Users, Trophy, Swords, CreditCard, Layers,
    Settings, LogOut, Shield, X, Target, ArrowLeft, RefreshCw,
    Sparkles, Coins, ChevronLeft, ChevronRight, MoreHorizontal,
    PanelLeftClose, PanelLeftOpen, Bell, Mail, MessageCircle, TestTube, Building2, Sticker,
    ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { useFootballSyncStore } from '../stores/football-sync.store';

type NavLinkConfig = {
    to: string;
    label: string;
    icon: LucideIcon;
    end?: boolean;
    syncBadge?: boolean;
};

type NavGroupConfig = {
    id: string;
    label: string;
    icon: LucideIcon;
    items: NavLinkConfig[];
};

const primaryNavItems: NavLinkConfig[] = [
    { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
    { to: '/admin/users', label: 'Usuarios', icon: Users },
    { to: '/admin/leagues', label: 'Pollas', icon: Trophy },
    { to: '/admin/tournaments', label: 'Torneos', icon: Trophy },
    { to: '/admin/matches', label: 'Partidos', icon: Swords },
];

/** Gestión agrupada: menos ítems en raíz, sub-rutas accesibles desde hubs (p. ej. Football Sync). */
const managementGroups: NavGroupConfig[] = [
    {
        id: 'commercial',
        label: 'Comercial',
        icon: CreditCard,
        items: [
            { to: '/admin/plans', label: 'Planes', icon: CreditCard },
            { to: '/admin/affiliations', label: 'Afiliaciones', icon: Layers },
            { to: '/admin/payments', label: 'Pagos', icon: Coins },
        ],
    },
    {
        id: 'data',
        label: 'Datos y sync',
        icon: RefreshCw,
        items: [
            { to: '/admin/predictions', label: 'Pronósticos', icon: Target },
            { to: '/admin/ai-usage', label: 'Consultas IA', icon: Sparkles },
            { to: '/admin/football-sync', label: 'Football Sync', icon: RefreshCw, syncBadge: true },
        ],
    },
    {
        id: 'comms',
        label: 'Comunicaciones',
        icon: Bell,
        items: [
            { to: '/admin/automation', label: 'Automatización', icon: Bell },
            { to: '/admin/automation/sticker-album', label: 'Álbum stickers', icon: Sticker },
            { to: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle },
            { to: '/admin/email-providers', label: 'Correo (SMTP)', icon: Mail },
            { to: '/admin/email-logs', label: 'Logs de correo', icon: Mail },
            { to: '/admin/email-testing', label: 'Probar correo', icon: TestTube },
        ],
    },
    {
        id: 'platform',
        label: 'Plataforma',
        icon: Building2,
        items: [
            { to: '/admin/tenants', label: 'Tenants B2B', icon: Building2 },
            { to: '/admin/settings', label: 'Sistema', icon: Settings },
        ],
    },
];

const sectionTitles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/users': 'Usuarios',
    '/admin/leagues': 'Pollas',
    '/admin/tournaments': 'Torneos',
    '/admin/matches': 'Partidos',
    '/admin/plans': 'Planes',
    '/admin/affiliations': 'Afiliaciones',
    '/admin/predictions': 'Pronósticos',
    '/admin/payments': 'Pagos',
    '/admin/ai-usage': 'Consultas IA',
    '/admin/football-sync': 'Football Sync',
    '/admin/football-sync/plan': 'Plan de Sync',
    '/admin/football-sync/settings': 'Sync Auto-Adaptable',
    '/admin/football-sync/config': 'Config Football Sync',
    '/admin/football-sync/history': 'Historial Sync',
    '/admin/football-sync/alerts': 'Alertas Sync',
    '/admin/football-sync/stats': 'Estadísticas Sync',
    '/admin/football-sync/api-logs': 'Logs API-Football',
    '/admin/automation': 'Automatización',
    '/admin/automation/sticker-album': 'Álbum de stickers',
    '/admin/whatsapp': 'WhatsApp Grupos',
    '/admin/email-providers': 'Correo (SMTP)',
    '/admin/email-logs': 'Logs de correo',
    '/admin/email-testing': 'Probar correo',
    '/admin/tenants': 'Tenants B2B',
    '/admin/settings': 'Sistema',
};

function sidebarLink(isActive: boolean, collapsed: boolean, nested = false) {
    const base =
        'group relative flex items-center gap-3 rounded-xl transition-all duration-150 font-semibold text-sm';
    const size = collapsed
        ? 'px-3 py-3 justify-center'
        : nested
            ? 'pl-9 pr-3 py-2 text-[13px]'
            : 'px-3 py-2.5';
    const color = isActive
        ? 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/30'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/70';
    return `${base} ${size} ${color}`;
}

function isPathActive(pathname: string, to: string, end?: boolean): boolean {
    if (end) return pathname === to;
    if (pathname === to) return true;
    if (to === '/admin/football-sync') {
        return pathname.startsWith('/admin/football-sync');
    }
    if (to === '/admin/automation') {
        return pathname === '/admin/automation';
    }
    return pathname.startsWith(`${to}/`);
}

function resolveGroupIdForPath(pathname: string): string | null {
    for (const group of managementGroups) {
        if (group.items.some((item) => isPathActive(pathname, item.to, item.end))) {
            return group.id;
        }
    }
    if (pathname.startsWith('/admin/football-sync')) return 'data';
    if (pathname.startsWith('/admin/automation')) return 'comms';
    if (pathname.startsWith('/admin/email')) return 'comms';
    if (pathname.startsWith('/admin/tenants')) return 'platform';
    return null;
}

function isGroupActive(pathname: string, group: NavGroupConfig): boolean {
    return group.items.some((item) => isPathActive(pathname, item.to, item.end));
}

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

interface SidebarLinkProps {
    item: NavLinkConfig;
    collapsed: boolean;
    nested?: boolean;
    usageSummary: { percentage: number; used: number; limit: number } | null;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ item, collapsed, nested, usageSummary }) => (
    <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) => sidebarLink(isActive, collapsed, nested)}
        title={collapsed ? item.label : undefined}
    >
        <item.icon size={nested ? 16 : 18} className="shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && item.syncBadge && usageSummary && (
            <SyncBadge summary={usageSummary} />
        )}
        {collapsed && item.syncBadge && usageSummary && usageSummary.percentage >= 70 && (
            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                usageSummary.percentage >= 90 ? 'bg-rose-500' : 'bg-amber-400'
            }`} />
        )}
        {collapsed && (
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
                {item.label}
            </span>
        )}
    </NavLink>
);

interface SidebarGroupProps {
    group: NavGroupConfig;
    collapsed: boolean;
    expanded: boolean;
    onToggle: () => void;
    pathname: string;
    usageSummary: { percentage: number; used: number; limit: number } | null;
}

const SidebarGroup: React.FC<SidebarGroupProps> = ({
    group,
    collapsed,
    expanded,
    onToggle,
    pathname,
    usageSummary,
}) => {
    const active = isGroupActive(pathname, group);

    if (collapsed) {
        return (
            <>
                {group.items.map((item) => (
                    <SidebarLink
                        key={item.to}
                        item={item}
                        collapsed
                        usageSummary={usageSummary}
                    />
                ))}
            </>
        );
    }

    return (
        <div className="space-y-0.5">
            <button
                type="button"
                onClick={onToggle}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                        ? 'bg-slate-800/80 text-white'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
                aria-expanded={expanded}
            >
                <group.icon size={18} className="shrink-0" />
                <span className="flex-1 truncate text-left">{group.label}</span>
                {group.id === 'data' && usageSummary && usageSummary.percentage >= 70 && (
                    <span className={`h-2 w-2 shrink-0 rounded-full ${
                        usageSummary.percentage >= 90 ? 'bg-rose-500' : 'bg-amber-400'
                    }`} />
                )}
                <ChevronDown
                    size={16}
                    className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
            </button>
            {expanded && (
                <div className="space-y-0.5 pb-1">
                    {group.items.map((item) => (
                        <SidebarLink
                            key={item.to}
                            item={item}
                            collapsed={false}
                            nested
                            usageSummary={usageSummary}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

function avatarUrl(name: string, avatar?: string | null) {
    if (avatar) return avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f59e0b&color=000&size=72`;
}

const AdminLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, isSuperAdmin, checkAuth, sessionChecked } = useAuthStore();
    const { usageSummary, fetchUsageSummary } = useFootballSyncStore();

    const [collapsed, setCollapsed] = React.useState(false);
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(() => {
        const active = resolveGroupIdForPath(window.location.pathname);
        return new Set(active ? [active] : ['commercial']);
    });
    const hasStoredToken = Boolean(localStorage.getItem('token'));

    React.useEffect(() => {
        fetchUsageSummary();
        const id = window.setInterval(fetchUsageSummary, 60_000);
        return () => window.clearInterval(id);
    }, [fetchUsageSummary]);

    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        void checkAuth().then((ok) => {
            if (!ok) { navigate('/login'); return; }
            if (!useAuthStore.getState().isSuperAdmin()) navigate('/dashboard');
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, checkAuth]);

    React.useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

    React.useEffect(() => {
        const activeGroup = resolveGroupIdForPath(location.pathname);
        if (!activeGroup) return;
        setExpandedGroups((prev) => {
            if (prev.has(activeGroup)) return prev;
            return new Set([...prev, activeGroup]);
        });
    }, [location.pathname]);

    const handleLogout = () => { logout(); navigate('/'); };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const currentTitle = React.useMemo(() => {
        const exact = sectionTitles[location.pathname];
        if (exact) return exact;
        const match = Object.entries(sectionTitles)
            .filter(([k]) => k !== '/admin')
            .sort(([a], [b]) => b.length - a.length)
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

                <div className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
                    <NavLink
                        to="/dashboard"
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800/70 transition-colors mb-2 ${collapsed ? 'justify-center' : ''}`}
                        title={collapsed ? 'Volver al App' : undefined}
                    >
                        <ArrowLeft size={16} className="shrink-0" />
                        {!collapsed && <span className="text-xs">Volver al App</span>}
                    </NavLink>

                    <div className="h-px bg-slate-800/60 mx-1 mb-2" />

                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-1 ${collapsed ? 'hidden' : 'px-3'}`}>
                        Principal
                    </p>
                    {primaryNavItems.map((item) => (
                        <SidebarLink key={item.to} item={item} collapsed={collapsed} usageSummary={usageSummary} />
                    ))}

                    <div className="h-px bg-slate-800/60 mx-1 my-2" />

                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-1 ${collapsed ? 'hidden' : 'px-3'}`}>
                        Gestión
                    </p>
                    {managementGroups.map((group) => (
                        <SidebarGroup
                            key={group.id}
                            group={group}
                            collapsed={collapsed}
                            expanded={expandedGroups.has(group.id)}
                            onToggle={() => toggleGroup(group.id)}
                            pathname={location.pathname}
                            usageSummary={usageSummary}
                        />
                    ))}
                </div>

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

            <div className="flex-1 flex flex-col min-w-0">
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

                <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">
                    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                        <Outlet />
                    </div>
                </main>

                <nav
                    className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-950 border-t border-slate-800/80 safe-area-bottom"
                    aria-label="Navegación principal"
                >
                    <div className="flex items-stretch h-16">
                        {primaryNavItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
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

            {drawerOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                        onClick={() => setDrawerOpen(false)}
                        aria-hidden="true"
                    />
                    <div
                        className="fixed bottom-0 inset-x-0 z-50 bg-slate-950 rounded-t-2xl shadow-2xl lg:hidden max-h-[85vh] flex flex-col"
                        role="dialog"
                        aria-label="Menú de navegación"
                        aria-modal="true"
                    >
                        <div className="flex justify-center pt-3 pb-1 shrink-0">
                            <div className="w-10 h-1 rounded-full bg-slate-700" />
                        </div>

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

                        <div className="overflow-y-auto flex-1 px-4 py-3">
                            {managementGroups.map((group) => (
                                <div key={group.id} className="mb-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 px-2 mb-2">
                                        {group.label}
                                    </p>
                                    <div className="space-y-0.5">
                                        {group.items.map((item) => (
                                            <NavLink
                                                key={item.to}
                                                to={item.to}
                                                end={item.end}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-4 px-3 py-3 rounded-xl transition-colors ${
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
                                                        {item.syncBadge && usageSummary && (
                                                            <SyncBadge summary={usageSummary} />
                                                        )}
                                                        {isActive && <ChevronRight size={16} className="shrink-0 opacity-60" />}
                                                    </>
                                                )}
                                            </NavLink>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="h-px bg-slate-800 my-3" />

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
