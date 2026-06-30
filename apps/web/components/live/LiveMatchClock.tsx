import React from 'react';
import {
    computeLiveClockState,
    formatLiveClockMinute,
    formatLiveClockSeconds,
    isPenaltyShootoutStatus,
    liveClockProgressPercent,
    resolveClockAnchor,
    type LiveClockAnchor,
} from './liveMatchClock.util';

export interface LiveMatchClockProps {
    matchDate: string;
    elapsed: number | null;
    lastSyncAt: number | null;
    statusShort?: string | null;
    finished?: boolean;
    className?: string;
    /** Muestra el contador M:SS (1:01, 1:02…) junto al minuto de fútbol. */
    showSeconds?: boolean;
    compact?: boolean;
}

const TICK_MS = 1_000;

function useLiveMatchClock(props: LiveMatchClockProps) {
    const { elapsed, lastSyncAt, matchDate, statusShort, finished } = props;
    const [now, setNow] = React.useState(() => Date.now());
    const [anchor, setAnchor] = React.useState<LiveClockAnchor | null>(null);

    React.useEffect(() => {
        if (finished || statusShort === 'FT' || statusShort === 'AET' || statusShort === 'HT') {
            return;
        }
        const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
        return () => window.clearInterval(id);
    }, [finished, statusShort]);

    React.useEffect(() => {
        setAnchor((prev) => resolveClockAnchor(elapsed, lastSyncAt, prev, Date.now()));
    }, [elapsed, lastSyncAt]);

    React.useEffect(() => {
        setNow(Date.now());
    }, [elapsed, lastSyncAt]);

    const state = React.useMemo(
        () =>
            computeLiveClockState({
                matchDate,
                elapsed,
                lastSyncAt,
                statusShort,
                now,
                anchor,
            }),
        [matchDate, elapsed, lastSyncAt, statusShort, now, anchor],
    );

    return state;
}

function ClockFace({
    state,
    showSeconds,
    compact,
}: {
    state: ReturnType<typeof computeLiveClockState>;
    showSeconds?: boolean;
    compact?: boolean;
}) {
    const minuteLabel = formatLiveClockMinute(state);
    const secondsLabel = formatLiveClockSeconds(state);

    if (compact) {
        return <span>{minuteLabel}</span>;
    }

    return (
        <span className="inline-flex items-baseline gap-1">
            <span>{minuteLabel}</span>
            {showSeconds && (
                <span className="text-[8px] font-bold tabular-nums text-rose-400/90">
                    {secondsLabel}
                </span>
            )}
        </span>
    );
}

/** Cronómetro anclado al sync (elapsed) con conteo local por segundos entre polls. */
export function LiveMatchClock({
    matchDate,
    elapsed,
    lastSyncAt,
    statusShort,
    finished,
    className,
    showSeconds = false,
    compact = false,
}: LiveMatchClockProps) {
    const state = useLiveMatchClock({
        matchDate,
        elapsed,
        lastSyncAt,
        statusShort,
        finished,
        className,
        showSeconds,
        compact,
    });

    if (finished || statusShort === 'FT' || statusShort === 'AET') {
        return (
            <span className={`inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-black text-slate-600 ${className ?? ''}`}>
                FT
            </span>
        );
    }

    if (statusShort === 'HT') {
        return (
            <span className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-black text-amber-700 animate-pulse ${className ?? ''}`}>
                Entretiempo
            </span>
        );
    }

    if (isPenaltyShootoutStatus(statusShort)) {
        return (
            <span className={`inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 font-mono text-[10px] font-black text-purple-700 ${className ?? ''}`}>
                Penales
            </span>
        );
    }

    return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-black text-rose-700 ${className ?? ''}`}>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            <ClockFace state={state} showSeconds={showSeconds} compact={compact} />
            {state.halfLabel && !compact && (
                <span className="ml-0.5 text-rose-400">{state.halfLabel}</span>
            )}
        </span>
    );
}

export function LiveMatchClockInline(props: LiveMatchClockProps) {
    return (
        <LiveMatchClock
            {...props}
            compact
            showSeconds={false}
            className={`${props.className ?? ''} px-1.5 py-0.5`.trim()}
        />
    );
}

export function LiveMatchClockProgressBar(
    props: Omit<LiveMatchClockProps, 'showSeconds' | 'compact'>,
) {
    const state = useLiveMatchClock(props);
    const { statusShort, finished } = props;

    if (finished || statusShort === 'FT' || statusShort === 'AET') {
        return (
            <div className="h-0.5 w-full rounded-full bg-slate-200">
                <div className="h-full w-full rounded-full bg-slate-400" />
            </div>
        );
    }

    if (statusShort === 'HT') {
        return (
            <div className="h-0.5 w-full rounded-full bg-amber-100">
                <div className="h-full w-1/2 rounded-full bg-amber-400" />
            </div>
        );
    }

    if (isPenaltyShootoutStatus(statusShort)) {
        return (
            <div className="h-0.5 w-full rounded-full bg-purple-100">
                <div className="h-full w-full rounded-full bg-purple-500" />
            </div>
        );
    }

    const pct = liveClockProgressPercent(state);

    return (
        <div className="h-0.5 w-full rounded-full bg-rose-100">
            <div
                className="h-full rounded-full bg-rose-500 transition-all duration-1000"
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}
