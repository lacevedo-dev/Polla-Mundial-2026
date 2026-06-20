import { AutomationTimingConfigService } from './automation-timing-config.service';

describe('AutomationTimingConfigService', () => {
  const prisma = {
    systemConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  } as any;

  let service: AutomationTimingConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AutomationTimingConfigService(prisma);
    prisma.systemConfig.findUnique.mockResolvedValue(null);
    prisma.systemConfig.upsert.mockResolvedValue({});
  });

  it('returns default 1 minute after close when config is missing', async () => {
    await expect(service.getPredictionReportMinutesAfterClose()).resolves.toBe(1);
  });

  it('persists and reads custom minutes after close', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue({
      value: JSON.stringify({ minutes: 2 }),
    });

    await expect(service.getPredictionReportMinutesAfterClose()).resolves.toBe(2);

    await service.updateSettings({ predictionReportMinutesAfterClose: 3 });

    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'automation:prediction_report_minutes_after_close' },
        create: expect.objectContaining({
          value: JSON.stringify({ minutes: 3 }),
        }),
      }),
    );
  });

  it('migrates legacy minutes-before-kickoff values to 1 minute after close', async () => {
    await service.updateSettings({ predictionReportMinutesBefore: 15 });

    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          value: JSON.stringify({ minutes: 1 }),
        }),
      }),
    );
  });
});
