import { Test, TestingModule } from '@nestjs/testing';
import { AdaptiveSyncScheduler } from './adaptive-sync.scheduler';
import { SyncPlanService } from '../services/sync-plan.service';
import { MatchSyncService } from '../services/match-sync.service';
import { ConfigService as FootballConfigService } from '../services/config.service';

describe('AdaptiveSyncScheduler', () => {
  let scheduler: AdaptiveSyncScheduler;

  const mockSyncPlanService = {
    shouldSyncNow: jest.fn(),
    calculateDailyPlan: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdaptiveSyncScheduler,
        { provide: SyncPlanService, useValue: mockSyncPlanService },
        { provide: MatchSyncService, useValue: mockMatchSyncService },
        { provide: FootballConfigService, useValue: mockFootballConfigService },
      ],
    }).compile();

    scheduler = module.get<AdaptiveSyncScheduler>(AdaptiveSyncScheduler);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockFootballConfigService.isEnabled.mockResolvedValue(true);
    mockFootballConfigService.isAutoSyncEnabled.mockResolvedValue(true);
    mockFootballConfigService.isPeakHoursSyncEnabled.mockResolvedValue(true);
  });

  it('skips adaptive sync when auto sync is disabled', async () => {
    mockFootballConfigService.isAutoSyncEnabled.mockResolvedValue(false);

    await scheduler.adaptiveSyncTick();

    expect(mockSyncPlanService.shouldSyncNow).not.toHaveBeenCalled();
    expect(mockMatchSyncService.syncTodayMatches).not.toHaveBeenCalled();
    expect(mockMatchSyncService.syncTodayMatchesForTrigger).not.toHaveBeenCalled();
  });

  it('skips peak hours sync when peak-hours sync is disabled', async () => {
    mockFootballConfigService.isPeakHoursSyncEnabled.mockResolvedValue(false);

    await scheduler.peakHoursSync();

    expect(mockSyncPlanService.calculateDailyPlan).not.toHaveBeenCalled();
    expect(mockMatchSyncService.syncTodayMatches).not.toHaveBeenCalled();
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
