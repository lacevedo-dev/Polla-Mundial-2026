import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ParticipationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentReminderNotifier } from '../notifications/payment-reminder-notifier.service';

@Injectable()
export class AdminPaymentsService {
    private readonly logger = new Logger(AdminPaymentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly paymentReminderNotifier: PaymentReminderNotifier,
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
                user: { select: { id: true, name: true, phone: true, countryCode: true } },
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

        const title = '💳 Pago pendiente en tu polla';
        const body = `Tienes un pago pendiente de ${this._formatCurrency(obligation.totalAmount, obligation.currency)} en ${obligation.league.name}. Cierra antes del ${deadlineStr}.`;

        const delivery = await this.paymentReminderNotifier.deliver({
            userId: obligation.userId,
            userName: obligation.user.name,
            phone: obligation.user.phone,
            countryCode: obligation.user.countryCode,
            title,
            body,
            data: {
                obligationId: obligation.id,
                leagueId: obligation.leagueId,
                category: obligation.category,
                amount: obligation.totalAmount,
                currency: obligation.currency,
                deadlineAt: obligation.deadlineAt?.toISOString(),
            },
            leagueId: obligation.leagueId,
            dedupeSuffix: `admin:${obligation.id}`,
            trigger: '[Admin] manual payment reminder',
        });

        await this.prisma.participationObligation.update({
            where: { id: obligationId },
            data: { reminder30SentAt: new Date() },
        });

        this.logger.log(`Payment reminder sent for obligation ${obligationId} to user ${obligation.userId}`);
        return {
            sent: true,
            userId: obligation.userId,
            delivery,
        };
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

    async backfillPrincipalObligations(leagueId: string) {
        const league = await this.prisma.league.findUnique({
            where: { id: leagueId },
            select: {
                id: true,
                name: true,
                includeBaseFee: true,
                baseFee: true,
                currency: true,
            },
        });

        if (!league) {
            throw new NotFoundException('Liga no encontrada');
        }

        if (!league.includeBaseFee || !league.baseFee || league.baseFee <= 0) {
            return { created: 0, skipped: 0, reason: 'La liga no tiene cuota base configurada' };
        }

        const members = await this.prisma.leagueMember.findMany({
            where: {
                leagueId,
                status: { in: ['ACTIVE', 'PENDING_PAYMENT', 'PENDING'] },
            },
            select: { userId: true, status: true },
        });

        let created = 0;
        let skipped = 0;

        for (const member of members) {
            const hasPredictions = await this.prisma.prediction.findFirst({
                where: { leagueId, userId: member.userId },
                select: { id: true },
            });

            if (!hasPredictions) {
                skipped++;
                continue;
            }

            const existingObligation = await this.prisma.participationObligation.findFirst({
                where: {
                    userId: member.userId,
                    leagueId,
                    category: 'PRINCIPAL',
                    status: { in: ['PENDING_PAYMENT', 'PAID'] },
                },
                select: { id: true },
            });

            if (existingObligation) {
                skipped++;
                continue;
            }

            await this.prisma.participationObligation.create({
                data: {
                    userId: member.userId,
                    leagueId,
                    matchId: null,
                    category: 'PRINCIPAL',
                    referenceId: leagueId,
                    referenceLabel: league.name,
                    source: 'INVITATION',
                    unitAmount: league.baseFee,
                    multiplier: 1,
                    totalAmount: league.baseFee,
                    currency: league.currency,
                    deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    status: 'PENDING_PAYMENT',
                },
            });

            if (member.status === 'ACTIVE') {
                await this.prisma.leagueMember.update({
                    where: { userId_leagueId: { userId: member.userId, leagueId } },
                    data: { status: 'PENDING_PAYMENT' },
                });
            }

            created++;
        }

        this.logger.log(`[Backfill] League ${leagueId}: ${created} obligations created, ${skipped} skipped`);
        return { created, skipped };
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
