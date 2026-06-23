import sharp from 'sharp';

/** Ancho máximo para stickers en web / WhatsApp (OpenAI entrega 1024×1536). */
export const STICKER_DELIVERY_MAX_WIDTH = 720;

/** Calidad WebP para álbum admin y descarga HTTP. */
export const STICKER_WEBP_QUALITY = 82;

/** Calidad JPEG para envío por WhatsApp (menor peso, buena nitidez). */
export const STICKER_WHATSAPP_JPEG_QUALITY = 88;

export type OptimizedPremiumSticker = {
  webp: Buffer;
  whatsappJpeg: Buffer;
};

function resizePipeline(input: sharp.Sharp): sharp.Sharp {
  return input.resize({
    width: STICKER_DELIVERY_MAX_WIDTH,
    fit: 'inside',
    withoutEnlargement: true,
  });
}

/** Comprime PNG de OpenAI a WebP + JPEG listos para producción. */
export async function optimizeOpenAiStickerPng(
  pngBuffer: Buffer,
): Promise<OptimizedPremiumSticker> {
  const base = resizePipeline(sharp(pngBuffer, { failOn: 'none' }));

  const [webp, whatsappJpeg] = await Promise.all([
    base
      .clone()
      .webp({ quality: STICKER_WEBP_QUALITY, effort: 4, smartSubsample: true })
      .toBuffer(),
    base
      .clone()
      .jpeg({
        quality: STICKER_WHATSAPP_JPEG_QUALITY,
        mozjpeg: true,
        chromaSubsampling: '4:4:4',
      })
      .toBuffer(),
  ]);

  return { webp, whatsappJpeg };
}

/** Convierte WebP cacheado (o PNG legado) a JPEG para WhatsApp. */
export async function stickerFileToWhatsappJpeg(fileBuffer: Buffer): Promise<Buffer> {
  return resizePipeline(sharp(fileBuffer, { failOn: 'none' }))
    .jpeg({
      quality: STICKER_WHATSAPP_JPEG_QUALITY,
      mozjpeg: true,
      chromaSubsampling: '4:4:4',
    })
    .toBuffer();
}
