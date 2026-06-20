export const LIVE_DISPLAY_CONFIG_KEY = 'automation:live_display';

export type LiveDisplaySettings = {
  goals: boolean;
  yellowCards: boolean;
  redCards: boolean;
  substitutions: boolean;
};

export const DEFAULT_LIVE_DISPLAY_SETTINGS: LiveDisplaySettings = {
  goals: true,
  yellowCards: true,
  redCards: true,
  substitutions: true,
};

export function normalizeLiveDisplaySettings(
  input: Partial<LiveDisplaySettings> | null | undefined,
): LiveDisplaySettings {
  const base = DEFAULT_LIVE_DISPLAY_SETTINGS;
  if (!input) return { ...base };
  return {
    goals: input.goals ?? base.goals,
    yellowCards: input.yellowCards ?? base.yellowCards,
    redCards: input.redCards ?? base.redCards,
    substitutions: input.substitutions ?? base.substitutions,
  };
}

export function parseLiveDisplayConfig(
  raw: string | null | undefined,
): LiveDisplaySettings {
  if (!raw) return { ...DEFAULT_LIVE_DISPLAY_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<LiveDisplaySettings>;
    return normalizeLiveDisplaySettings(parsed);
  } catch {
    return { ...DEFAULT_LIVE_DISPLAY_SETTINGS };
  }
}
