import React from 'react';

interface Props {
    matchDate: string;       // ISO — kickoff time
    elapsed: number | null;  // last known minute from API (null if no sync yet)
    lastSyncAt: number | null; // timestamp ms of last sync
    statusShort?: string | null; // '1H', 'HT', '2H', 'ET', 'FT', etc.
    finished?: boolean;
}

function computeMinute(
    matchDate: string,
    elapsed: number | null,
    lastSyncAt: number | null,
    statusShort?: string | null,
): { minute: number; extra: boolean } {
    const now = Date.now();

    if (statusShort === 'HT') return { minute: 45, extra: false };
    if (statusShort === 'FT' || statusShort === 'AET') return { minute: 90, extra: false };
    if (statusShort === 'PEN') return { minute: 120, extra: false };

    if (elapsed !== null && lastSyncAt !== null) {
        const secondsSinceSync = Math.floor((now - lastSyncAt) / 1000);
        const minutesSinceSync = Math.floor(secondsSinceSync / 60);
        const current = elapsed + minutesSinceSync;
        const maxMinute = (statusShort === '2H' || statusShort === 'ET') ? 120 : 45;
        const capped = Math.min(current, maxMinute + 10); // allow up to +10 injury time
        return { minute: capped, extra: capped > maxMinute };
    }

    // Fallback: calculate from kickoff
    const kickoff = new Date(matchDate).getTime();
    if (now < kickoff) return { minute: 0, extra: false };
    const raw = Math.floor((now - kickoff) / 60000);
    return { minute: Math.min(raw, 95), extra: raw > 90 };
}

function halfLabel(statusShort?: string | null): string | null {
    if (statusShort === '1H') return '1T';
    if (statusShort === 'HT') return 'ET';
    if (statusShort === '2H') return '2T';
    if (statusShort === 'ET') return 'Prórroga';
    if (statusShort === 'PEN') return 'Penales';
    return null;
}

export function LiveMatchTimer({ matchDate, elapsed, lastSyncAt, statusShort, finished }: Props) {
    const [now, setNow] = React.useState(Date.now());

    React.useEffect(() => {
        if (finished) return;
        const interval = setInterval(() => setNow(Date.now()), 30_000); // tick every 30s
        return () => clearInterval(interval);
    }, [finished]);

    // Suppress unused var warning — used to trigger re-render
    void now;

    if (finished || statusShort === 'FT' || statusShort === 'AET') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-black text-slate-600">
                FT
            </span>
        );
    }

    if (statusShort === 'HT') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-black text-amber-700">
                ET
            </span>
        );
    }

    if (statusShort === 'PEN') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 font-mono text-[10px] font-black text-purple-700">
                Pen.
            </span>
        );
    }

    const { minute, extra } = computeMinute(matchDate, elapsed, lastSyncAt, statusShort);
    const half = halfLabel(statusShort);

    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-black text-rose-700">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            {minute}
            {extra ? <span className="text-[8px]">+</span> : <span className="text-[8px]">'</span>}
            {half && <span className="ml-0.5 text-rose-400">{half}</span>}
        </span>
    );
}

/** Compact inline version for table rows */
export function LiveMatchTimerInline({ matchDate, elapsed, lastSyncAt, statusShort, finished }: Props) {
    const [now, setNow] = React.useState(Date.now());

    React.useEffect(() => {
        if (finished) return;
        const interval = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(interval);
    }, [finished]);

    void now;

    if (statusShort === 'HT') return <span className="font-mono text-[9px] font-black text-amber-600">ET</span>;
    if (statusShort === 'FT' || statusShort === 'AET') return <span className="font-mono text-[9px] font-black text-slate-500">FT</span>;
    if (statusShort === 'PEN') return <span className="font-mono text-[9px] font-black text-purple-600">Pen.</span>;

    const { minute } = computeMinute(matchDate, elapsed, lastSyncAt, statusShort);

    return (
        <span className="font-mono text-[9px] font-black text-rose-600">
            {minute}'
        </span>
    );
}
