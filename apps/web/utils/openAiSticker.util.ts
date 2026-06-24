import { BASE_URL } from '../api';

export const PREMIUM_STICKER_WEBP_SUFFIX = '-premium.webp';
export const PREMIUM_STICKER_LEGACY_PNG_SUFFIX = '-premium.png';

function buildAbsoluteUploadUrl(relativePath: string): string {
    const base = BASE_URL.replace(/\/$/, '');
    const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    return `${base}${path}`;
}

export function buildPremiumStickerPublicPath(playerApiFootballId: number): string {
    return `/uploads/stickers/${playerApiFootballId}${PREMIUM_STICKER_WEBP_SUFFIX}`;
}

export function buildPremiumStickerLegacyPngPublicPath(playerApiFootballId: number): string {
    return `/uploads/stickers/${playerApiFootballId}${PREMIUM_STICKER_LEGACY_PNG_SUFFIX}`;
}

/** URL absoluta del sticker optimizado (WebP) en /uploads/stickers. */
export function resolveOpenAiStickerWebpUrl(playerApiFootballId: number): string {
    return buildAbsoluteUploadUrl(buildPremiumStickerPublicPath(playerApiFootballId));
}

/** URL absoluta del PNG legado (pre-optimización). */
export function resolveOpenAiStickerLegacyPngUrl(playerApiFootballId: number): string {
    return buildAbsoluteUploadUrl(buildPremiumStickerLegacyPngPublicPath(playerApiFootballId));
}

/** @deprecated Preferir resolveOpenAiStickerWebpUrl o resolveAvailableOpenAiStickerUrl */
export function resolveOpenAiStickerUrl(playerApiFootballId: number): string {
    return resolveOpenAiStickerWebpUrl(playerApiFootballId);
}

/** Comprueba si la URL de sticker responde con una imagen válida. */
export function probeOpenAiStickerUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

/** Resuelve WebP optimizado; si no existe, prueba PNG legado. */
export async function resolveAvailableOpenAiStickerUrl(
    playerApiFootballId: number,
): Promise<string | null> {
    const webpUrl = resolveOpenAiStickerWebpUrl(playerApiFootballId);
    if (await probeOpenAiStickerUrl(webpUrl)) return webpUrl;

    const legacyPngUrl = resolveOpenAiStickerLegacyPngUrl(playerApiFootballId);
    if (await probeOpenAiStickerUrl(legacyPngUrl)) return legacyPngUrl;

    return null;
}
