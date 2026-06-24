import { describe, expect, it } from 'vitest';
import {
    buildPremiumStickerLegacyPngPublicPath,
    buildPremiumStickerPublicPath,
    resolveOpenAiStickerLegacyPngUrl,
    resolveOpenAiStickerWebpUrl,
} from './openAiSticker.util';

describe('openAiSticker.util', () => {
    it('builds WebP public path aligned with API cache', () => {
        expect(buildPremiumStickerPublicPath(1642)).toBe('/uploads/stickers/1642-premium.webp');
    });

    it('builds legacy PNG public path for backward compatibility', () => {
        expect(buildPremiumStickerLegacyPngPublicPath(1642)).toBe('/uploads/stickers/1642-premium.png');
    });

    it('resolves absolute WebP URL from BASE_URL', () => {
        expect(resolveOpenAiStickerWebpUrl(77)).toMatch(/\/uploads\/stickers\/77-premium\.webp$/);
    });

    it('resolves absolute legacy PNG URL from BASE_URL', () => {
        expect(resolveOpenAiStickerLegacyPngUrl(77)).toMatch(/\/uploads\/stickers\/77-premium\.png$/);
    });
});
