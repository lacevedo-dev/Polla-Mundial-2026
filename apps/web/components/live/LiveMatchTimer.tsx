import React from 'react';

interface Props {
    matchDate: string;       // ISO — kickoff time
    elapsed: number | null;  // last known minute from API (null if no sync yet)
    lastSyncAt: number | null; // timestamp ms of last sync
    statusShort?: string | null; // '1H', 'HT', '2H', 'ET', 'FT', etc.
    finished?: boolean;
    className?: string;
}

interface ComputedTime {
    minute: number;    // minuto real (puede ser >45 o >90)
    base: number;      // 45 o 90 según el periodo
    stoppage: number;  // minutos de tiempo añadido (0 si no hay)
    isStoppage: boolean;
}

function computeMinute(
    matchDate: string,
    elapsed: number | null,
    lastSyncAt: number | null,
    statusShort?: string | null,
): ComputedTime {
    const now = Date.now();

    // Periodos fijos
    const base = (statusShort === '2H' || statusShort === 'ET') ? 90 : 45;

    if (statusShort === 'HT')  return { minute: 45,  base: 45,  stoppage: 0, isStoppage: false };
    if (statusShort === 'FT' || statusShort === 'AET') return { minute: 90, base: 90, stoppage: 0, isStoppage: false };
    if (statusShort === 'PEN') return { minute: 120, base: 120, stoppage: 0, isStoppage: false };

    if (elapsed !== null && lastSyncAt !== null) {
        const minutesSinceSync = Math.floor((now - lastSyncAt) / 60000);
        const current = elapsed + minutesSinceSync;
        const capped   = Math.min(current, base + 15); // hasta +15 de tiempo añadido
        const stoppage = Math.max(0, capped - base);
        return { minute: capped, base, stoppage, isStoppage: stoppage > 0 };
    }

    // Fallback desde la hora de inicio
    const kickoff = new Date(matchDate).getTime();
    if (now < kickoff) return { minute: 0, base, stoppage: 0, isStoppage: false };
    const raw      = Math.floor((now - kickoff) / 60000);
    const capped   = Math.min(raw, 95);
    const stop     = Math.max(0, capped - base);
    return { minute: capped, base, stoppage: stop, isStoppage: stop > 0 };
}

function halfLabel(statusShort?: string | null): string | null {
    if (statusShort === '1H')  return '1T';
    if (statusShort === 'HT')  return 'ET';
    if (statusShort === '2H')  return '2T';
    if (statusShort === 'ET')  return 'Prórroga';
    if (statusShort === 'PEN') return 'Penales';
    return null;
}

export function LiveMatchTimer({ matchDate, elapsed, lastSyncAt, statusShort, finished }: Props) {
    const [, setTick] = React.useState(0);

    React.useEffect(() => {
        if (finished) return;
        const interval = setInterval(() => setTick(t => t + 1), 30_000);
        return () => clearInterval(interval);
    }, [finished]);

    if (finished || statusShort === 'FT' || statusShort === 'AET') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-black text-slate-600">
                FT
            </span>
        );
    }

    if (statusShort === 'HT') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-black text-amber-700 animate-pulse">
                Entretiempo
            </span>
        );
    }

    if (statusShort === 'PEN') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 font-mono text-[10px] font-black text-purple-700">
                Penales
            </span>
        );
    }

    const { base, stoppage, isStoppage } = computeMinute(matchDate, elapsed, lastSyncAt, statusShort);
    const half = halfLabel(statusShort);

    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-black text-rose-700">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            {isStoppage ? (
                <>{base}<span className="text-rose-400">+{stoppage}</span><span className="text-[8px]">'</span></>
            ) : (
                <>{base}<span className="text-[8px]">'</span></>
            )}
            {half && <span className="ml-0.5 text-rose-400">{half}</span>}
        </span>
    );
}

/** Compact inline version for table rows */
export function LiveMatchTimerInline({ matchDate, elapsed, lastSyncAt, statusShort, finished, className }: Props) {
    const [, setTick] = React.useState(0);

    React.useEffect(() => {
        if (finished) return;
        const interval = setInterval(() => setTick(t => t + 1), 30_000);
        return () => clearInterval(interval);
    }, [finished]);

    if (statusShort === 'HT')  return <span className={`font-mono text-[9px] font-black text-amber-600 ${className || ''}`}>HT</span>;
    if (statusShort === 'FT' || statusShort === 'AET') return <span className={`font-mono text-[9px] font-black text-slate-500 ${className || ''}`}>FT</span>;
    if (statusShort === 'PEN') return <span className={`font-mono text-[9px] font-black text-purple-600 ${className || ''}`}>PEN</span>;

    const { base, stoppage, isStoppage } = computeMinute(matchDate, elapsed, lastSyncAt, statusShort);

    return (
        <span className={`inline-flex items-center rounded-full bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-rose-700 ${className || ''}`}>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            {isStoppage ? (
                <>{base}<span className="text-rose-400">+{stoppage}</span><span className="text-[8px]">'</span></>
            ) : (
                <>{base}<span className="text-[8px]">'</span></>
            )}
        </span>
    );
}

/** Barra de progreso visual del partido (0–100%) */
export function MatchProgressBar({
    matchDate, elapsed, lastSyncAt, statusShort, finished,
}: Props) {
    const [, setTick] = React.useState(0);

    React.useEffect(() => {
        if (finished) return;
        const interval = setInterval(() => setTick(t => t + 1), 30_000);
        return () => clearInterval(interval);
    }, [finished]);

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

    const { minute } = computeMinute(matchDate, elapsed, lastSyncAt, statusShort);
    // Normalize to 0–100% over 90 minutes (cap at 100)
    const pct = Math.min(100, Math.round((minute / 90) * 100));

    return (
        <div className="h-0.5 w-full rounded-full bg-rose-100">
            <div
                className="h-full rounded-full bg-rose-500 transition-all duration-1000"
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}
