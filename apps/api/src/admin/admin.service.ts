import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeSystemConfigRecord, serializeSystemConfigValue } from '../system-config/system-config.util';

@Injectable()
export class AdminService {
    constructor(private readonly prisma: PrismaService) {}

    async getSystemStats() {
        const [totalUsers, totalLeagues, totalPredictions, totalPayments, planBreakdown, leagueStatusBreakdown, recentUsers] =
            await Promise.all([
                this.prisma.user.count(),
                this.prisma.league.count(),
                this.prisma.prediction.count(),
                this.prisma.payment.aggregate({ _sum: { amount: true } }),
                this.prisma.user.groupBy({
                    by: ['plan'],
                    _count: { _all: true },
                }),
                this.prisma.league.groupBy({
                    by: ['status'],
                    _count: { _all: true },
                }),
                this.prisma.user.findMany({
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, name: true, email: true, plan: true, createdAt: true },
                }),
            ]);

        return {
            totalUsers,
            totalLeagues,
            totalPredictions,
            totalRevenue: totalPayments._sum.amount ?? 0,
            planBreakdown,
            leagueStatusBreakdown,
            recentUsers,
        };
    }

    async getSystemConfig(key: string) {
        const record = await this.prisma.systemConfig.findUnique({ where: { key } });
        return normalizeSystemConfigRecord(record);
    }

    async setSystemConfig(key: string, value: any) {
        const record = await this.prisma.systemConfig.upsert({
            where: { key },
            create: { key, value: serializeSystemConfigValue(value) },
            update: { value: serializeSystemConfigValue(value) },
        });

        return normalizeSystemConfigRecord(record);
    }

    async getAllSystemConfigs() {
        const configs = await this.prisma.systemConfig.findMany();
        return configs.map((config) => normalizeSystemConfigRecord(config)!);
    }
}
