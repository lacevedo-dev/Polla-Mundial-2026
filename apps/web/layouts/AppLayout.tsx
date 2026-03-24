import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Trophy, ListOrdered, Palette, ArrowLeftRight, Menu, X, HelpCircle, LogOut, Shield } from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { useConfigStore } from '../stores/config.store';
import { resolveDevelopmentSurfaceFlags } from '../runtime-flags';

const primaryNavItems = [
    { to: '/dashboard', label: 'Inicio', icon: Home },
    { to: '/my-leagues', label: 'Mis Pollas', icon: Trophy },
    { to: '/ranking', label: 'Ranking', icon: ListOrdered },
    { to: '/help', label: 'Ayuda', icon: HelpCircle },
];

const developmentNavItems = [
    { to: '/design-system', label: 'Sistema', icon: Palette },
    { to: '/before-after', label: 'Antes/Después', icon: ArrowLeftRight },
];

const runtimeFlags = resolveDevelopmentSurfaceFlags({
    mode: import.meta.env.MODE,
    enableDevRoutes: import.meta.env.VITE_ENABLE_DEV_ROUTES,
});

const navItems = runtimeFlags.includeDevRoutes
    ? [...primaryNavItems, ...developmentNavItems]
    : primaryNavItems;

const AppLayout: React.FC = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const navigate = useNavigate();
    const { user, logout, isSuperAdmin, checkAuth, sessionChecked } = useAuthStore();
    const fetchPlanConfig = useConfigStore((state) => state.fetchPlanConfig);
    const hasStoredToken = Boolean(localStorage.getItem('token'));

    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        void checkAuth().then((isAuthenticated) => {
            if (!isAuthenticated) {
                navigate('/login');
            }
        });
    }, [navigate, checkAuth]);

    React.useEffect(() => {
        void fetchPlanConfig();
    }, [fetchPlanConfig]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    if (hasStoredToken && !sessionChecked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
                <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-lime-500" />
                    <p className="mt-4 text-sm font-semibold text-slate-700">Validando tu sesión…</p>
                    <p className="mt-1 text-xs text-slate-400">Estamos confirmando tus credenciales guardadas.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-black text-white h-screen sticky top-0 shadow-xl z-20">
                <div className="p-6">
                    <NavLink to="/dashboard" className="flex items-center gap-3 mb-8 cursor-pointer">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-brand text-black text-2xl font-black">26</div>
                        <h1 className="font-brand text-lg tracking-tight">POLLA<span className="text-lime-400">2026</span></h1>
                    </NavLink>
                    <nav className="space-y-2">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                        ? 'bg-lime-400 text-black font-bold'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                                    }`
                                }
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>
                <div className="mt-auto p-6 border-t border-slate-800">
                    {isSuperAdmin() && (
                        <NavLink
                            to="/admin"
                            className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-all text-sm font-bold"
                        >
                            <Shield size={16} />
                            Panel Admin
                        </NavLink>
                    )}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=random`} className="w-10 h-10 rounded-full ring-2 ring-lime-400 object-cover" alt="Avatar" />
                            <div>
                                <p className="text-sm font-bold truncate max-w-[120px]">{user?.name || 'Cargando...'}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <p className="text-xs text-slate-500 uppercase tracking-tighter">{user?.systemRole === 'SUPERADMIN' ? 'Super Admin' : user?.role === 'ADMIN' ? 'Administrador' : 'Participante'}</p>
                                    {user?.plan && (
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                                            user.plan === 'DIAMOND'
                                                ? 'bg-purple-500/20 text-purple-300'
                                                : user.plan === 'GOLD'
                                                ? 'bg-amber-500/20 text-amber-300'
                                                : 'bg-slate-700 text-slate-400'
                                        }`}>
                                            {user.plan}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 transition-colors">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="md:hidden flex items-center justify-between p-4 bg-black text-white sticky top-0 z-30 shadow-md">
                <NavLink to="/dashboard" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white rounded flex items-center justify-center font-brand text-black text-xl font-black">26</div>
                    <span className="font-brand text-sm">POLLA<span className="text-lime-400">2026</span></span>
                </NavLink>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-950 z-50 md:hidden flex flex-col"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Menú de navegación"
                >
                    {/* Top bar: logo + close */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
                        <NavLink to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white rounded flex items-center justify-center font-brand text-black text-xl font-black">26</div>
                            <span className="font-brand text-sm text-white">POLLA<span className="text-lime-400">2026</span></span>
                        </NavLink>
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            aria-label="Cerrar menú"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* User profile card */}
                    <div className="px-5 py-4 border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-3">
                            <img
                                src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=random`}
                                className="w-12 h-12 rounded-full ring-2 ring-lime-400 object-cover shrink-0"
                                alt={user?.name || 'Avatar de usuario'}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-bold truncate">{user?.name || 'Cargando...'}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs text-slate-400">
                                        {user?.systemRole === 'SUPERADMIN' ? 'Super Admin' : user?.role === 'ADMIN' ? 'Administrador' : 'Participante'}
                                    </span>
                                    {user?.plan && (
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                                            user.plan === 'DIAMOND' ? 'bg-purple-500/20 text-purple-300' :
                                            user.plan === 'GOLD'    ? 'bg-amber-500/20 text-amber-300' :
                                                                       'bg-slate-700 text-slate-400'
                                        }`}>
                                            {user.plan}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors shrink-0"
                                aria-label="Cerrar sesión"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1" role="navigation" aria-label="Navegación principal">
                        {isSuperAdmin() && (
                            <NavLink
                                to="/admin"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-400/10 text-amber-400 font-bold text-sm hover:bg-amber-400/20 transition-colors"
                                aria-label="Panel de administración"
                            >
                                <Shield size={20} />
                                <span>Panel Admin</span>
                            </NavLink>
                        )}
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                                        isActive
                                            ? 'bg-lime-400 text-slate-950'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`
                                }
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* Bottom logout row */}
                    <div className="px-4 pb-6 pt-3 border-t border-slate-800 shrink-0">
                        <button
                            onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-rose-400 hover:bg-rose-400/10 transition-colors"
                            aria-label="Cerrar sesión"
                        >
                            <LogOut size={18} />
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
                <div className="max-w-6xl mx-auto p-4 md:p-8">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-30 shadow-lg">
                {navItems.slice(0, 4).map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-lime-600' : 'text-slate-400'
                            }`
                        }
                    >
                        <item.icon size={20} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
};

export default AppLayout;
