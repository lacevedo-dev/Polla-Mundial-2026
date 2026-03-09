import { Controller, Get, UseGuards, Request, Query, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrderStatus } from '@prisma/client';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getOrders(
    @Request() req,
    @Query('status') status?: string,
  ) {
    const userId = req.user.userId;

    // Validate status if provided
    let orderStatus: OrderStatus | undefined;
    if (status) {
      const normalizedStatus = status.toUpperCase() as OrderStatus;
      if (!Object.values(OrderStatus).includes(normalizedStatus)) {
        throw new BadRequestException(
          `Invalid status. Must be one of: ${Object.values(OrderStatus).join(', ')}`,
        );
      }
      orderStatus = normalizedStatus;
    }

    const orders = await this.ordersService.getOrders(userId, orderStatus);

    return {
      data: orders,
      total: orders.length,
    };
  }
}
