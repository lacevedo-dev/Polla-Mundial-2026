import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { getAdminNavItems } from '../config/adminNav';

export function AdminSubNav() {
    const { pathname } = useLocation();
    const tenantRole = useAuthStore((s) => s.user?.tenantRole);
    const isStaff = tenantRole === 'STAFF';
    const items = getAdminNavItems(isStaff).filter((item) => item.path !== '/admin');

    return (
        <div className="mb-4 flex flex-wrap gap-2">
            {items.map((item) => {
                const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                            active
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                        }`}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </div>
    );
}
