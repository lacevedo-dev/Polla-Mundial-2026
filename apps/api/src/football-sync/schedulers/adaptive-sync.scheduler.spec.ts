import { Test, TestingModule } from '@nestjs/testing';
import { AdaptiveSyncScheduler } from './adaptive-sync.scheduler';
import { SyncPlanService } from '../services/sync-plan.service';
import { MatchSyncService } from '../services/match-sync.service';
import { ConfigService as FootballConfigService } from '../services/config.service';
import { SyncEventsService } from '../services/sync-events.service';

describe('AdaptiveSyncScheduler', () => {
  let scheduler: AdaptiveSyncScheduler;

  const mockSyncPlanService = {
    shouldSyncNow: jest.fn(),
    calculateDailyPlan: jest.fn(),
    countPotentiallyLiveMatches: jest.fn(),
  };

  const mockMatchSyncService = {
    syncTodayMatches: jest.fn(),
    syncTodayMatchesForTrigger: jest.fn(),
  };

  const mockFootballConfigService = {
    isEnabled: jest.fn(),
    isAutoSyncEnabled: jest.fn(),
    isPeakHoursSyncEnabled: jest.fn(),
  };

  const mockSyncEventsService = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdaptiveSyncScheduler,
        { provide: SyncPlanService, useValue: mockSyncPlanService },
        { provide: MatchSyncService, useValue: mockMatchSyncService },
        { provide: FootballConfigService, useValue: mockFootballConfigService },
        { provide: SyncEventsService, useValue: mockSyncEventsService },
      ],
    }).compile();

    scheduler = module.get<AdaptiveSyncScheduler>(AdaptiveSyncScheduler);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockFootballConfigService.isEnabled.mockResolvedValue(true);
    mockFootballConfigService.isAutoSyncEnabled.mockResolvedValue(true);
    mockFootballConfigService.isPeakHoursSyncEnabled.mockResolvedValue(true);
    mockSyncPlanService.shouldSyncNow.mockResolvedValue(false);
    mockSyncPlanService.countPotentiallyLiveMatches.mockResolvedValue(0);
    mockSyncPlanService.calculateDailyPlan.mockResolvedValue({
      date: '2026-03-28',
      totalMatches: 1,
      requestBudget: 10,
      intervalMinutes: 5,
      estimatedRequestsUsed: 2,
      strategy: 'BALANCED',
      hasLiveMatches: true,
      nextSyncIn: 0,
      lastSync: null,
    });
    mockMatchSyncService.syncTodayMatchesForTrigger.mockResolvedValue({
      success: true,
      matchesUpdated: 2,
    });
  });

  it('skips adaptive sync when auto sync is disabled', async () => {
    mockFootballConfigService.isAutoSyncEnabled.mockResolvedValue(false);

    await scheduler.adaptiveSyncTick();

    expect(mockSyncPlanService.shouldSyncNow).not.toHaveBeenCalled();
    expect(mockMatchSyncService.syncTodayMatches).not.toHaveBeenCalled();
    expect(mockMatchSyncService.syncTodayMatchesForTrigger).not.toHaveBeenCalled();
  });

  it('runs peak-hours override from adaptive tick on five-minute boundary', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T10:00:00'));
    mockSyncPlanService.shouldSyncNow.mockResolvedValue(false);
    mockFootballConfigService.isPeakHoursSyncEnabled.mockResolvedValue(true);

    await scheduler.adaptiveSyncTick();

    expect(mockFootballConfigService.isPeakHoursSyncEnabled).toHaveBeenCalled();
    expect(mockSyncPlanService.calculateDailyPlan).toHaveBeenCalled();
    expect(mockMatchSyncService.syncTodayMatchesForTrigger).toHaveBeenCalledTimes(1);
  });

  it('skips peak-hours override when boundary is not reached', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T10:01:00'));
    mockSyncPlanService.shouldSyncNow.mockResolvedValue(false);

    await scheduler.adaptiveSyncTick();

    expect(mockFootballConfigService.isPeakHoursSyncEnabled).not.toHaveBeenCalled();
    expect(mockMatchSyncService.syncTodayMatchesForTrigger).not.toHaveBeenCalled();
  });

  it('skips peak-hours override when peak-hours sync is disabled', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T10:00:00'));
    mockSyncPlanService.shouldSyncNow.mockResolvedValue(false);
    mockFootballConfigService.isPeakHoursSyncEnabled.mockResolvedValue(false);

    await scheduler.adaptiveSyncTick();

    expect(mockSyncPlanService.calculateDailyPlan).not.toHaveBeenCalled();
    expect(mockMatchSyncService.syncTodayMatchesForTrigger).not.toHaveBeenCalled();
  });

  it('blocks manual sync when the module is disabled', async () => {
    mockFootballConfigService.isEnabled.mockResolvedValue(false);

    const result = await scheduler.triggerManualSync();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/disabled/i);
    expect(mockMatchSyncService.syncTodayMatches).not.toHaveBeenCalled();
    expect(mockMatchSyncService.syncTodayMatchesForTrigger).not.toHaveBeenCalled();
  });
});
