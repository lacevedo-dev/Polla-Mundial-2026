import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ParticipationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminPaymentsService {
    private readonly logger = new Logger(AdminPaymentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) {}

    async getObligations(params: {
        page: number;
        limit: number;
        leagueId?: string;
        userId?: string;
        status?: ParticipationStatus;
        category?: string;
    }) {
        const { page, limit, leagueId, userId, status, category } = params;
        const skip = (page - 1) * limit;

        const where: any = {
            ...(leagueId && { leagueId }),
            ...(userId && { userId }),
            ...(status && { status }),
            ...(category && { category }),
        };

        const [data, total] = await Promise.all([
            this.prisma.participationObligation.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, name: true, username: true, avatar: true, email: true } },
                    league: { select: { id: true, name: true } },
                    match: { select: { id: true } },
                },
            }),
            this.prisma.participationObligation.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    async getObligationStats(leagueId?: string) {
        const where: any = leagueId ? { leagueId } : {};

        const [pendingCount, paidCount, expiredCount, cancelledCount, pendingAmount] =
            await Promise.all([
                this.prisma.participationObligation.count({ where: { ...where, status: 'PENDING_PAYMENT' } }),
                this.prisma.participationObligation.count({ where: { ...where, status: 'PAID' } }),
                this.prisma.participationObligation.count({ where: { ...where, status: 'EXPIRED' } }),
                this.prisma.participationObligation.count({ where: { ...where, status: 'CANCELLED' } }),
                this.prisma.participationObligation.aggregate({
                    where: { ...where, status: 'PENDING_PAYMENT' },
                    _sum: { totalAmount: true },
                }),
            ]);

        return {
            pendingCount,
            paidCount,
            expiredCount,
            cancelledCount,
            pendingAmount: pendingAmount._sum.totalAmount ?? 0,
        };
    }

    async sendPaymentReminder(obligationId: string) {
        const obligation = await this.prisma.participationObligation.findUnique({
            where: { id: obligationId },
            include: {
                user: { select: { id: true, name: true } },
                league: { select: { name: true } },
            },
        });

        if (!obligation) {
            throw new NotFoundException(`Obligation ${obligationId} not found`);
        }

        if (obligation.status !== 'PENDING_PAYMENT') {
            return { sent: false, reason: 'Obligation is not pending payment' };
        }

        const deadlineStr = obligation.deadlineAt
            ? new Date(obligation.deadlineAt).toLocaleString('es-CO')
            : 'pronto';

        await this.notifications.createInAppNotification({
            userId: obligation.userId,
            type: 'PAYMENT_CONFIRMED',
            title: '💳 Pago pendiente en tu polla',
            body: `Tienes un pago pendiente de ${this._formatCurrency(obligation.totalAmount, obligation.currency)} en ${obligation.league.name}. Cierra antes del ${deadlineStr}.`,
            data: {
                obligationId: obligation.id,
                leagueId: obligation.leagueId,
                category: obligation.category,
                amount: obligation.totalAmount,
                currency: obligation.currency,
                deadlineAt: obligation.deadlineAt?.toISOString(),
            },
        });

        await this.prisma.participationObligation.update({
            where: { id: obligationId },
            data: { reminder30SentAt: new Date() },
        });

        this.logger.log(`Payment reminder sent for obligation ${obligationId} to user ${obligation.userId}`);
        return { sent: true, userId: obligation.userId };
    }

    async sendBulkReminders(leagueId?: string) {
        const where: any = {
            status: 'PENDING_PAYMENT',
            deadlineAt: { gte: new Date() },
            reminder30SentAt: null,
            ...(leagueId && { leagueId }),
        };

        const obligations = await this.prisma.participationObligation.findMany({
            where,
            include: {
                user: { select: { id: true, name: true } },
                league: { select: { name: true } },
            },
        });

        let sent = 0;
        for (const obligation of obligations) {
            try {
                await this.sendPaymentReminder(obligation.id);
                sent++;
            } catch (err) {
                this.logger.warn(`Failed to send reminder for obligation ${obligation.id}: ${String(err)}`);
            }
        }

        return { sent, total: obligations.length };
    }

    async expireOverdueObligations() {
        const now = new Date();

        const expired = await this.prisma.participationObligation.updateMany({
            where: {
                status: 'PENDING_PAYMENT',
                deadlineAt: { lt: now },
            },
            data: {
                status: 'EXPIRED',
                expiredAt: now,
            },
        });

        if (expired.count > 0) {
            this.logger.log(`Expired ${expired.count} overdue obligations`);
        }

        return { expired: expired.count };
    }

    private _formatCurrency(amount: number, currency: string): string {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: currency ?? 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    }
}
