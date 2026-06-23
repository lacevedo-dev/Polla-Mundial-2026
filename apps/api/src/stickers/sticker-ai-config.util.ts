export type StickerAiModelId =
  | 'gpt-image-2'
  | 'gpt-image-1.5'
  | 'gpt-image-1'
  | 'gpt-image-1-mini';

export type StickerAiModelOption = {
  id: StickerAiModelId;
  label: string;
  description: string;
};

/** Modelos soportados por images.edit para stickers premium. */
export const STICKER_AI_MODEL_OPTIONS: StickerAiModelOption[] = [
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    description: 'Máxima calidad visual (recomendado para producción).',
  },
  {
    id: 'gpt-image-1.5',
    label: 'GPT Image 1.5',
    description: 'Alternativa de alta calidad con costo intermedio.',
  },
  {
    id: 'gpt-image-1-mini',
    label: 'GPT Image 1 Mini',
    description:
      'Más económico (~70% menos en salida imagen vs GPT Image 2). Ideal para alto volumen de goles en vivo.',
  },
  {
    id: 'gpt-image-1',
    label: 'GPT Image 1',
    description: 'Generación clásica; útil si 1.5 o 2 no están disponibles en tu cuenta.',
  },
];

export const DEFAULT_STICKER_AI_MODEL: StickerAiModelId = 'gpt-image-2';

const ALLOWED_MODEL_IDS = new Set<string>(STICKER_AI_MODEL_OPTIONS.map((m) => m.id));

export function isAllowedStickerAiModel(model: string): model is StickerAiModelId {
  return ALLOWED_MODEL_IDS.has(model.trim());
}

export function normalizeStickerAiModel(model: string | null | undefined): StickerAiModelId {
  const trimmed = (model ?? '').trim();
  if (isAllowedStickerAiModel(trimmed)) return trimmed;
  return DEFAULT_STICKER_AI_MODEL;
}
