import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SyncPlanService } from './sync-plan.service';
import { RateLimiterService } from './rate-limiter.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchStatus, SyncStrategy } from '@prisma/client';
import { ConfigService as FootballConfigService } from './config.service';

describe('SyncPlanService', () => {
  let service: SyncPlanService;
  let prismaService: PrismaService;
  const mockPrismaService = {
    dailySyncPlan: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    match: {
      groupBy: jest.fn(),
    },
  };

  const mockRateLimiter = {
    getUsedRequestsToday: jest.fn(),
    getAvailableRequests: jest.fn(),
    getDailyLimit: jest.fn().mockReturnValue(100),
  };

  const mockConfigService = {
    get: jest.fn((_: string, defaultValue?: any) => defaultValue),
  };

  const mockFootballConfigService = {
    getSyncIntervals: jest.fn().mockResolvedValue({ min: 5, max: 30 }),
    isAutoSyncEnabled: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncPlanService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RateLimiterService,
          useValue: mockRateLimiter,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: FootballConfigService,
          useValue: mockFootballConfigService,
        },
      ],
    }).compile();

    service = module.get<SyncPlanService>(SyncPlanService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockFootballConfigService.getSyncIntervals.mockResolvedValue({ min: 5, max: 30 });
    mockFootballConfigService.isAutoSyncEnabled.mockResolvedValue(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateDailyPlan', () => {
    it('should create new plan when none exists', async () => {
      const today = new Date().toISOString().split('T')[0];

      mockPrismaService.dailySyncPlan.findUnique.mockResolvedValue(null);
      mockPrismaService.match.groupBy.mockResolvedValue([
        { status: MatchStatus.LIVE, _count: 2 },
        { status: MatchStatus.SCHEDULED, _count: 3 },
      ]);
      mockRateLimiter.getUsedRequestsToday.mockResolvedValue(20);
      mockRateLimiter.getAvailableRequests.mockResolvedValue(80);
      mockPrismaService.dailySyncPlan.create.mockResolvedValue({
        id: 'test-plan',
        date: today,
        totalMatches: 5,
        intervalMinutes: 8,
        requestsUsed: 20,
        requestsBudget: 80,
        strategy: SyncStrategy.BALANCED,
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.calculateDailyPlan();

      expect(result).toBeDefined();
      expect(result.totalMatches).toBe(5);
      expect(result.hasLiveMatches).toBe(true);
      expect(mockPrismaService.dailySyncPlan.create).toHaveBeenCalled();
    });

    it('should update existing plan', async () => {
      const today = new Date().toISOString().split('T')[0];
      const existingPlan = {
        id: 'existing-plan',
        date: today,
        totalMatches: 3,
        intervalMinutes: 10,
        requestsUsed: 10,
        requestsBudget: 90,
        strategy: SyncStrategy.BALANCED,
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.dailySyncPlan.findUnique.mockResolvedValue(
        existingPlan,
      );
      mockPrismaService.match.groupBy.mockResolvedValue([
        { status: MatchStatus.SCHEDULED, _count: 5 },
      ]);
      mockRateLimiter.getUsedRequestsToday.mockResolvedValue(25);
      mockRateLimiter.getAvailableRequests.mockResolvedValue(75);
      mockPrismaService.dailySyncPlan.update.mockResolvedValue({
        ...existingPlan,
        totalMatches: 5,
        requestsUsed: 25,
        requestsBudget: 75,
      });

      const result = await service.calculateDailyPlan();

      expect(result).toBeDefined();
      expect(mockPrismaService.dailySyncPlan.update).toHaveBeenCalled();
    });

    it('should use emergency strategy when few requests left', async () => {
      const today = new Date().toISOString().split('T')[0];

      mockPrismaService.dailySyncPlan.findUnique.mockResolvedValue(null);
      mockPrismaService.match.groupBy.mockResolvedValue([
        { status: MatchStatus.LIVE, _count: 3 },
      ]);
      mockRateLimiter.getUsedRequestsToday.mockResolvedValue(98);
      mockRateLimiter.getAvailableRequests.mockResolvedValue(2);
      mockPrismaService.dailySyncPlan.create.mockResolvedValue({
        id: 'emergency-plan',
        date: today,
        totalMatches: 3,
        intervalMinutes: 30,
        requestsUsed: 98,
        requestsBudget: 2,
        strategy: SyncStrategy.EMERGENCY,
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.calculateDailyPlan();

      expect(result.strategy).toBe(SyncStrategy.EMERGENCY);
    });
  });

  describe('shouldSyncNow', () => {
    it('should return false when auto sync is disabled', async () => {
      mockFootballConfigService.isAutoSyncEnabled.mockResolvedValue(false);

      const result = await service.shouldSyncNow();

      expect(result).toBe(false);
    });

    it('should return false when no live matches', async () => {
      mockPrismaService.dailySyncPlan.findUnique.mockResolvedValue(null);
      mockPrismaService.match.groupBy.mockResolvedValue([
        { status: MatchStatus.SCHEDULED, _count: 3 },
      ]);
      mockRateLimiter.getUsedRequestsToday.mockResolvedValue(20);
      mockRateLimiter.getAvailableRequests.mockResolvedValue(80);
      mockPrismaService.dailySyncPlan.create.mockResolvedValue({
        id: 'test',
        date: new Date().toISOString().split('T')[0],
        totalMatches: 3,
        intervalMinutes: 10,
        requestsUsed: 20,
        requestsBudget: 80,
        strategy: SyncStrategy.BALANCED,
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.shouldSyncNow();

      expect(result).toBe(false);
    });

    it('should return false when no requests available', async () => {
      mockPrismaService.dailySyncPlan.findUnique.mockResolvedValue(null);
      mockPrismaService.match.groupBy.mockResolvedValue([
        { status: MatchStatus.LIVE, _count: 2 },
      ]);
      mockRateLimiter.getUsedRequestsToday.mockResolvedValue(100);
      mockRateLimiter.getAvailableRequests.mockResolvedValue(0);
      mockPrismaService.dailySyncPlan.create.mockResolvedValue({
        id: 'test',
        date: new Date().toISOString().split('T')[0],
        totalMatches: 2,
        intervalMinutes: 10,
        requestsUsed: 100,
        requestsBudget: 0,
        strategy: SyncStrategy.BALANCED,
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.shouldSyncNow();

      expect(result).toBe(false);
    });
  });

  describe('updateLastSyncTime', () => {
    it('should update last sync time for today', async () => {
      mockPrismaService.dailySyncPlan.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.updateLastSyncTime();

      expect(mockPrismaService.dailySyncPlan.updateMany).toHaveBeenCalled();
    });
  });

  describe('incrementRequestsUsed', () => {
    it('should increment requests used counter', async () => {
      mockPrismaService.dailySyncPlan.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.incrementRequestsUsed();

      expect(mockPrismaService.dailySyncPlan.updateMany).toHaveBeenCalledWith({
        where: { date: expect.any(String) },
        data: {
          requestsUsed: {
            increment: 1,
          },
        },
      });
    });
  });
});
