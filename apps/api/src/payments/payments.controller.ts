import { Controller, Post, Body, Get, UseGuards, Request, HttpCode, HttpStatus, BadRequestException, Req } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { CreateCheckoutSessionDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WebhookHandler } from './webhook.handler';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';

@Controller('payments')
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly webhookHandler: WebhookHandler,
        private readonly stripeService: StripeService,
    ) { }

    @UseGuards(JwtAuthGuard)
    @Post('checkout')
    async createCheckout(@Request() req, @Body() createPaymentDto: CreatePaymentDto) {
        const userId = req.user.userId;
        return this.paymentsService.createPaymentSession(userId, createPaymentDto);
    }

    @UseGuards(JwtAuthGuard)
    @Post('checkout-session')
    async createCheckoutSession(
        @Request() req,
        @Body() createCheckoutSessionDto: CreateCheckoutSessionDto,
    ) {
        const userId = req.user.userId;
        return this.paymentsService.createStripeCheckoutSession(
            userId,
            createCheckoutSessionDto.items,
            createCheckoutSessionDto.currency,
            createCheckoutSessionDto.successUrl,
            createCheckoutSessionDto.cancelUrl,
        );
    }

    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    async webhook(@Body() payload: any) {
        return this.paymentsService.handleWebhook(payload);
    }

    @Post('webhook/stripe')
    @HttpCode(HttpStatus.OK)
    async stripeWebhook(@Req() req: ExpressRequest & { rawBody?: Buffer }) {
        const signature = req.headers['stripe-signature'] as string;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!signature) {
            throw new BadRequestException('Missing Stripe signature header');
        }

        if (!webhookSecret) {
            throw new BadRequestException('Webhook secret not configured');
        }

        try {
            const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
            const event = this.stripeService.verifyWebhookSignature(
                payload instanceof Buffer ? payload.toString('utf8') : payload,
                signature,
                webhookSecret,
            );

            return this.webhookHandler.handleEvent(event as Stripe.Event);
        } catch (error) {
            if (error instanceof Error) {
                throw new BadRequestException(`Webhook error: ${error.message}`);
            }
            throw new BadRequestException('Invalid webhook signature');
        }
    }

    @UseGuards(JwtAuthGuard)
    @Get('my-history')
    async getHistory(@Request() req) {
        const userId = req.user.userId;
        return this.paymentsService.getMyPayments(userId);
    }
}
