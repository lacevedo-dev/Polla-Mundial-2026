import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured, using test key');
    }

    this.stripe = new Stripe(apiKey || 'sk_test_dummy_key', {
      apiVersion: '2024-06-20',
    });
  }

  async createCheckoutSession(
    items: Array<{
      name: string;
      amount: number;
      quantity: number;
      currency: string;
    }>,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, any>,
  ) {
    try {
      const lineItems = items.map((item) => ({
        price_data: {
          currency: item.currency.toLowerCase(),
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.amount * 100), // Convert to cents
        },
        quantity: item.quantity,
      }));

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
      });

      this.logger.log(`Checkout session created: ${session.id}`);

      return {
        sessionId: session.id,
        redirectUrl: session.url,
      };
    } catch (error) {
      this.logger.error('Failed to create Stripe checkout session:', error);
      throw error;
    }
  }

  async getCheckoutSession(sessionId: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve Stripe checkout session ${sessionId}:`,
        error,
      );
      throw error;
    }
  }

  async getPaymentIntent(paymentIntentId: string) {
    try {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve Stripe payment intent ${paymentIntentId}:`,
        error,
      );
      throw error;
    }
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    webhookSecret: string,
  ): any {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
      return event;
    } catch (error) {
      this.logger.error('Failed to verify webhook signature:', error);
      throw error;
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number) {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
      });

      this.logger.log(
        `Refund created for payment intent ${paymentIntentId}: ${refund.id}`,
      );

      return refund;
    } catch (error) {
      this.logger.error(
        `Failed to refund payment intent ${paymentIntentId}:`,
        error,
      );
      throw error;
    }
  }
}
