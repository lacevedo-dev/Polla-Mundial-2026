export function formatCurrency(amount?: number | null, currency = 'COP'): string {
    if (!amount) return 'Gratis';
    try {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${currency} ${amount}`;
    }
}

export function safeText(value?: string | null, fallback = 'Sin datos'): string {
    return value?.trim() || fallback;
}

export const ADMIN_COMMISSION = 0.1;

export interface PrizePosition {
    label: string;
    percentage: number;
    amount: number;
}

export function calcPrizes(
    baseFee: number | null | undefined,
    memberCount: number | undefined,
    currency = 'COP',
    distributions?: Array<{ category: string; position: number; label: string; percentage: number; active: boolean }>,
) {
    const raw = (baseFee ?? 0) * (memberCount ?? 0);
    const net = Math.round(raw * (1 - ADMIN_COMMISSION));
    const commission = raw - net;
    const fmt = (n: number) => (n > 0 ? formatCurrency(n, currency) : '—');

    const activeDist = (distributions ?? [])
        .filter((d) => d.active && d.category === 'GENERAL')
        .sort((a, b) => a.position - b.position);

    const fallback: Array<{ label: string; percentage: number }> = [
        { label: '1er puesto', percentage: 60 },
        { label: '2do puesto', percentage: 20 },
        { label: '3er puesto', percentage: 10 },
    ];

    const source = activeDist.length > 0 ? activeDist : fallback;

    const positions: PrizePosition[] = source.map((d) => ({
        label: d.label,
        percentage: d.percentage,
        amount: Math.round(net * (d.percentage / 100)),
    }));

    return {
        raw, net, commission, fmt, positions,
        first: positions[0]?.amount ?? 0,
        second: positions[1]?.amount ?? 0,
        third: positions[2]?.amount ?? 0,
    };
}

export const fade = (delay = 0) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: 'easeOut' as const, delay },
});

export function getClosePredictionMinutes(closePredictionMinutes?: number | null): number {
    if (typeof closePredictionMinutes !== 'number' || !Number.isFinite(closePredictionMinutes)) {
        return 15;
    }
    return Math.max(0, closePredictionMinutes);
}

export function getPredictionCloseTime(matchDate: string, closePredictionMinutes?: number | null): number {
    return new Date(matchDate).getTime() - getClosePredictionMinutes(closePredictionMinutes) * 60_000;
}

export function isPredictionWindowClosed(
    matchDate: string,
    closePredictionMinutes?: number | null,
    now = Date.now(),
): boolean {
    return now > getPredictionCloseTime(matchDate, closePredictionMinutes);
}

export function summarizeCloseTime(
    matchDate: string,
    closePredictionMinutes?: number | null,
    now = Date.now(),
): string {
    const diffMs = getPredictionCloseTime(matchDate, closePredictionMinutes) - now;
    if (!Number.isFinite(diffMs) || diffMs <= 0) return 'Cerrado';
    const totalMinutes = Math.round(diffMs / 60_000);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

export function formatMatchTime(date: string): string {
    return new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(date));
}

export function fmtCOP(n: number): string {
    try {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
    } catch {
        return `$${n.toLocaleString('es-CO')}`;
    }
}

export function calcLivePoints(
    predHome: number,
    predAway: number,
    realHome: number,
    realAway: number,
    isKnockout: boolean,
): number {
    const mult = isKnockout ? 1.5 : 1;
    if (predHome === realHome && predAway === realAway) return 5 * mult;
    const predSign = Math.sign(predHome - predAway);
    const realSign = Math.sign(realHome - realAway);
    if (predSign === realSign) {
        const bonus = (predHome === realHome || predAway === realAway) ? 1 : 0;
        return (2 + bonus) * mult;
    }
    if (predHome === realHome || predAway === realAway) return 1 * mult;
    return 0;
}
