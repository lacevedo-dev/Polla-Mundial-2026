import {
  DEFAULT_STICKER_AI_MODEL,
  isAllowedStickerAiModel,
  normalizeStickerAiModel,
  STICKER_AI_MODEL_OPTIONS,
} from './sticker-ai-config.util';

describe('sticker-ai-config.util', () => {
  it('incluye gpt-image-1-mini como modelo permitido', () => {
    expect(STICKER_AI_MODEL_OPTIONS.map((m) => m.id)).toContain('gpt-image-1-mini');
    expect(isAllowedStickerAiModel('gpt-image-1-mini')).toBe(true);
  });

  it('normaliza modelos desconocidos al default', () => {
    expect(normalizeStickerAiModel('gpt-image-1-mini')).toBe('gpt-image-1-mini');
    expect(normalizeStickerAiModel('gpt-unknown')).toBe(DEFAULT_STICKER_AI_MODEL);
    expect(normalizeStickerAiModel('')).toBe(DEFAULT_STICKER_AI_MODEL);
  });
});
