import sharp from 'sharp';
import {
  optimizeOpenAiStickerPng,
  STICKER_DELIVERY_MAX_WIDTH,
} from './stickers-optimize.util';

describe('stickers-optimize.util', () => {
  it('reduce tamaño PNG OpenAI manteniendo dimensiones acotadas', async () => {
    const rawPng = await sharp({
      create: {
        width: 1024,
        height: 1536,
        channels: 3,
        background: { r: 20, g: 120, b: 200 },
      },
    })
      .png()
      .toBuffer();

    const optimized = await optimizeOpenAiStickerPng(rawPng);

    expect(optimized.webp.length).toBeLessThan(rawPng.length);
    expect(optimized.whatsappJpeg.length).toBeLessThan(rawPng.length);

    const meta = await sharp(optimized.webp).metadata();
    expect(meta.width).toBeLessThanOrEqual(STICKER_DELIVERY_MAX_WIDTH);
    expect(meta.format).toBe('webp');
  });
});
