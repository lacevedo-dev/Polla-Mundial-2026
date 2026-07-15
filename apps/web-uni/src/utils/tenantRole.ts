import type { AuthUser } from '../stores/auth.store';

export const STAFF_HOME = '/admin/members';

export function isStaffUser(user?: AuthUser | null): boolean {
    return user?.tenantRole === 'STAFF';
}

export function isTenantAdmin(user?: AuthUser | null): boolean {
    return user?.tenantRole === 'OWNER' || user?.tenantRole === 'ADMIN';
}

/** Operador de plataforma (systemRole), no rol de tenant. */
export function isSystemSuperAdmin(user?: AuthUser | null): boolean {
    return user?.systemRole === 'SUPERADMIN';
}

export function getHomeRoute(user?: AuthUser | null): string {
    return isStaffUser(user) ? STAFF_HOME : '/';
}

export function getPostLoginRoute(user: AuthUser, next?: string | null): string {
    if (user.mustChangePassword) return '/change-password';
    if (user.needsAvatarUpdate) return '/update-avatar';
    if (next && next.startsWith('/') && !next.startsWith('//')) {
        if (isStaffUser(user) && next !== STAFF_HOME && !next.startsWith(`${STAFF_HOME}/`)) {
            return STAFF_HOME;
        }
        return next;
    }
    return getHomeRoute(user);
}

export function tenantRoleLabel(role?: string): string {
    if (role === 'OWNER') return 'Propietario';
    if (role === 'ADMIN') return 'Administrador';
    if (role === 'STAFF') return 'Staff';
    return 'Participante';
}
