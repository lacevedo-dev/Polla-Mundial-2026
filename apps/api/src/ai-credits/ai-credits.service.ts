import { Injectable } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PLAN_CREDITS: Record<Plan, number> = {
    FREE: 3,
    GOLD: 30,
    DIAMOND: 100,
};

export interface ConsumeCreditsParams {
    userId: string;
    leagueId?: string;
    matchId?: string;
    feature: string;
    creditsUsed?: number;
    requestData?: any;
    responseData?: any;
    insightGenerated?: boolean;
    clientInfo?: string;
}

export interface CreditSummary {
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
    plan: Plan;
    lastResetAt: Date;
}

@Injectable()
export class AiCreditsService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Obtiene el resumen de créditos de un usuario
     */
    async getUserCreditSummary(userId: string): Promise<CreditSummary> {
        // Obtener el plan del usuario
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true },
        });

        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        // Buscar o crear el registro de créditos
        let credits = await this.prisma.userAiCredits.findUnique({
            where: { userId },
        });

        const totalCredits = PLAN_CREDITS[user.plan];

        // Si no existe, crear uno nuevo
        if (!credits) {
            credits = await this.prisma.userAiCredits.create({
                data: {
                    userId,
                    plan: user.plan,
                    totalCredits,
                    usedCredits: 0,
                },
            });
        }

        // Verificar si el plan cambió y actualizar
        if (credits.plan !== user.plan || credits.totalCredits !== totalCredits) {
            credits = await this.prisma.userAiCredits.update({
                where: { userId },
                data: {
                    plan: user.plan,
                    totalCredits,
                },
            });
        }

        return {
            totalCredits: credits.totalCredits,
            usedCredits: credits.usedCredits,
            remainingCredits: Math.max(0, credits.totalCredits - credits.usedCredits),
            plan: credits.plan,
            lastResetAt: credits.lastResetAt,
        };
    }

    /**
     * Consume créditos IA y registra la transacción
     */
    async consumeCredits(params: ConsumeCreditsParams): Promise<{ success: boolean; remainingCredits: number; error?: string }> {
        const { userId, leagueId, matchId, feature, creditsUsed = 1, requestData, responseData, insightGenerated = true, clientInfo } = params;

        try {
            // Obtener resumen actual
            const summary = await this.getUserCreditSummary(userId);

            // Verificar si tiene créditos disponibles
            if (summary.remainingCredits < creditsUsed) {
                return {
                    success: false,
                    remainingCredits: summary.remainingCredits,
                    error: `Créditos insuficientes. Tienes ${summary.remainingCredits} de ${summary.totalCredits} disponibles.`,
                };
            }

            // Crear el registro de uso en una transacción
            await this.prisma.$transaction(async (tx) => {
                // Registrar el uso
                await tx.aiUsageRecord.create({
                    data: {
                        userId,
                        leagueId,
                        matchId,
                        feature,
                        creditsUsed,
                        requestData: requestData ? JSON.stringify(requestData) : null,
                        responseData: responseData ? JSON.stringify(responseData) : null,
                        insightGenerated,
                        clientInfo,
                    },
                });

                // Actualizar el contador de créditos
                await tx.userAiCredits.update({
                    where: { userId },
                    data: {
                        usedCredits: {
                            increment: creditsUsed,
                        },
                    },
                });
            });

            return {
                success: true,
                remainingCredits: summary.remainingCredits - creditsUsed,
            };
        } catch (error) {
            console.error('Error al consumir créditos IA:', error);
            return {
                success: false,
                remainingCredits: 0,
                error: 'Error al procesar la solicitud',
            };
        }
    }

    /**
     * Resetea los créditos de un usuario (útil para cambio de plan o reset manual)
     */
    async resetUserCredits(userId: string): Promise<CreditSummary> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true },
        });

        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        const totalCredits = PLAN_CREDITS[user.plan];

        const credits = await this.prisma.userAiCredits.upsert({
            where: { userId },
            update: {
                usedCredits: 0,
                lastResetAt: new Date(),
                plan: user.plan,
                totalCredits,
            },
            create: {
                userId,
                plan: user.plan,
                totalCredits,
                usedCredits: 0,
            },
        });

        return {
            totalCredits: credits.totalCredits,
            usedCredits: credits.usedCredits,
            remainingCredits: credits.totalCredits,
            plan: credits.plan,
            lastResetAt: credits.lastResetAt,
        };
    }

    /**
     * Obtiene el historial de uso de créditos IA
     */
    async getUserUsageHistory(userId: string, limit = 50, offset = 0) {
        const [records, total] = await Promise.all([
            this.prisma.aiUsageRecord.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    feature: true,
                    creditsUsed: true,
                    insightGenerated: true,
                    createdAt: true,
                    leagueId: true,
                    matchId: true,
                },
            }),
            this.prisma.aiUsageRecord.count({
                where: { userId },
            }),
        ]);

        return {
            records,
            total,
            limit,
            offset,
        };
    }

    /**
     * Obtiene estadísticas globales de uso de IA (para admin)
     */
    async getGlobalUsageStats(startDate?: Date, endDate?: Date) {
        const where = startDate || endDate ? {
            createdAt: {
                ...(startDate && { gte: startDate }),
                ...(endDate && { lte: endDate }),
            },
        } : {};

        const [totalRecords, totalCreditsUsed, byFeature, byPlan] = await Promise.all([
            this.prisma.aiUsageRecord.count({ where }),
            this.prisma.aiUsageRecord.aggregate({
                where,
                _sum: { creditsUsed: true },
            }),
            this.prisma.aiUsageRecord.groupBy({
                by: ['feature'],
                where,
                _sum: { creditsUsed: true },
                _count: true,
            }),
            this.prisma.userAiCredits.groupBy({
                by: ['plan'],
                _sum: {
                    usedCredits: true,
                    totalCredits: true,
                },
                _count: true,
            }),
        ]);

        return {
            totalRecords,
            totalCreditsUsed: totalCreditsUsed._sum.creditsUsed || 0,
            byFeature,
            byPlan,
        };
    }

    /**
     * Obtiene todos los registros de uso de IA con filtros (para admin)
     */
    async getAllUsageRecords(
        filters: {
            userId?: string;
            leagueId?: string;
            feature?: string;
            startDate?: Date;
            endDate?: Date;
        } = {},
        limit = 100,
        offset = 0,
    ) {
        const where: any = {};

        if (filters.userId) where.userId = filters.userId;
        if (filters.leagueId) where.leagueId = filters.leagueId;
        if (filters.feature) where.feature = filters.feature;

        if (filters.startDate || filters.endDate) {
            where.createdAt = {
                ...(filters.startDate && { gte: filters.startDate }),
                ...(filters.endDate && { lte: filters.endDate }),
            };
        }

        const [records, total] = await Promise.all([
            this.prisma.aiUsageRecord.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            username: true,
                            plan: true,
                        },
                    },
                },
            }),
            this.prisma.aiUsageRecord.count({ where }),
        ]);

        return {
            records,
            total,
            limit,
            offset,
            filters,
        };
    }
}
