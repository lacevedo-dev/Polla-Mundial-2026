import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    it('should create an order', async () => {
      const userId = 'user123';
      const amount = 100;
      const currency = 'USD';
      const items = [
        { type: 'BASE_FEE', id: 'league1', quantity: 1 },
      ];

      const mockOrder = {
        id: 'order123',
        userId,
        amount: parseFloat(amount.toFixed(2)),
        currency,
        status: OrderStatus.PENDING,
        items,
        createdAt: new Date(),
        updatedAt: new Date(),
        stripeSessionId: null,
        stripePaymentIntentId: null,
      };

      mockPrismaService.order.create.mockResolvedValue(mockOrder);

      const result = await service.createOrder(userId, amount, currency, items);

      expect(result).toEqual({
        id: mockOrder.id,
        status: mockOrder.status,
        amount: mockOrder.amount,
        currency: mockOrder.currency,
        createdAt: mockOrder.createdAt,
      });

      expect(mockPrismaService.order.create).toHaveBeenCalledWith({
        data: {
          userId,
          amount: parseFloat(amount.toFixed(2)),
          currency,
          items: items as any,
          status: OrderStatus.PENDING,
        },
      });
    });
  });

  describe('getOrders', () => {
    it('should get orders for a user', async () => {
      const userId = 'user123';
      const mockOrders = [
        {
          id: 'order1',
          userId,
          amount: 100,
          currency: 'USD',
          status: OrderStatus.COMPLETED,
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          stripeSessionId: 'session1',
          stripePaymentIntentId: 'intent1',
        },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.getOrders(userId);

      expect(result).toEqual(mockOrders);
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        where: { userId },
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
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const orderId = 'order123';
      const newStatus = OrderStatus.COMPLETED;

      const mockUpdatedOrder = {
        id: orderId,
        userId: 'user123',
        amount: 100,
        currency: 'USD',
        status: newStatus,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        stripeSessionId: null,
        stripePaymentIntentId: null,
      };

      mockPrismaService.order.update.mockResolvedValue(mockUpdatedOrder);

      const result = await service.updateOrderStatus(orderId, newStatus);

      expect(result).toEqual({
        id: mockUpdatedOrder.id,
        status: mockUpdatedOrder.status,
        updatedAt: mockUpdatedOrder.updatedAt,
      });

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { status: newStatus },
      });
    });
  });
});
