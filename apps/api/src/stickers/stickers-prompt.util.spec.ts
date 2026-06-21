import {
  applyStickerPromptTemplate,
  buildReferenceImagesBlock,
  buildStickerPromptVariables,
  DEFAULT_STICKER_PROMPT_TEMPLATE,
  resolvePlayerNumber,
  type StickerPromptReferenceContext,
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

  const refCtx: StickerPromptReferenceContext = {
    globalReferences: [
      {
        label: 'Image B — Series master',
        promptHint: 'Follow composition exactly.',
        attached: true,
        source: 'bundled',
      },
      {
        label: 'Image C — Logo FIFA 2026',
        promptHint: 'Recreate top-right badge.',
        attached: true,
        source: 'upload',
      },
    ],
    teamReference: {
      label: 'Uniforme selección CIV',
      attached: true,
      source: 'upload',
    },
    teamKitDescription: "Orange home jersey with aqua trim for Côte d'Ivoire.",
  };

  it('resuelve variables del prompt serie Polla', () => {
    const vars = buildStickerPromptVariables(dto, refCtx);
    expect(vars.PLAYER_NAME).toBe('JEAN-PHILIPPE GBAMIN');
    expect(vars.PLAYER_NUMBER).toBe('10');
    expect(vars.COUNTRY_CODE).toBe('CIV');
    expect(vars.HEIGHT).toBe('1,86 m');
    expect(vars.REFERENCE_IMAGES).toContain('Image B — Series master');
    expect(vars.REFERENCE_IMAGES).toContain('Uniforme selección CIV');
  });

  it('reemplaza placeholders {{PLAYER_*}}', () => {
    const prompt = applyStickerPromptTemplate(
      'Name {{PLAYER_NAME}} #{{PLAYER_NUMBER}} code {{COUNTRY_CODE}}',
      dto,
      refCtx,
    );
    expect(prompt).toContain('JEAN-PHILIPPE GBAMIN');
    expect(prompt).toContain('#10');
    expect(prompt).toContain('code CIV');
  });

  it('genera bloque REFERENCE_IMAGES con etiquetas parametrizables', () => {
    const block = buildReferenceImagesBlock(dto, refCtx);
    expect(block).toContain('Image A');
    expect(block).toContain('Image B — Series master (attached');
    expect(block).toContain('Uniforme selección CIV (attached');
  });

  it('usa plantilla por defecto sin placeholders sin reemplazar', () => {
    const prompt = applyStickerPromptTemplate(DEFAULT_STICKER_PROMPT_TEMPLATE, dto, refCtx);
    expect(prompt).toContain('JEAN-PHILIPPE GBAMIN');
    expect(prompt).not.toContain('{{PLAYER_NAME}}');
    expect(prompt).toContain('www.tupollamundial.com');
    expect(prompt).toContain('Image A');
  });

  it('usa 10 solo si no hay mainNumber', () => {
    expect(resolvePlayerNumber({ ...dto, mainNumber: undefined })).toBe('10');
    expect(resolvePlayerNumber({ ...dto, mainNumber: '25' })).toBe('25');
  });
});
