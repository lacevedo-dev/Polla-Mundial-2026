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
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    match: {
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    league: {
      findMany: jest.fn(),
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
    isEventSyncEnabled: jest.fn().mockResolvedValue(false),
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
    mockFootballConfigService.isEventSyncEnabled.mockResolvedValue(false);
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
      mockPrismaService.dailySyncPlan.upsert.mockResolvedValue({
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
      expect(mockPrismaService.dailySyncPlan.upsert).toHaveBeenCalled();
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
      mockPrismaService.dailySyncPlan.upsert.mockResolvedValue({
        ...existingPlan,
        totalMatches: 5,
        requestsUsed: 25,
        requestsBudget: 75,
      });

      const result = await service.calculateDailyPlan();

      expect(result).toBeDefined();
      expect(mockPrismaService.dailySyncPlan.upsert).toHaveBeenCalled();
    });

    it('should use emergency strategy when few requests left', async () => {
      const today = new Date().toISOString().split('T')[0];

      mockPrismaService.dailySyncPlan.findUnique.mockResolvedValue(null);
      mockPrismaService.match.groupBy.mockResolvedValue([
        { status: MatchStatus.LIVE, _count: 3 },
      ]);
      mockRateLimiter.getUsedRequestsToday.mockResolvedValue(98);
      mockRateLimiter.getAvailableRequests.mockResolvedValue(2);
      mockPrismaService.dailySyncPlan.upsert.mockResolvedValue({
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
      mockPrismaService.match.count.mockResolvedValue(0);
      mockRateLimiter.getUsedRequestsToday.mockResolvedValue(20);
      mockRateLimiter.getAvailableRequests.mockResolvedValue(80);
      mockPrismaService.dailySyncPlan.upsert.mockResolvedValue({
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
      mockPrismaService.dailySyncPlan.upsert.mockResolvedValue({
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

  describe('buildTrackedMatchesWhere (carry-over cutoff)', () => {
    // Helper: call getMatchesToday() and capture the `where` passed to groupBy
    const captureWhere = async () => {
      let capturedWhere: any;
      mockPrismaService.match.groupBy.mockImplementationOnce((args: any) => {
        capturedWhere = args.where;
        return Promise.resolve([]);
      });
      await service.getMatchesToday();
      return capturedWhere;
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('excludes a SCHEDULED match with externalId that started more than 370 min ago (hard cutoff)', async () => {
      // Freeze time so cutoffs are deterministic
      const now = new Date('2026-03-29T12:00:00.000Z');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const where = await captureWhere();

      // The carry-over branch is the second element of the top-level OR
      const carryOverBranch = where.OR[1];
      const scheduledLiveBranch = carryOverBranch.OR[0];
      const withExternalIdBranch = scheduledLiveBranch.OR[0];

      // A match 8h ago (480 min) is before the 370-min hard cutoff
      const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);
      const cutoff: Date = withExternalIdBranch.matchDate.gte;

      expect(eightHoursAgo < cutoff).toBe(true); // match is EXCLUDED (before cutoff)
    });

    it('includes a SCHEDULED match with externalId that started less than 370 min ago', async () => {
      const now = new Date('2026-03-29T12:00:00.000Z');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const where = await captureWhere();

      const carryOverBranch = where.OR[1];
      const scheduledLiveBranch = carryOverBranch.OR[0];
      const withExternalIdBranch = scheduledLiveBranch.OR[0];

      // A match 2h ago (120 min) is AFTER the 370-min hard cutoff
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const cutoff: Date = withExternalIdBranch.matchDate.gte;

      expect(twoHoursAgo >= cutoff).toBe(true); // match is INCLUDED (after cutoff)
    });

    it('includes a SCHEDULED match WITHOUT externalId that started less than 130 min ago (soft cutoff)', async () => {
      const now = new Date('2026-03-29T12:00:00.000Z');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const where = await captureWhere();

      const carryOverBranch = where.OR[1];
      const scheduledLiveBranch = carryOverBranch.OR[0];
      const withoutExternalIdBranch = scheduledLiveBranch.OR[1];

      // A match 2h ago (120 min) is AFTER the 130-min soft cutoff
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const softCutoff: Date = withoutExternalIdBranch.matchDate.gte;

      expect(twoHoursAgo >= softCutoff).toBe(true); // match is INCLUDED
    });

    it('excludes a SCHEDULED match WITHOUT externalId that started more than 130 min ago', async () => {
      const now = new Date('2026-03-29T12:00:00.000Z');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const where = await captureWhere();

      const carryOverBranch = where.OR[1];
      const scheduledLiveBranch = carryOverBranch.OR[0];
      const withoutExternalIdBranch = scheduledLiveBranch.OR[1];

      // A match 3h ago (180 min) is BEFORE the 130-min soft cutoff
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const softCutoff: Date = withoutExternalIdBranch.matchDate.gte;

      expect(threeHoursAgo < softCutoff).toBe(true); // match is EXCLUDED
    });

    it('does not touch the FINISHED/resultNotificationSentAt branch', async () => {
      const now = new Date('2026-03-29T12:00:00.000Z');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const where = await captureWhere();

      const carryOverBranch = where.OR[1];
      const finishedBranch = carryOverBranch.OR[1];

      expect(finishedBranch).toEqual({
        status: MatchStatus.FINISHED,
        resultNotificationSentAt: null,
      });
    });

    it('hard cutoff (370 min) is strictly greater than soft cutoff (130 min)', async () => {
      const now = new Date('2026-03-29T12:00:00.000Z');
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const where = await captureWhere();

      const carryOverBranch = where.OR[1];
      const scheduledLiveBranch = carryOverBranch.OR[0];
      const hardCutoff: Date = scheduledLiveBranch.OR[0].matchDate.gte;
      const softCutoff: Date = scheduledLiveBranch.OR[1].matchDate.gte;

      // Hard cutoff is FURTHER in the past (smaller timestamp) than soft cutoff:
      // 370 min ago < 130 min ago in absolute time
      expect(hardCutoff.getTime()).toBeLessThan(softCutoff.getTime());

      // Verify approximate durations (allow ±5s for test execution jitter)
      const hardMinutes = (now.getTime() - hardCutoff.getTime()) / 60000;
      const softMinutes = (now.getTime() - softCutoff.getTime()) / 60000;

      expect(hardMinutes).toBeCloseTo(370, 0);
      expect(softMinutes).toBeCloseTo(130, 0);
    });
  });

  describe('getDetailedTimeline', () => {
    const mockPlan = {
      date: '2026-03-28',
      totalMatches: 1,
      requestBudget: 10,
      intervalMinutes: 5,
      estimatedRequestsUsed: 1,
      strategy: SyncStrategy.BALANCED,
      hasLiveMatches: true,
      nextSyncIn: 0,
      lastSync: null,
    };

    const mockMatch = {
      id: 'match-1',
      matchDate: new Date('2026-03-28T13:00:00.000Z'),
      status: MatchStatus.LIVE,
      externalId: '123',
      homeTeam: {
        id: 'home-1',
        name: 'Colombia',
        flagUrl: null,
        code: 'COL',
      },
      awayTeam: {
        id: 'away-1',
        name: 'Brasil',
        flagUrl: null,
        code: 'BRA',
      },
      syncLogs: [],
    };

    const mockLeague = {
      closePredictionMinutes: 15,
      leagueTournaments: [
        {
          tournament: {
            matches: [{ id: 'match-1' }],
          },
        },
      ],
    };

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-03-28T12:00:00.000Z'));
      jest.spyOn(service, 'calculateDailyPlan').mockResolvedValue(mockPlan as any);
      mockRateLimiter.getUsedRequestsToday.mockResolvedValue(0);
      mockRateLimiter.getDailyLimit.mockResolvedValue(100);
      mockPrismaService.match.findMany.mockResolvedValue([mockMatch]);
      mockPrismaService.league.findMany.mockResolvedValue([mockLeague]);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('marks optional event requests as disabled by configuration when event sync is off', async () => {
      mockFootballConfigService.isEventSyncEnabled.mockResolvedValue(false);

      const timeline = await service.getDetailedTimeline();

      const eventRequest = timeline.plannedRequests.find((request) => request.type === 'EVENTS_FINAL');

      expect(eventRequest).toMatchObject({
        optional: true,
        executionState: 'disabled_by_config',
        disabledReason: 'event_sync_disabled',
      });
      expect(
        timeline.plannedRequests.every((request) =>
          request.type.startsWith('EVENTS_')
            ? request.executionState === 'disabled_by_config'
            : request.executionState === 'enabled',
        ),
      ).toBe(true);
      expect(
        timeline.matches[0].plannedRequests.some((request) =>
          request.type === 'EVENTS_HALFTIME' || request.type === 'EVENTS_FINAL',
        ),
      ).toBe(true);
    });

    it('marks event requests as enabled when event sync is on', async () => {
      mockFootballConfigService.isEventSyncEnabled.mockResolvedValue(true);

      const timeline = await service.getDetailedTimeline();

      const eventRequest = timeline.plannedRequests.find((request) => request.type === 'EVENTS_FINAL');

      expect(eventRequest).toMatchObject({
        optional: true,
        executionState: 'enabled',
      });
      expect(eventRequest?.disabledReason).toBeUndefined();
    });

    it('does not keep finished matches with active requests', async () => {
      mockFootballConfigService.isEventSyncEnabled.mockResolvedValue(true);
      mockPrismaService.match.findMany.mockResolvedValue([
        {
          ...mockMatch,
          id: 'match-finished',
          status: MatchStatus.FINISHED,
          matchDate: new Date('2026-03-28T13:00:00.000Z'),
          syncLogs: [],
        },
      ]);
      mockPrismaService.league.findMany.mockResolvedValue([
        {
          closePredictionMinutes: 15,
          leagueTournaments: [
            {
              tournament: {
                matches: [{ id: 'match-finished' }],
              },
            },
          ],
        },
      ]);

      const timeline = await service.getDetailedTimeline();
      const finishedMatch = timeline.matches[0];

      expect(finishedMatch.status).toBe(MatchStatus.FINISHED);
      expect(finishedMatch.plannedRequests).toHaveLength(0);
      expect(finishedMatch.requestsAssigned).toBe(0);
      expect(timeline.totalPlannedRequests).toBe(0);
      expect(timeline.requestLog.every((bucket) => bucket.requests === 0)).toBe(true);
    });

    it('limits carry-over matches to a single reconciliation request', async () => {
      mockFootballConfigService.isEventSyncEnabled.mockResolvedValue(true);
      mockPrismaService.match.findMany.mockResolvedValue([
        {
          ...mockMatch,
          id: 'match-carry-over',
          status: MatchStatus.SCHEDULED,
          matchDate: new Date('2026-03-27T13:00:00.000Z'),
          syncLogs: [],
        },
      ]);
      mockPrismaService.league.findMany.mockResolvedValue([
        {
          closePredictionMinutes: 15,
          leagueTournaments: [
            {
              tournament: {
                matches: [{ id: 'match-carry-over' }],
              },
            },
          ],
        },
      ]);

      const timeline = await service.getDetailedTimeline();
      const carryOverMatch = timeline.matches[0];

      expect(carryOverMatch.trackingScope).toBe('CARRY_OVER');
      expect(carryOverMatch.requestsAssigned).toBe(1);
      expect(carryOverMatch.plannedRequests).toHaveLength(1);
      expect(carryOverMatch.plannedRequests[0].type).toMatch(/^STATUS_/);
      expect(carryOverMatch.plannedRequests[0].executionState).toBe('enabled');
      expect(carryOverMatch.plannedRequests[0].optional).toBeUndefined();
    });
  });
});
