export type GoalStickerSettings = {
    enabled: boolean;
    dashboard: boolean;
    whatsappGroup: boolean;
};

export const DEFAULT_GOAL_STICKER_SETTINGS: GoalStickerSettings = {
    enabled: false,
    dashboard: false,
    whatsappGroup: false,
};

export function isGoalStickerActiveFor(
    settings: GoalStickerSettings,
    destination: 'dashboard' | 'whatsappGroup',
): boolean {
    if (!settings.enabled) return false;
    return destination === 'dashboard' ? settings.dashboard : settings.whatsappGroup;
}
