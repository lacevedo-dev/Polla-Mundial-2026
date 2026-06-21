import {
  applyStickerPromptTemplate,
  buildStickerPromptVariables,
  DEFAULT_STICKER_PROMPT_TEMPLATE,
  resolvePlayerNumber,
} from './stickers-prompt.util';

describe('stickers-prompt.util', () => {
  const dto = {
    playerApiFootballId: 1642,
    photoUrl: 'https://example.com/p.png',
    playerName: 'Jean-Philippe Gbamin',
    birthDate: '25-09-1995',
    height: '1,86m',
    weight: '83 kg',
    countryCode: 'CIV',
    countryName: "Côte d'Ivoire",
    cardCode: 'CIV 010',
    stickerNumber: '106',
    mainNumber: '10',
  };

  it('resuelve variables del prompt serie Polla', () => {
    const vars = buildStickerPromptVariables(dto);
    expect(vars.PLAYER_NAME).toBe('JEAN-PHILIPPE GBAMIN');
    expect(vars.PLAYER_NUMBER).toBe('10');
    expect(vars.COUNTRY_CODE).toBe('CIV');
    expect(vars.HEIGHT).toBe('1,86 m');
    expect(vars.digitLeft).toBe('2');
    expect(vars.digitRight).toBe('6');
  });

  it('reemplaza placeholders {{PLAYER_*}}', () => {
    const prompt = applyStickerPromptTemplate(
      'Name {{PLAYER_NAME}} #{{PLAYER_NUMBER}} code {{COUNTRY_CODE}}',
      dto,
    );
    expect(prompt).toContain('JEAN-PHILIPPE GBAMIN');
    expect(prompt).toContain('#10');
    expect(prompt).toContain('code CIV');
  });

  it('usa plantilla por defecto sin placeholders sin reemplazar', () => {
    const prompt = applyStickerPromptTemplate(DEFAULT_STICKER_PROMPT_TEMPLATE, dto);
    expect(prompt).toContain('JEAN-PHILIPPE GBAMIN');
    expect(prompt).not.toContain('{{PLAYER_NAME}}');
    expect(prompt).toContain('www.tupollamundial.com');
  });

  it('usa 10 solo si no hay mainNumber', () => {
    expect(resolvePlayerNumber({ ...dto, mainNumber: undefined })).toBe('10');
    expect(resolvePlayerNumber({ ...dto, mainNumber: '25' })).toBe('25');
  });
});
