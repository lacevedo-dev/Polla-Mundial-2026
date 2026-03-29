import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RateLimiterService } from './rate-limiter.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService as FootballConfigService } from './config.service';

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    apiFootballRequest: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'API_FOOTBALL_DAILY_LIMIT') return 100;
      return defaultValue;
    }),
  };

  const mockFootballConfigService = {
    getDailyLimit: jest.fn().mockResolvedValue(100),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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

    service = module.get<RateLimiterService>(RateLimiterService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockFootballConfigService.getDailyLimit.mockResolvedValue(100);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('canMakeRequest', () => {
    it('should return true when under daily limit', async () => {
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(50);

      const result = await service.canMakeRequest();

      expect(result).toBe(true);
      expect(mockPrismaService.apiFootballRequest.count).toHaveBeenCalled();
    });

    it('should return false when at daily limit', async () => {
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(100);

      const result = await service.canMakeRequest();

      expect(result).toBe(false);
    });

    it('should return false when over daily limit', async () => {
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(105);

      const result = await service.canMakeRequest();

      expect(result).toBe(false);
    });
  });

  describe('getUsedRequestsToday', () => {
    it('should return count of requests made today', async () => {
      const expectedCount = 42;
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(
        expectedCount,
      );

      const result = await service.getUsedRequestsToday();

      expect(result).toBe(expectedCount);
    });

    it('should count requests from 00:00 UTC', async () => {
      const now = new Date('2026-03-28T15:34:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(0);

      await service.getUsedRequestsToday();

      expect(mockPrismaService.apiFootballRequest.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date('2026-03-28T00:00:00.000Z'),
          },
        },
      });
    });
  });

  describe('getAvailableRequests', () => {
    it('should return available requests', async () => {
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(30);

      const result = await service.getAvailableRequests();

      expect(result).toBe(70); // 100 - 30
    });

    it('should return 0 when limit exceeded', async () => {
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(110);

      const result = await service.getAvailableRequests();

      expect(result).toBe(0);
    });
  });

  describe('logRequest', () => {
    it('should create request log entry', async () => {
      mockPrismaService.apiFootballRequest.create.mockResolvedValue({
        id: 'test-id',
      });
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(1);

      await service.logRequest('/fixtures', { date: '2026-06-15' }, 200, 5);

      expect(mockPrismaService.apiFootballRequest.create).toHaveBeenCalledWith(
        {
          data: {
            endpoint: '/fixtures',
            params: { date: '2026-06-15' },
            responseStatus: 200,
            matchesFetched: 5,
          },
        },
      );
    });
  });

  describe('getDailyLimit', () => {
    it('should return configured daily limit', async () => {
      const limit = await service.getDailyLimit();
      expect(limit).toBe(100);
    });

    it('prefers persisted football sync config over env fallback', async () => {
      mockFootballConfigService.getDailyLimit.mockResolvedValue(150);

      const limit = await service.getDailyLimit();

      expect(limit).toBe(150);
    });
  });

  describe('getUsagePercentage', () => {
    it('should calculate usage percentage correctly', async () => {
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(50);

      const result = await service.getUsagePercentage();

      expect(result).toBe(50);
    });

    it('should handle 0 requests', async () => {
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(0);

      const result = await service.getUsagePercentage();

      expect(result).toBe(0);
    });
  });

  describe('canMakeRequests', () => {
    it('should return true if enough requests available', async () => {
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(50);

      const result = await service.canMakeRequests(20);

      expect(result).toBe(true);
    });

    it('should return false if not enough requests available', async () => {
      mockPrismaService.apiFootballRequest.count.mockResolvedValue(90);

      const result = await service.canMakeRequests(20);

      expect(result).toBe(false);
    });
  });
});
