import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantMemberGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const tenantId: string | null = req.tenantId ?? req.params?.tenantId ?? null;
        const userId: string | undefined = req.user?.userId;

        if (!tenantId) return true;
        if (!userId) throw new ForbiddenException('Autenticación requerida');

        const member = await this.prisma.tenantMember.findUnique({
            where: { tenantId_userId: { tenantId, userId } },
            select: { status: true, role: true },
        });

        if (!member || member.status !== 'ACTIVE') {
            throw new ForbiddenException('No tienes acceso a esta organización');
        }

        req.tenantRole = member.role;
        return true;
    }
}
