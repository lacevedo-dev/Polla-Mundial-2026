import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ParticipationScheduler {
    private readonly logger = new Logger(ParticipationScheduler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationsService,
    ) {}

    /**
     * Expires obligations whose deadlineAt has passed.
     * Runs every 10 minutes.
     */
    @Cron('*/10 * * * *')
    async expireOverdueObligations() {
        const now = new Date();

        const result = await this.prisma.participationObligation.updateMany({
            where: {
                status: 'PENDING_PAYMENT',
                deadlineAt: { lt: now },
            },
            data: {
                status: 'EXPIRED',
                expiredAt: now,
            },
        });

        if (result.count > 0) {
            this.logger.log(`[Scheduler] Expired ${result.count} overdue obligations`);
        }
    }

    /**
     * Sends first payment reminder for obligations expiring within 24 hours.
     * Runs every hour.
     */
    @Cron('0 * * * *')
    async sendFirstReminders() {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const obligations = await this.prisma.participationObligation.findMany({
            where: {
                status: 'PENDING_PAYMENT',
                deadlineAt: { gte: now, lte: in24h },
                reminder30SentAt: null,
            },
            include: {
                user: { select: { id: true } },
                league: { select: { name: true } },
            },
        });

        for (const obligation of obligations) {
            try {
                const deadlineStr = new Date(obligation.deadlineAt).toLocaleString('es-CO');
                await this.notifications.createInAppNotification({
                    userId: obligation.userId,
                    type: 'PAYMENT_CONFIRMED',
                    title: '⏰ Tienes un pago pendiente',
                    body: `Recuerda pagar tu participación en ${obligation.league.name}. Cierra el ${deadlineStr} y podrías quedar fuera si no pagas.`,
                    data: {
                        obligationId: obligation.id,
                        leagueId: obligation.leagueId,
                        category: obligation.category,
                        amount: obligation.totalAmount,
                        currency: obligation.currency,
                        deadlineAt: obligation.deadlineAt.toISOString(),
                    },
                });

                await this.prisma.participationObligation.update({
                    where: { id: obligation.id },
                    data: { reminder30SentAt: now },
                });
            } catch (err) {
                this.logger.warn(`[Scheduler] Failed first reminder for ${obligation.id}: ${String(err)}`);
            }
        }

        if (obligations.length > 0) {
            this.logger.log(`[Scheduler] Sent first reminders for ${obligations.length} obligations`);
        }
    }

    /**
     * Sends final payment reminder for obligations expiring within 2 hours.
     * Runs every 15 minutes.
     */
    @Cron('*/15 * * * *')
    async sendFinalReminders() {
        const now = new Date();
        const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        const obligations = await this.prisma.participationObligation.findMany({
            where: {
                status: 'PENDING_PAYMENT',
                deadlineAt: { gte: now, lte: in2h },
                reminder10SentAt: null,
            },
            include: {
                user: { select: { id: true } },
                league: { select: { name: true } },
            },
        });

        for (const obligation of obligations) {
            try {
                const deadlineStr = new Date(obligation.deadlineAt).toLocaleString('es-CO');
                await this.notifications.createInAppNotification({
                    userId: obligation.userId,
                    type: 'PAYMENT_CONFIRMED',
                    title: '🚨 Último aviso: pago vence pronto',
                    body: `Tu participación en ${obligation.league.name} vence el ${deadlineStr}. Sin pago, no participarás en esta categoría.`,
                    data: {
                        obligationId: obligation.id,
                        leagueId: obligation.leagueId,
                        category: obligation.category,
                        amount: obligation.totalAmount,
                        currency: obligation.currency,
                        deadlineAt: obligation.deadlineAt.toISOString(),
                        isFinal: true,
                    },
                });

                await this.prisma.participationObligation.update({
                    where: { id: obligation.id },
                    data: { reminder10SentAt: now },
                });
            } catch (err) {
                this.logger.warn(`[Scheduler] Failed final reminder for ${obligation.id}: ${String(err)}`);
            }
        }

        if (obligations.length > 0) {
            this.logger.log(`[Scheduler] Sent final reminders for ${obligations.length} obligations`);
        }
    }
}
