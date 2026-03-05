import { Controller, Post, Body, Get, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @UseGuards(JwtAuthGuard)
    @Post('checkout')
    async createCheckout(@Request() req, @Body() createPaymentDto: CreatePaymentDto) {
        const userId = req.user.userId;
        return this.paymentsService.createPaymentSession(userId, createPaymentDto);
    }

    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    async webhook(@Body() payload: any) {
        return this.paymentsService.handleWebhook(payload);
    }

    @UseGuards(JwtAuthGuard)
    @Get('my-history')
    async getHistory(@Request() req) {
        const userId = req.user.userId;
        return this.paymentsService.getMyPayments(userId);
    }
}
