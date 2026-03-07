import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);
  private processedEventIds = new Set<string>(); // Simple in-memory deduplication

  constructor(
    private readonly ordersService: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  async handleEvent(event: Stripe.Event) {
    // Check for idempotency (avoid processing same event twice)
    if (this.processedEventIds.has(event.id)) {
      this.logger.log(`Event ${event.id} already processed, skipping`);
      return { received: true, cached: true };
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(
            event.data.object as Stripe.Charge,
          );
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      this.processedEventIds.add(event.id);
      this.logger.log(`Event ${event.id} processed successfully`);
      return { received: true };
    } catch (error) {
      this.logger.error(`Failed to process event ${event.id}:`, error);
      throw error;
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId;

    if (!orderId) {
      this.logger.warn(
        `Checkout session ${session.id} missing orderId in metadata`,
      );
      return;
    }

    try {
      await this.ordersService.updateOrderStatus(
        orderId,
        OrderStatus.COMPLETED,
      );

      await this.ordersService.updateOrderWithStripeSession(
        orderId,
        session.id,
      );

      if (session.payment_intent && typeof session.payment_intent === 'string') {
        await this.ordersService.updateOrderWithStripePaymentIntent(
          orderId,
          session.payment_intent,
        );
      }

      this.logger.log(
        `Checkout session completed for order ${orderId}: ${session.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle checkout session completed for order ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const orderId = paymentIntent.metadata?.orderId;

    if (!orderId) {
      this.logger.warn(
        `Payment intent ${paymentIntent.id} missing orderId in metadata`,
      );
      return;
    }

    try {
      await this.ordersService.updateOrderStatus(
        orderId,
        OrderStatus.COMPLETED,
      );

      await this.ordersService.updateOrderWithStripePaymentIntent(
        orderId,
        paymentIntent.id,
      );

      this.logger.log(
        `Payment intent succeeded for order ${orderId}: ${paymentIntent.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle payment intent succeeded for order ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ) {
    const orderId = paymentIntent.metadata?.orderId;

    if (!orderId) {
      this.logger.warn(
        `Payment intent ${paymentIntent.id} missing orderId in metadata`,
      );
      return;
    }

    try {
      await this.ordersService.updateOrderStatus(orderId, OrderStatus.FAILED);

      this.logger.log(
        `Payment intent failed for order ${orderId}: ${paymentIntent.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle payment intent failed for order ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  private async handleChargeRefunded(charge: Stripe.Charge) {
    const paymentIntentId = charge.payment_intent;

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      this.logger.warn(`Charge ${charge.id} missing payment intent`);
      return;
    }

    try {
      // Find order by stripe payment intent id
      const order = await this.prisma.order.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (!order) {
        this.logger.warn(
          `Order not found for payment intent ${paymentIntentId}`,
        );
        return;
      }

      await this.ordersService.updateOrderStatus(order.id, OrderStatus.REFUNDED);

      this.logger.log(
        `Charge refunded for order ${order.id}: ${charge.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle charge refunded for payment intent ${paymentIntentId}:`,
        error,
      );
      throw error;
    }
  }
}
