import React from 'react';
import { probeOpenAiStickerUrl, resolveOpenAiStickerUrl } from '../utils/openAiSticker.util';

export function useOpenAiStickerImage(
    playerExternalId: number | null | undefined,
): { imageUrl: string | null; loading: boolean } {
    const [imageUrl, setImageUrl] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (playerExternalId == null) {
            setImageUrl(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        const url = resolveOpenAiStickerUrl(playerExternalId);
        setLoading(true);
        setImageUrl(null);

        void probeOpenAiStickerUrl(url).then((ok) => {
            if (cancelled) return;
            setImageUrl(ok ? url : null);
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [playerExternalId]);

    return { imageUrl, loading };
}
