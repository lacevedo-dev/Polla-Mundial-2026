import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

export class CreateOrderDto {
  userId: string;
  amount: number;
  currency: string;
  items: Array<{
    type: string;
    id: string;
    quantity: number;
    price?: number;
    name?: string;
    category?: string;
    obligationId?: string;
    leagueId?: string;
    referenceId?: string;
  }>;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOrder(
    userId: string,
    amount: number,
    currency: string,
    items: Array<{
      type: string;
      id: string;
      quantity: number;
      price?: number;
      name?: string;
      category?: string;
      obligationId?: string;
      leagueId?: string;
      referenceId?: string;
    }>,
  ) {
    try {
      const order = await this.prisma.order.create({
        data: {
          userId,
          amount: parseFloat(amount.toFixed(2)),
          currency,
          items: items as any,
          status: OrderStatus.PENDING,
        },
      });

      this.logger.log(
        `Order created: ${order.id} for user ${userId}, amount: ${amount} ${currency}`,
      );

      return {
        id: order.id,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        createdAt: order.createdAt,
      };
    } catch (error) {
      this.logger.error(`Failed to create order for user ${userId}:`, error);
      throw error;
    }
  }

  async getOrders(userId: string, status?: OrderStatus) {
    try {
      const where: any = { userId };
      if (status) {
        where.status = status;
      }

      const orders = await this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          items: true,
          createdAt: true,
          updatedAt: true,
          stripeSessionId: true,
          stripePaymentIntentId: true,
        },
      });

      return orders;
    } catch (error) {
      this.logger.error(`Failed to fetch orders for user ${userId}:`, error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    try {
      const order = await this.prisma.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      });

      this.logger.log(`Order ${orderId} status updated to ${newStatus}`);

      return {
        id: order.id,
        status: order.status,
        updatedAt: order.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to update order ${orderId}:`, error);
      throw error;
    }
  }

  async getOrderByStripeSessionId(sessionId: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { stripeSessionId: sessionId },
      });

      if (!order) {
        this.logger.warn(`Order not found for Stripe session: ${sessionId}`);
        return null;
      }

      return order;
    } catch (error) {
      this.logger.error(
        `Failed to fetch order by Stripe session ${sessionId}:`,
        error,
      );
      throw error;
    }
  }

  async updateOrderWithStripeSession(
    orderId: string,
    stripeSessionId: string,
  ) {
    try {
      const order = await this.prisma.order.update({
        where: { id: orderId },
        data: { stripeSessionId },
      });

      this.logger.log(
        `Order ${orderId} updated with Stripe session: ${stripeSessionId}`,
      );

      return order;
    } catch (error) {
      this.logger.error(
        `Failed to update order ${orderId} with Stripe session:`,
        error,
      );
      throw error;
    }
  }

  async updateOrderWithStripePaymentIntent(
    orderId: string,
    stripePaymentIntentId: string,
  ) {
    try {
      const order = await this.prisma.order.update({
        where: { id: orderId },
        data: { stripePaymentIntentId },
      });

      this.logger.log(
        `Order ${orderId} updated with Stripe payment intent: ${stripePaymentIntentId}`,
      );

      return order;
    } catch (error) {
      this.logger.error(
        `Failed to update order ${orderId} with Stripe payment intent:`,
        error,
      );
      throw error;
    }
  }
}
