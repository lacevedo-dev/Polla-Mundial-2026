import { Test, TestingModule } from '@nestjs/testing';
import { SyncAlertLevel, SyncAlertType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiFootballClient } from './api-football-client.service';
import { MonitoringService } from './monitoring.service';

describe('MonitoringService', () => {
  let service: MonitoringService;

  const mockPrismaService = {
    footballSyncAlert: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
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
});
