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
    const { user, logout, isSuperAdmin } = useAuthStore();
    const fetchPlanConfig = useConfigStore((state) => state.fetchPlanConfig);

    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
        }
    }, [navigate]);

    React.useEffect(() => {
        void fetchPlanConfig();
    }, [fetchPlanConfig]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

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
                                <p className="text-xs text-slate-500 uppercase tracking-tighter">{user?.systemRole === 'SUPERADMIN' ? 'Super Admin' : user?.role === 'ADMIN' ? 'Administrador' : 'Participante'}</p>
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
                <div className="fixed inset-0 bg-black z-40 p-6 md:hidden overflow-y-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white rounded flex items-center justify-center font-brand text-black text-xl font-black">26</div>
                            <span className="font-brand text-xl text-white font-bold">POLLA<span className="text-lime-400">2026</span></span>
                        </div>
                        <button onClick={() => setIsMobileMenuOpen(false)} className="text-white"><X size={32} /></button>
                    </div>
                    <nav className="space-y-4">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive }) =>
                                    `w-full flex items-center gap-4 text-2xl font-bold py-4 border-b border-slate-800 ${isActive ? 'text-lime-400' : 'text-white'
                                    }`
                                }
                            >
                                <item.icon size={28} />
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-4 text-2xl font-bold py-4 border-b border-slate-800 text-rose-400"
                        >
                            <LogOut size={28} />
                            <span>Cerrar Sesión</span>
                        </button>
                    </nav>
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
