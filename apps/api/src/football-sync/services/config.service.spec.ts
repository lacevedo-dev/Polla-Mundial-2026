import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { MonitoringService } from './monitoring.service';
import { ConfigService } from './config.service';

describe('FootballSync ConfigService', () => {
  let service: ConfigService;

  const mockPrismaService = {
    footballSyncConfig: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockMonitoringService = {
    createAlert: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MonitoringService, useValue: mockMonitoringService },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates default config with event sync disabled', async () => {
    mockPrismaService.footballSyncConfig.findFirst.mockResolvedValue(null);
    mockPrismaService.footballSyncConfig.findUnique.mockResolvedValue(null);
    mockPrismaService.footballSyncConfig.create.mockResolvedValue({
      id: 'default_config',
      enabled: true,
      minSyncInterval: 5,
      maxSyncInterval: 30,
      dailyRequestLimit: 100,
      alertThreshold: 90,
      autoSyncEnabled: true,
      eventSyncEnabled: false,
      eventSyncIntervalMinutes: 1,
      eventWaRedCardEnabled: true,
      peakHoursSyncEnabled: true,
      emergencyModeThreshold: 10,
      notifyOnError: true,
      notifyOnLimit: true,
      updatedBy: null,
      updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      createdAt: new Date('2026-03-28T00:00:00.000Z'),
    });

    const config = await service.getConfig();

    expect(config.eventSyncEnabled).toBe(false);
    expect(mockPrismaService.footballSyncConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventSyncEnabled: false,
      }),
    });
  });

  it('returns event sync enabled only when the module and event toggle are enabled', async () => {
    mockPrismaService.footballSyncConfig.findFirst.mockResolvedValue({
      id: 'default_config',
      enabled: true,
      minSyncInterval: 5,
      maxSyncInterval: 30,
      dailyRequestLimit: 100,
      alertThreshold: 90,
      autoSyncEnabled: true,
      eventSyncEnabled: true,
      eventSyncIntervalMinutes: 1,
      eventWaRedCardEnabled: true,
      peakHoursSyncEnabled: true,
      emergencyModeThreshold: 10,
      notifyOnError: true,
      notifyOnLimit: true,
      updatedBy: null,
      updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      createdAt: new Date('2026-03-28T00:00:00.000Z'),
    });

    await expect(service.isEventSyncEnabled()).resolves.toBe(true);
  });

  it('returns event WA red card enabled when event sync and toggle are on', async () => {
    mockPrismaService.footballSyncConfig.findFirst.mockResolvedValue({
      id: 'default_config',
      enabled: true,
      eventSyncEnabled: true,
      eventWaRedCardEnabled: true,
    });

    await expect(service.isEventWaRedCardEnabled()).resolves.toBe(true);
  });

  it('returns event WA red card disabled when toggle is off', async () => {
    mockPrismaService.footballSyncConfig.findFirst.mockResolvedValue({
      id: 'default_config',
      enabled: true,
      eventSyncEnabled: true,
      eventWaRedCardEnabled: false,
    });

    await expect(service.isEventWaRedCardEnabled()).resolves.toBe(false);
  });

  it('returns event WA yellow card enabled when event sync and toggle are on', async () => {
    mockPrismaService.footballSyncConfig.findFirst.mockResolvedValue({
      id: 'default_config',
      enabled: true,
      eventSyncEnabled: true,
      eventWaYellowCardEnabled: true,
    });

    await expect(service.isEventWaYellowCardEnabled()).resolves.toBe(true);
  });

  it('returns event WA substitution disabled when toggle is off', async () => {
    mockPrismaService.footballSyncConfig.findFirst.mockResolvedValue({
      id: 'default_config',
      enabled: true,
      eventSyncEnabled: true,
      eventWaSubstitutionEnabled: false,
    });

    await expect(service.isEventWaSubstitutionEnabled()).resolves.toBe(false);
  });
});
