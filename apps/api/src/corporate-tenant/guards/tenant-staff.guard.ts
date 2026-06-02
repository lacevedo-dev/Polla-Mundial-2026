import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Permite acceso a OWNER, ADMIN y STAFF.
 * STAFF tiene permisos reducidos: solo gestión de usuarios/miembros.
 */
@Injectable()
export class TenantStaffGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const tenantId: string | null = req.tenantId ?? req.params?.tenantId ?? null;
        const userId: string | undefined = req.user?.userId;

        if (!tenantId) throw new ForbiddenException('Contexto de tenant requerido');
        if (!userId) throw new ForbiddenException('Autenticación requerida');

        const member = await this.prisma.tenantMember.findUnique({
            where: { tenantId_userId: { tenantId, userId } },
            select: { status: true, role: true },
        });

        if (!member || member.status !== 'ACTIVE') {
            throw new ForbiddenException('No tienes acceso a esta organización');
        }

        const allowedRoles = ['OWNER', 'ADMIN', 'STAFF'];
        if (!allowedRoles.includes(member.role)) {
            const isSuperAdmin = req.user?.systemRole === 'SUPERADMIN';
            if (!isSuperAdmin) {
                throw new ForbiddenException('Se requieren permisos de staff en esta organización');
            }
        }

        req.tenantRole = member.role;
        return true;
    }
}
