import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';

/** Currencies where Stripe expects the amount as-is (no cents conversion). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf',
  'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

/**
 * Stripe requires unit_amount in the smallest currency unit.
 * For COP and other non-zero-decimal currencies that don't use fractions
 * in practice (COP prices are already whole numbers with no centavos),
 * we do NOT multiply by 100 — Stripe treats COP as a standard decimal
 * currency but Colombian amounts are already at the unit level.
 * For USD and EUR we multiply by 100 (dollars → cents).
 */
function toStripeAmount(amount: number, currency: string): number {
  const c = currency.toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(c) || c === 'cop') {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}

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
          unit_amount: toStripeAmount(item.amount, item.currency),
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
      // Convert Stripe API errors into readable BadRequestException
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(
          `Error de pasarela de pago: ${error.message}`,
        );
      }
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
