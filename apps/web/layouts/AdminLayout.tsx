import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    BarChart3, Users, Trophy, Swords, CreditCard, Layers,
    Settings, LogOut, Shield, Menu, X, Target, ArrowLeft, RefreshCw, Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';

const adminNavItems = [
    { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
    { to: '/admin/users', label: 'Usuarios', icon: Users },
    { to: '/admin/leagues', label: 'Pollas', icon: Trophy },
    { to: '/admin/matches', label: 'Partidos', icon: Swords },
    { to: '/admin/plans', label: 'Planes', icon: CreditCard },
    { to: '/admin/affiliations', label: 'Afiliaciones', icon: Layers },
    { to: '/admin/predictions', label: 'Pronósticos', icon: Target },
    { to: '/admin/ai-usage', label: 'Consultas IA', icon: Sparkles },
    { to: '/admin/football-sync', label: 'Football Sync', icon: RefreshCw },
    { to: '/admin/settings', label: 'Sistema', icon: Settings },
];

const AdminLayout: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout, isSuperAdmin } = useAuthStore();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        if (user && !isSuperAdmin()) {
            navigate('/dashboard');
        }
    }, [navigate, user, isSuperAdmin]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-100">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 bg-slate-950 text-white h-screen sticky top-0 shadow-xl z-20">
                <div className="p-6 flex-1 overflow-y-auto">
                    {/* Brand */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-amber-400 rounded-lg flex items-center justify-center">
                            <Shield size={20} className="text-slate-950" />
                        </div>
                        <div>
                            <h1 className="font-brand text-sm tracking-tight text-white">
                                POLLA<span className="text-amber-400">2026</span>
                            </h1>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">
                                Super Admin
                            </p>
                        </div>
                    </div>

                    {/* Back to App */}
                    <NavLink
                        to="/dashboard"
                        className="flex items-center gap-2 mb-6 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Volver al App
                    </NavLink>

                    {/* Navigation */}
                    <nav className="space-y-1">
                        {adminNavItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                className={({ isActive }) =>
                                    `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm ${
                                        isActive
                                            ? 'bg-amber-400 text-slate-950 font-bold'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`
                                }
                            >
                                <item.icon size={18} />
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                {/* User Footer */}
                <div className="p-6 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <img
                                src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Admin')}&background=f59e0b&color=000`}
                                className="w-9 h-9 rounded-full ring-2 ring-amber-400 object-cover flex-shrink-0"
                                alt="Avatar"
                            />
                            <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{user?.name}</p>
                                <p className="text-[10px] text-amber-400 uppercase tracking-tighter font-black">
                                    Superadmin
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="text-slate-400 hover:text-rose-400 transition-colors flex-shrink-0 ml-2"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="md:hidden flex items-center justify-between p-4 bg-slate-950 text-white sticky top-0 z-30 shadow-md">
                <div className="flex items-center gap-2">
                    <Shield size={18} className="text-amber-400" />
                    <span className="font-brand text-sm text-amber-400 font-bold">Admin Panel</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="text-white"
                >
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-slate-950 z-40 p-6 md:hidden overflow-y-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-2">
                            <Shield size={20} className="text-amber-400" />
                            <span className="font-brand text-xl text-amber-400 font-bold">Super Admin</span>
                        </div>
                        <button onClick={() => setIsMobileMenuOpen(false)} className="text-white">
                            <X size={28} />
                        </button>
                    </div>
                    <nav className="space-y-3">
                        <NavLink
                            to="/dashboard"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-3 text-slate-500 hover:text-slate-300 py-2"
                        >
                            <ArrowLeft size={18} />
                            <span className="text-sm">Volver al App</span>
                        </NavLink>
                        <div className="border-t border-slate-800 pt-3">
                            {adminNavItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={({ isActive }) =>
                                        `w-full flex items-center gap-4 text-xl font-bold py-4 border-b border-slate-800 ${
                                            isActive ? 'text-amber-400' : 'text-white'
                                        }`
                                    }
                                >
                                    <item.icon size={24} />
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-4 text-xl font-bold py-4 text-rose-400"
                        >
                            <LogOut size={24} />
                            <span>Cerrar Sesión</span>
                        </button>
                    </nav>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-8">
                <div className="max-w-7xl mx-auto p-4 md:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
