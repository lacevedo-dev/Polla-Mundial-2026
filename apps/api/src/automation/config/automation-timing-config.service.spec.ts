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

  it('returns default 15 minutes when config is missing', async () => {
    await expect(service.getPredictionReportMinutesBefore()).resolves.toBe(15);
  });

  it('persists and reads custom minutes before kickoff', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue({
      value: JSON.stringify({ minutes: 20 }),
    });

    await expect(service.getPredictionReportMinutesBefore()).resolves.toBe(20);

    await service.updateSettings({ predictionReportMinutesBefore: 25 });

    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'automation:prediction_report_minutes_before' },
        create: expect.objectContaining({
          value: JSON.stringify({ minutes: 25 }),
        }),
      }),
    );
  });
});
