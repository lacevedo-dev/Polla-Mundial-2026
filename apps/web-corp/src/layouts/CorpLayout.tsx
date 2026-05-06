import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Trophy, BarChart2, LogOut, Menu, X, Building2 } from 'lucide-react';
import { useTenantStore } from '../stores/tenant.store';
import { useAuthStore } from '../stores/auth.store';

const NAV_ITEMS = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/pollas', label: 'Pollas', icon: Trophy },
    { path: '/ranking', label: 'Ranking', icon: BarChart2 },
];

export function CorpLayout({ children }: { children: React.ReactNode }) {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const tenant = useTenantStore((s) => s.tenant);
    const { user, logout } = useAuthStore();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'Portal Corporativo';

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                        {tenant?.branding?.logoUrl ? (
                            <img src={tenant.branding.logoUrl} alt={orgName} className="h-8 w-auto object-contain" />
                        ) : (
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: 'var(--color-primary, #f59e0b)' }}
                            >
                                <Building2 size={16} className="text-white" />
                            </div>
                        )}
                        <span className="font-black text-slate-900 text-base truncate">{orgName}</span>
                    </div>

                    {/* Desktop nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
                            <Link
                                key={path}
                                to={path}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    pathname === path
                                        ? 'text-white'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                                style={pathname === path ? { backgroundColor: 'var(--color-primary, #f59e0b)' } : {}}
                            >
                                <Icon size={15} />
                                {label}
                            </Link>
                        ))}
                    </nav>

                    <div className="hidden md:flex items-center gap-3 ml-4">
                        <span className="text-sm text-slate-500 font-medium">{user?.name}</span>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-rose-600 transition-colors"
                        >
                            <LogOut size={15} />
                            Salir
                        </button>
                    </div>

                    {/* Mobile hamburger */}
                    <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
                        {menuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Mobile menu */}
                {menuOpen && (
                    <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
                        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
                            <Link
                                key={path}
                                to={path}
                                onClick={() => setMenuOpen(false)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold w-full ${
                                    pathname === path ? 'text-white' : 'text-slate-700'
                                }`}
                                style={pathname === path ? { backgroundColor: 'var(--color-primary, #f59e0b)' } : {}}
                            >
                                <Icon size={16} />
                                {label}
                            </Link>
                        ))}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-rose-600 w-full"
                        >
                            <LogOut size={16} />
                            Cerrar sesión
                        </button>
                    </div>
                )}
            </header>

            {/* Content */}
            <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">{children}</main>

            {/* Footer */}
            <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
                {orgName} · Powered by{' '}
                <a href="https://zonapronosticos.com" className="underline hover:text-slate-600" target="_blank" rel="noopener noreferrer">
                    ZonaPronosticos
                </a>
            </footer>
        </div>
    );
}
