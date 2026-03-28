import { CreatePaymentDto } from './dto/payment.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { BoldService } from './bold.service';
import { Injectable, Logger } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { USER_STATUS } from '../users/user-status.constants';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly boldService: BoldService,
        private readonly stripeService: StripeService,
        private readonly ordersService: OrdersService,
        private readonly notifications: NotificationsService,
    ) { }

    async createPaymentSession(userId: string, createPaymentDto: CreatePaymentDto) {
        const payment = await this.prisma.payment.create({
            data: {
                userId,
                leagueId: createPaymentDto.leagueId,
                amount: createPaymentDto.amount,
                method: createPaymentDto.method,
                conceptId: createPaymentDto.conceptId,
                conceptType: createPaymentDto.conceptType,
                status: PaymentStatus.PENDING,
            },
        });

        const boldSession = await this.boldService.createPaymentLink({
            amount: createPaymentDto.amount,
            description: `Pago para liga: ${createPaymentDto.leagueId}`,
            orderId: payment.id,
            notificationUrl: `${process.env.APP_URL}/api/payments/webhook`,
            redirectUrl: `${process.env.APP_URL}/payments/status/${payment.id}`,
        });

        await this.prisma.payment.update({
            where: { id: payment.id },
            data: {},
        });

        return {
            paymentId: payment.id,
            status: payment.status,
            checkoutUrl: boldSession.link,
            message: 'Sesión de pago iniciada correctamente'
        };
    }

    async handleWebhook(payload: any, signature?: string) {
        if (signature && !this.boldService.verifyWebhook(payload, signature)) {
            throw new Error('Firma de webhook inválida');
        }

        const { order_id, status } = payload;

        const payment = await this.prisma.payment.findUnique({
            where: { id: order_id }
        });

        if (!payment) return { status: 'ignored' };

        let newStatus: any = 'PENDING';
        if (status === 'PAID' || status === 'COMPLETED') newStatus = 'CONFIRMED';
        if (status === 'REJECTED' || status === 'FAILED') newStatus = 'REJECTED';

        await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: newStatus as any }
        });

        if (newStatus === 'CONFIRMED') {
            await this.prisma.leagueMember.updateMany({
                where: { userId: payment.userId, leagueId: payment.leagueId },
                data: { status: 'ACTIVE' as any }
            });
        }

        return { received: true };
    }

    async getMyPayments(userId: string) {
        return this.prisma.payment.findMany({
            where: { userId },
            include: {
                league: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async createStripeCheckoutSession(
        userId: string,
        items: Array<{
            type: string;
            id: string;
            quantity: number;
            price: number;
            name: string;
            category?: string;
            obligationId?: string;
            leagueId?: string;
            referenceId?: string;
        }>,
        currency: string = 'USD',
        successUrl: string,
        cancelUrl: string,
    ) {
        try {
            const totalAmount = items.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0,
            );

            const order = await this.ordersService.createOrder(
                userId,
                totalAmount,
                currency,
                items.map(item => ({
                    type: item.type,
                    id: item.id,
                    quantity: item.quantity,
                    price: item.price,
                    name: item.name,
                    category: item.category,
                    obligationId: item.obligationId,
                    leagueId: item.leagueId,
                    referenceId: item.referenceId,
                })),
            );

            const stripeItems = items.map(item => ({
                name: item.name,
                amount: item.price,
                quantity: item.quantity,
                currency,
            }));

            const session = await this.stripeService.createCheckoutSession(
                stripeItems,
                successUrl,
                cancelUrl,
                {
                    orderId: order.id,
                    userId,
                },
            );

            await this.ordersService.updateOrderWithStripeSession(
                order.id,
                session.sessionId,
            );

            this.logger.log(
                `Stripe checkout session created for user ${userId}, order: ${order.id}`,
            );

            return {
                orderId: order.id,
                sessionId: session.sessionId,
                redirectUrl: session.redirectUrl,
                amount: totalAmount,
                currency,
            };
        } catch (error) {
            this.logger.error(
                `Failed to create Stripe checkout session for user ${userId}:`,
                error,
            );
            throw error;
        }
    }

    async registerManualPaymentIntent(
        userId: string,
        params: {
            leagueId: string;
            obligationIds: string[];
            method: string;
            totalAmount: number;
            currency: string;
        },
    ) {
        const { leagueId, obligationIds, method, totalAmount, currency } = params;

        const league = await this.prisma.league.findUnique({
            where: { id: leagueId },
            select: { name: true },
        });

        const leagueAdminMember = await this.prisma.leagueMember.findFirst({
            where: { leagueId, role: 'ADMIN' },
            select: { userId: true },
        });

        const user = await this.prisma.user.findFirst({
            where: { id: userId, status: USER_STATUS.ACTIVE },
            select: { name: true },
        });

        const amount = new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: currency ?? 'COP',
            minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(totalAmount);

        // Notify the user: confirmation that intent was registered
        await this.notifications.createInAppNotification({
            userId,
            type: 'PAYMENT_CONFIRMED',
            title: '💳 Intención de pago registrada',
            body: `Tu intención de pago por ${amount} en ${league?.name ?? 'la polla'} vía ${method} fue registrada. El administrador la confirmará pronto.`,
            data: { leagueId, obligationIds, method, totalAmount, currency },
        });

        // Notify the league admin if different from user
        if (leagueAdminMember?.userId && leagueAdminMember.userId !== userId) {
            await this.notifications.createInAppNotification({
                userId: leagueAdminMember.userId,
                type: 'PAYMENT_CONFIRMED',
                title: '💰 Pago manual pendiente de confirmación',
                body: `${user?.name ?? 'Un usuario'} indica que pagó ${amount} en ${league?.name ?? 'la polla'} vía ${method}. Confírmalo en la sección de pagos.`,
                data: { leagueId, userId, obligationIds, method, totalAmount, currency },
            });
        }

        this.logger.log(`Manual payment intent registered by user ${userId} for league ${leagueId} — method: ${method}, amount: ${totalAmount}`);
        return { registered: true, obligationIds };
    }
}
