import React from 'react';
import { resolveAvailableOpenAiStickerUrl } from '../utils/openAiSticker.util';

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
        setLoading(true);
        setImageUrl(null);

        void resolveAvailableOpenAiStickerUrl(playerExternalId).then((url) => {
            if (cancelled) return;
            setImageUrl(url);
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [playerExternalId]);

    return { imageUrl, loading };
}
