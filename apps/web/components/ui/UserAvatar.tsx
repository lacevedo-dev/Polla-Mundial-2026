import React from 'react';
import { resolveApiAssetUrl } from '../../api';

export function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) {
        const word = parts[0];
        return (word.length >= 2 ? word.slice(0, 2) : word).toUpperCase();
    }
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Resuelve la URL del avatar; devuelve undefined si no hay imagen válida. */
export function resolveUserAvatarSrc(avatar?: string | null): string | undefined {
    const trimmed = avatar?.trim();
    if (!trimmed || trimmed.includes('ui-avatars.com')) {
        return undefined;
    }

    return resolveApiAssetUrl(trimmed) ?? (
        trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')
            ? trimmed
            : undefined
    );
}

export interface UserAvatarProps {
    name: string;
    src?: string | null;
    className?: string;
    textClassName?: string;
    imgClassName?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
    name,
    src,
    className = 'h-10 w-10 rounded-full',
    textClassName = 'text-xs',
    imgClassName,
}) => {
    const resolvedSrc = React.useMemo(() => resolveUserAvatarSrc(src), [src]);
    const [imageFailed, setImageFailed] = React.useState(false);

    React.useEffect(() => {
        setImageFailed(false);
    }, [resolvedSrc]);

    const showImage = Boolean(resolvedSrc && !imageFailed);
    const initials = getInitials(name);

    return (
        <div
            className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-slate-200 font-black uppercase text-slate-600 ${className}`}
            role={showImage ? undefined : 'img'}
            aria-label={showImage ? undefined : name}
        >
            {showImage ? (
                <img
                    src={resolvedSrc}
                    alt=""
                    className={`h-full w-full object-cover ${imgClassName ?? ''}`}
                    onError={() => setImageFailed(true)}
                    loading="lazy"
                    decoding="async"
                />
            ) : (
                <span className={textClassName} aria-hidden="true">
                    {initials}
                </span>
            )}
        </div>
    );
};
