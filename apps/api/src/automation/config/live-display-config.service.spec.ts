import { LiveDisplayConfigService } from './live-display-config.service';

describe('LiveDisplayConfigService', () => {
  const prisma = {
    systemConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  let service: LiveDisplayConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LiveDisplayConfigService(prisma as never);
  });

  it('devuelve defaults si no hay config', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue(null);
    await expect(service.getSettings()).resolves.toEqual({
      goals: true,
      yellowCards: true,
      redCards: true,
      substitutions: true,
    });
  });

  it('persiste toggles parciales', async () => {
    prisma.systemConfig.findUnique.mockResolvedValue({
      value: JSON.stringify({
        goals: true,
        yellowCards: true,
        redCards: true,
        substitutions: true,
      }),
    });
    prisma.systemConfig.upsert.mockResolvedValue({});

    const result = await service.updateSettings({ goals: false, substitutions: false });

    expect(result).toEqual({
      goals: false,
      yellowCards: true,
      redCards: true,
      substitutions: false,
    });
    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          value: JSON.stringify({
            goals: false,
            yellowCards: true,
            redCards: true,
            substitutions: false,
          }),
        },
      }),
    );
  });
});
