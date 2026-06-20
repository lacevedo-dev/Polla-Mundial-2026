import { buildPremiumStickerPrompt } from './stickers-prompt.util';
import type { GenerateStickerDto } from './dto/generate-sticker.dto';

describe('buildPremiumStickerPrompt', () => {
  const baseDto: GenerateStickerDto = {
    playerApiFootballId: 1642,
    photoUrl: 'https://media.api-sports.io/football/players/1642.png',
    playerName: 'JEAN-PHILIPPE GBAMIN',
    birthDate: '25-09-1995',
    height: '1,86m',
    weight: '83 kg',
    countryCode: 'CIV',
    countryName: "Côte d'Ivoire",
    cardCode: 'FCM27',
    stickerNumber: '261',
    mainNumber: '25',
  };

  it('includes player identity and footer codes', () => {
    const prompt = buildPremiumStickerPrompt(baseDto);
    expect(prompt).toContain('JEAN-PHILIPPE GBAMIN');
    expect(prompt).toContain('FCM27');
    expect(prompt).toContain('261');
    expect(prompt).toContain('CIV');
  });

  it('derives background digits from mainNumber', () => {
    const prompt = buildPremiumStickerPrompt({ ...baseDto, mainNumber: '25' });
    expect(prompt).toContain('orange "2"');
    expect(prompt).toContain('green "5"');
  });
});
