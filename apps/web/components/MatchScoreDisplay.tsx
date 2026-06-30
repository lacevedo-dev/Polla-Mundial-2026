import React from 'react';

export type MatchScoreDisplayProps = {
    homeScore?: number | null;
    awayScore?: number | null;
    penaltyHomeScore?: number | null;
    penaltyAwayScore?: number | null;
    className?: string;
    scoreClassName?: string;
    penaltyClassName?: string;
    separatorClassName?: string;
};

/** Marcador 90'+ET con penales en superíndice reducido: 1⁽⁴⁾ – 1⁽³⁾ */
export function MatchScoreDisplay({
    homeScore,
    awayScore,
    penaltyHomeScore,
    penaltyAwayScore,
    className,
    scoreClassName = 'font-black',
    penaltyClassName = 'text-[0.58em] font-bold leading-none opacity-70',
    separatorClassName,
}: MatchScoreDisplayProps) {
    const h = homeScore ?? 0;
    const a = awayScore ?? 0;
    const hasPenalties = penaltyHomeScore != null && penaltyAwayScore != null;

    return (
        <span className={`inline-flex items-baseline tabular-nums leading-none ${className ?? ''}`}>
            <span className={scoreClassName}>
                {h}
                {hasPenalties && (
                    <span className={penaltyClassName}> ({penaltyHomeScore})</span>
                )}
            </span>
            <span className={separatorClassName ?? scoreClassName}>–</span>
            <span className={scoreClassName}>
                {a}
                {hasPenalties && (
                    <span className={penaltyClassName}> ({penaltyAwayScore})</span>
                )}
            </span>
        </span>
    );
}
