import { Test, TestingModule } from '@nestjs/testing';
import { SyncAlertLevel, SyncAlertType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiFootballClient } from './api-football-client.service';
import { MonitoringService } from './monitoring.service';

describe('MonitoringService', () => {
  let service: MonitoringService;

  const mockPrismaService = {
    footballSyncConfig: {
      findFirst: jest.fn(),
    },
    dailySyncPlan: {
      findUnique: jest.fn(),
    },
    apiFootballRequest: {
      count: jest.fn(),
    },
    footballSyncAlert: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    footballSyncLog: {
      findMany: jest.fn(),
    },
    match: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockApiFootballClient = {
    isConfigured: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ApiFootballClient,
          useValue: mockApiFootballClient,
        },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates a new alert when there is no unresolved duplicate in the dedup window', async () => {
    mockPrismaService.footballSyncAlert.findFirst.mockResolvedValue(null);
    mockPrismaService.footballSyncAlert.create.mockResolvedValue({
      id: 'alert-1',
    });

    await service.createAlert({
      type: SyncAlertType.SYNC_FAILURE,
      severity: SyncAlertLevel.ERROR,
      message: 'Football Sync falló',
      details: '{"source":"test"}',
    });

    expect(mockPrismaService.footballSyncAlert.create).toHaveBeenCalledWith({
      data: {
        type: SyncAlertType.SYNC_FAILURE,
        severity: SyncAlertLevel.ERROR,
        message: 'Football Sync falló',
        details: '{"source":"test"}',
      },
    });
  });

  it('skips creating an alert when an unresolved duplicate exists recently', async () => {
    mockPrismaService.footballSyncAlert.findFirst.mockResolvedValue({
      id: 'existing-alert',
    });

    await service.createAlert({
      type: SyncAlertType.RATE_LIMIT_EXCEEDED,
      severity: SyncAlertLevel.WARNING,
      message: 'Sin requests disponibles',
      details: '{"source":"test"}',
    });

    expect(mockPrismaService.footballSyncAlert.create).not.toHaveBeenCalled();
  });

  it('normalizes resolved=false query filters before querying Prisma alerts', async () => {
    mockPrismaService.footballSyncAlert.findMany.mockResolvedValue([]);
    mockPrismaService.footballSyncAlert.count.mockResolvedValue(0);

    await service.getAlerts({
      page: 1,
      limit: 20,
      resolved: 'false' as unknown as boolean,
    });

    expect(mockPrismaService.footballSyncAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resolved: false,
        }),
      }),
    );
    expect(mockPrismaService.footballSyncAlert.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        resolved: false,
      }),
    });
  });

  it('uses UTC for quota data and Bogota for the operational plan window', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-03-28T01:30:00Z'));

    mockPrismaService.footballSyncConfig.findFirst.mockResolvedValue({
      enabled: true,
      autoSyncEnabled: true,
      dailyRequestLimit: 100,
      emergencyModeThreshold: 10,
      minSyncInterval: 5,
      maxSyncInterval: 30,
    });
    mockPrismaService.dailySyncPlan.findUnique.mockResolvedValue({
      requestsBudget: 42,
      lastSyncAt: null,
      intervalMinutes: 5,
    });
    mockPrismaService.footballSyncLog.findMany.mockResolvedValue([]);
    mockPrismaService.apiFootballRequest.count.mockResolvedValue(0);
    mockPrismaService.match.count.mockResolvedValue(0);
    mockPrismaService.match.findMany.mockResolvedValue([]);

    await service.getDashboard();

    expect(mockPrismaService.dailySyncPlan.findUnique).toHaveBeenCalledWith({
      where: { date: '2026-03-27' },
    });
    expect(mockPrismaService.apiFootballRequest.count).toHaveBeenCalledWith({
      where: {
        createdAt: {
          gte: new Date('2026-03-28T00:00:00.000Z'),
        },
      },
    });
    expect(mockPrismaService.match.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          matchDate: expect.objectContaining({
            gte: new Date('2026-03-27T05:00:00.000Z'),
            lt: new Date('2026-03-28T05:00:00.000Z'),
          }),
        }),
      }),
    );
  });
});
