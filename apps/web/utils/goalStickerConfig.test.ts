import { describe, expect, it } from 'vitest';
import {
    DEFAULT_GOAL_STICKER_SETTINGS,
    isGoalStickerActiveFor,
} from './goalStickerConfig';

describe('goalStickerConfig', () => {
    it('requires master enabled for any destination', () => {
        expect(
            isGoalStickerActiveFor(
                { enabled: false, dashboard: true, whatsappGroup: true },
                'dashboard',
            ),
        ).toBe(false);
    });

    it('activates only configured destinations', () => {
        const settings = {
            enabled: true,
            dashboard: true,
            whatsappGroup: false,
        };
        expect(isGoalStickerActiveFor(settings, 'dashboard')).toBe(true);
        expect(isGoalStickerActiveFor(settings, 'whatsappGroup')).toBe(false);
    });

    it('defaults to all off', () => {
        expect(DEFAULT_GOAL_STICKER_SETTINGS).toEqual({
            enabled: false,
            dashboard: false,
            whatsappGroup: false,
        });
    });
});
