import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BoldService } from './bold.service';
import { StripeService } from './stripe.service';
import { WebhookHandler } from './webhook.handler';
import { OrdersModule } from '../orders/orders.module';
import { StripeWebhookMiddleware } from './stripe-webhook.middleware';

@Module({
    imports: [PrismaModule, OrdersModule],
    providers: [PaymentsService, BoldService, StripeService, WebhookHandler],
    controllers: [PaymentsController],
    exports: [PaymentsService, StripeService, WebhookHandler],
})
export class PaymentsModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(StripeWebhookMiddleware).forRoutes(PaymentsController);
    }
}
