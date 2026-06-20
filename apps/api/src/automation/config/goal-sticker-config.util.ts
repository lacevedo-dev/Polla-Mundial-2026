export const GOAL_STICKER_CONFIG_KEY = 'automation:goal_sticker';

export type GoalStickerVariant = 'classic' | 'premium';

/** Dónde se muestra / envía el sticker estilo Panini al marcar un gol. */
export type GoalStickerSettings = {
  /** Interruptor maestro: desactiva sticker en todos los destinos. */
  enabled: boolean;
  /** Tarjeta Panini en el panel EN VIVO del dashboard (partido expandido). */
  dashboard: boolean;
  /** Imagen PNG adjunta al mensaje GOAL_SCORED en el grupo de WhatsApp de la polla. */
  whatsappGroup: boolean;
  /** classic = diseño compacto actual; premium = estilo álbum Panini en capas. */
  variant: GoalStickerVariant;
};

export const DEFAULT_GOAL_STICKER_SETTINGS: GoalStickerSettings = {
  enabled: false,
  dashboard: false,
  whatsappGroup: false,
  variant: 'classic',
};

export function normalizeGoalStickerSettings(
  input: Partial<GoalStickerSettings> | null | undefined,
): GoalStickerSettings {
  const base = DEFAULT_GOAL_STICKER_SETTINGS;
  if (!input) return { ...base };

  const enabled = input.enabled ?? base.enabled;
  return {
    enabled,
    dashboard: enabled ? (input.dashboard ?? base.dashboard) : false,
    whatsappGroup: enabled ? (input.whatsappGroup ?? base.whatsappGroup) : false,
    variant: input.variant === 'premium' ? 'premium' : 'classic',
  };
}

export function parseGoalStickerConfig(
  raw: string | null | undefined,
): GoalStickerSettings {
  if (!raw) return { ...DEFAULT_GOAL_STICKER_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<GoalStickerSettings>;
    return normalizeGoalStickerSettings(parsed);
  } catch {
    return { ...DEFAULT_GOAL_STICKER_SETTINGS };
  }
}

export function isGoalStickerActiveFor(
  settings: GoalStickerSettings,
  destination: 'dashboard' | 'whatsappGroup',
): boolean {
  if (!settings.enabled) return false;
  return destination === 'dashboard' ? settings.dashboard : settings.whatsappGroup;
}
