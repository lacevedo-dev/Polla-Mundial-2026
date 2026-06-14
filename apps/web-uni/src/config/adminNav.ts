import {
    Shield, Activity, Calculator, Users, PlusCircle, ShieldCheck, Settings,
} from 'lucide-react';

export const STAFF_ADMIN_PATHS = [
    '/admin/participation',
    '/admin/matches',
    '/admin/members',
] as const;

export const ADMIN_NAV_ITEMS = [
    { path: '/admin', label: 'Panel Admin', icon: Shield },
    { path: '/admin/participation', label: 'Participación', icon: Activity },
    { path: '/admin/matches', label: 'Partidos y puntajes', icon: Calculator },
    { path: '/admin/members', label: 'Gestión de usuarios', icon: Users },
    { path: '/admin/pollas', label: 'Gestionar Pollas', icon: PlusCircle },
    { path: '/admin/roles', label: 'Roles y Permisos', icon: ShieldCheck },
    { path: '/admin/settings', label: 'Configuración', icon: Settings },
] as const;

export function getAdminNavItems(isStaff: boolean) {
    if (!isStaff) return [...ADMIN_NAV_ITEMS];
    return ADMIN_NAV_ITEMS.filter((item) =>
        (STAFF_ADMIN_PATHS as readonly string[]).includes(item.path),
    );
}

export const ADMIN_QUICK_ACTIONS = [
    {
        label: 'Seguimiento de participación',
        desc: 'Quién pronostica vs. usuarios inscritos',
        icon: Activity,
        link: '/admin/participation',
        color: 'text-violet-600',
        bg: 'bg-violet-50',
    },
    {
        label: 'Partidos y puntajes',
        desc: 'Revisar sync y recalcular puntos si hace falta',
        icon: Calculator,
        link: '/admin/matches',
        color: 'text-lime-700',
        bg: 'bg-lime-50',
    },
    {
        label: 'Gestionar miembros',
        desc: 'Ver, invitar y administrar usuarios',
        icon: Users,
        link: '/admin/members',
        color: 'text-sky-600',
        bg: 'bg-sky-50',
    },
    {
        label: 'Gestionar pollas',
        desc: 'Crear, editar y asignar torneos',
        icon: PlusCircle,
        link: '/admin/pollas',
        color: 'text-amber-600',
        bg: '',
    },
] as const;
