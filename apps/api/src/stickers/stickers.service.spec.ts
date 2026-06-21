import { StickersService } from './stickers.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildPremiumStickerFileName,
  buildPremiumStickerPublicUrl,
} from './stickers-cache.util';

describe('StickersService cache', () => {
  const playerApiFootballId = 1642;
  let tmpUploads: string;
  let service: StickersService;
  let prisma: {
    playerProfile: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(() => {
    tmpUploads = fs.mkdtempSync(path.join(os.tmpdir(), 'stickers-svc-'));
    prisma = {
      playerProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const stickerAiConfig = {
      getRuntimeConfig: jest.fn().mockResolvedValue({
        apiKey: null,
        model: 'gpt-image-2',
        quality: 'high',
        promptTemplate: 'test prompt',
      }),
      isEnvApiKeyConfigured: jest.fn().mockReturnValue(false),
    };

    service = new StickersService(
      {
        get: (key: string) => {
          if (key === 'UPLOADS_DIR') return tmpUploads;
          return undefined;
        },
      } as never,
      prisma as never,
      stickerAiConfig as never,
    );
  });

  afterEach(() => {
    fs.rmSync(tmpUploads, { recursive: true, force: true });
  });

  it('returns cached sticker without calling OpenAI when file exists', async () => {
    const stickersDir = path.join(tmpUploads, 'stickers');
    fs.mkdirSync(stickersDir, { recursive: true });
    fs.writeFileSync(
      path.join(stickersDir, buildPremiumStickerFileName(playerApiFootballId)),
      Buffer.from('cached-png'),
    );

    prisma.playerProfile.findUnique.mockResolvedValue({
      premiumStickerUrl: buildPremiumStickerPublicUrl(playerApiFootballId),
    });

    const result = await service.getOrGenerateSticker({
      playerApiFootballId,
      photoUrl: 'https://media.api-sports.io/football/players/1642.png',
      playerName: 'TEST PLAYER',
      birthDate: '1-1-1990',
      height: '1,80m',
      weight: '75 kg',
      countryCode: 'COL',
      countryName: 'Colombia',
      cardCode: 'COL10',
      stickerNumber: '100',
      mainNumber: '10',
    });

    expect(result.cached).toBe(true);
    expect(result.imageUrl).toBe(buildPremiumStickerPublicUrl(playerApiFootballId));
    expect(prisma.playerProfile.upsert).not.toHaveBeenCalled();
  });
});
