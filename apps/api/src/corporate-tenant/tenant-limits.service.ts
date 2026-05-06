import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantLimitsService {
    constructor(private readonly prisma: PrismaService) {}

    async checkUserLimit(tenantId: string): Promise<void> {
        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id: tenantId },
            select: { maxUsers: true, name: true },
        });
        if (!tenant) return;

        const activeUsers = await this.prisma.tenantMember.count({
            where: { tenantId, status: 'ACTIVE' },
        });

        if (activeUsers >= tenant.maxUsers) {
            throw new HttpException(
                `Límite de usuarios alcanzado (${activeUsers}/${tenant.maxUsers}). Actualiza tu plan para agregar más usuarios.`,
                HttpStatus.PAYMENT_REQUIRED,
            );
        }
    }

    async checkLeagueLimit(tenantId: string): Promise<void> {
        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id: tenantId },
            select: { maxLeagues: true, name: true },
        });
        if (!tenant) return;

        const leagueCount = await this.prisma.league.count({
            where: { tenantId, status: { not: 'CANCELLED' } },
        });

        if (leagueCount >= tenant.maxLeagues) {
            throw new HttpException(
                `Límite de pollas alcanzado (${leagueCount}/${tenant.maxLeagues}). Actualiza tu plan para crear más pollas.`,
                HttpStatus.PAYMENT_REQUIRED,
            );
        }
    }

    async getTenantUsage(tenantId: string) {
        const [tenant, activeUsers, leagueCount] = await Promise.all([
            this.prisma.corporateTenant.findUnique({
                where: { id: tenantId },
                select: { maxUsers: true, maxLeagues: true },
            }),
            this.prisma.tenantMember.count({ where: { tenantId, status: 'ACTIVE' } }),
            this.prisma.league.count({ where: { tenantId, status: { not: 'CANCELLED' } } }),
        ]);

        if (!tenant) return null;

        return {
            users: { current: activeUsers, max: tenant.maxUsers },
            leagues: { current: leagueCount, max: tenant.maxLeagues },
        };
    }
}
