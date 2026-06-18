import React from 'react';
import {
    LiveMatchClock,
    LiveMatchClockInline,
    LiveMatchClockProgressBar,
    type LiveMatchClockProps,
} from './LiveMatchClock';

export type { LiveMatchClockProps as LiveMatchTimerProps };

/** @deprecated Usa LiveMatchClock. Wrapper para compatibilidad. */
export function LiveMatchTimer(props: LiveMatchClockProps) {
    return <LiveMatchClock {...props} showSeconds />;
}

/** @deprecated Usa LiveMatchClockInline. */
export function LiveMatchTimerInline(props: LiveMatchClockProps) {
    return <LiveMatchClockInline {...props} />;
}

/** @deprecated Usa LiveMatchClockProgressBar. */
export function MatchProgressBar(props: LiveMatchClockProps) {
    return <LiveMatchClockProgressBar {...props} />;
}
