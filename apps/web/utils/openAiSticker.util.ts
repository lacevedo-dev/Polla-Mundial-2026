import { BASE_URL } from '../api';

export function resolveOpenAiStickerUrl(playerApiFootballId: number): string {
    const base = BASE_URL.replace(/\/$/, '');
    return `${base}/uploads/stickers/${playerApiFootballId}-premium.png`;
}

/** Comprueba si existe PNG cacheado de OpenAI en /uploads/stickers. */
export function probeOpenAiStickerUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}
