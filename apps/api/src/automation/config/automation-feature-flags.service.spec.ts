import { BadRequestException } from '@nestjs/common';
import { AutomationFeatureFlagsService } from './automation-feature-flags.service';

describe('AutomationFeatureFlagsService', () => {
  const originalEnv = process.env;

  const prismaMock = {
    systemConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  let service: AutomationFeatureFlagsService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.AUTOMATION_PRE_MATCH_V2;
    delete process.env.AUTOMATION_LIVE_PHASE_V2;
    delete process.env.AUTOMATION_POST_MATCH_V2;
    service = new AutomationFeatureFlagsService(prismaMock as never);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('devuelve defaults: pre/live v2 ON, post v2 OFF sin env ni BD', async () => {
    prismaMock.systemConfig.findUnique.mockResolvedValue(null);

    await expect(service.isPreMatchV2Enabled()).resolves.toBe(true);
    await expect(service.isLivePhaseV2Enabled()).resolves.toBe(true);
    await expect(service.isPostMatchV2Enabled()).resolves.toBe(false);
    expect(await service.getAllFlagStates()).toEqual({
      preMatchV2: { enabled: true, source: 'default', locked: false },
      livePhaseV2: { enabled: true, source: 'default', locked: false },
      postMatchV2: { enabled: false, source: 'default', locked: false },
    });
  });

  it('prioriza env sobre BD y marca locked', async () => {
    process.env.AUTOMATION_PRE_MATCH_V2 = 'true';
    prismaMock.systemConfig.findUnique.mockResolvedValue({ value: 'false' });

    await expect(service.isPreMatchV2Enabled()).resolves.toBe(true);
    expect(await service.getAllFlagStates()).toMatchObject({
      preMatchV2: { enabled: true, source: 'env', locked: true },
    });
  });

  it('lee valor de BD cuando no hay env', async () => {
    prismaMock.systemConfig.findUnique.mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === 'automation:live_phase_v2') {
        return Promise.resolve({ value: 'true' });
      }
      return Promise.resolve(null);
    });

    await expect(service.isLivePhaseV2Enabled()).resolves.toBe(true);
  });

  it('persiste flag en SystemConfig', async () => {
    prismaMock.systemConfig.upsert.mockResolvedValue({});

    await service.setFlag('postMatchV2', true);

    expect(prismaMock.systemConfig.upsert).toHaveBeenCalledWith({
      where: { key: 'automation:post_match_v2' },
      create: { key: 'automation:post_match_v2', value: 'true' },
      update: { value: 'true' },
    });
  });

  it('rechaza setFlag cuando env fija el valor', async () => {
    process.env.AUTOMATION_PRE_MATCH_V2 = 'false';

    await expect(service.setFlag('preMatchV2', true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.systemConfig.upsert).not.toHaveBeenCalled();
  });
});
