import { GoalStickerConfigService } from './goal-sticker-config.service';

describe('GoalStickerConfigService', () => {
  const prisma = {
    systemConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  let service: GoalStickerConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GoalStickerConfigService(prisma as never);
  });

  it('returns defaults when config is missing', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue(null);
    await expect(service.getSettings()).resolves.toEqual({
      enabled: false,
      dashboard: false,
      whatsappGroup: false,
    });
  });

  it('normalizes settings so destinations require enabled master switch', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: false, dashboard: true, whatsappGroup: true }),
    });
    await expect(service.getSettings()).resolves.toEqual({
      enabled: false,
      dashboard: false,
      whatsappGroup: false,
    });
  });

  it('persists merged settings on update', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue(null);
    prisma.systemConfig.upsert.mockResolvedValue({});

    const result = await service.updateSettings({
      enabled: true,
      dashboard: true,
    });

    expect(result).toEqual({
      enabled: true,
      dashboard: true,
      whatsappGroup: false,
    });
    expect(prisma.systemConfig.upsert).toHaveBeenCalled();
  });
});
