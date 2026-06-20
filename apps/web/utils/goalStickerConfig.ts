export type GoalStickerVariant = 'classic' | 'premium';

export type GoalStickerSettings = {
    enabled: boolean;
    dashboard: boolean;
    whatsappGroup: boolean;
    variant: GoalStickerVariant;
};

export const DEFAULT_GOAL_STICKER_SETTINGS: GoalStickerSettings = {
    enabled: false,
    dashboard: false,
    whatsappGroup: false,
    variant: 'classic',
};

export function isGoalStickerActiveFor(
    settings: GoalStickerSettings,
    destination: 'dashboard' | 'whatsappGroup',
): boolean {
    if (!settings.enabled) return false;
    return destination === 'dashboard' ? settings.dashboard : settings.whatsappGroup;
}
