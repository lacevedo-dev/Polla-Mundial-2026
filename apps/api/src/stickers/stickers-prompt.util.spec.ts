import {
  applyStickerPromptTemplate,
  DEFAULT_STICKER_PROMPT_TEMPLATE,
} from './stickers-prompt.util';

describe('stickers-prompt.util', () => {
  const dto = {
    playerApiFootballId: 1,
    photoUrl: 'https://example.com/p.png',
    playerName: 'JEAN-PHILIPPE GBAMIN',
    birthDate: '25-09-1995',
    height: '1,86m',
    weight: '83 kg',
    countryCode: 'CIV',
    countryName: "Côte d'Ivoire",
    cardCode: 'CIV27',
    stickerNumber: '261',
    mainNumber: '25',
  };

  it('reemplaza placeholders del prompt', () => {
    const prompt = applyStickerPromptTemplate(
      'Player {{playerName}} #{{mainNumber}} {{digitLeft}}/{{digitRight}}',
      dto,
    );
    expect(prompt).toContain('JEAN-PHILIPPE GBAMIN');
    expect(prompt).toContain('#25');
    expect(prompt).toContain('2/5');
  });

  it('usa plantilla por defecto si no hay custom', () => {
    const prompt = applyStickerPromptTemplate(DEFAULT_STICKER_PROMPT_TEMPLATE, dto);
    expect(prompt).toContain('JEAN-PHILIPPE GBAMIN');
    expect(prompt).not.toContain('{{playerName}}');
  });
});
