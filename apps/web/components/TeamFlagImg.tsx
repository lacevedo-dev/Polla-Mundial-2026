import React from 'react';
import { resolveTeamFlagUrl } from '../lib/team-flag';

type TeamFlagImgProps = {
    flagUrl?: string | null;
    code?: string | null;
    name: string;
    className?: string;
};

export const TeamFlagImg: React.FC<TeamFlagImgProps> = ({ flagUrl, code, name, className }) => {
    const [failed, setFailed] = React.useState(false);
    const src = resolveTeamFlagUrl(flagUrl, code);

    React.useEffect(() => {
        setFailed(false);
    }, [src]);

    if (!src || failed) {
        return <div className={className} aria-hidden="true" />;
    }

    return (
        <img
            src={src}
            alt={name}
            className={className}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
        />
    );
};
