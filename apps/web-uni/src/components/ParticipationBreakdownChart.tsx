import React, { useMemo } from 'react';

export interface ParticipationSegment {
    label: string;
    value: number;
    color: string;
}

interface ParticipationBreakdownChartProps {
    segments: ParticipationSegment[];
    centerLabel?: string;
    centerSub?: string;
    title?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function ParticipationBreakdownChart({
    segments,
    centerLabel,
    centerSub,
    title = 'Distribución de participación',
}: ParticipationBreakdownChartProps) {
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);

    const arcs = useMemo(() => {
        if (total <= 0) return [];
        let cursor = 0;
        return segments
            .filter((segment) => segment.value > 0)
            .map((segment) => {
                const sweep = (segment.value / total) * 360;
                const start = cursor;
                cursor += sweep;
                return { ...segment, start, end: cursor };
            });
    }, [segments, total]);

    const ariaLabel = segments
        .map((segment) => `${segment.label}: ${segment.value.toLocaleString('es-CO')}`)
        .join('. ');

    if (total <= 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-8 px-4 min-h-[220px]">
                <p className="text-sm font-bold text-slate-500">Sin datos de participación</p>
                <p className="text-xs text-slate-400 mt-1">Inscribe usuarios en una polla para ver el gráfico.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center w-full min-h-[220px] sm:min-h-[240px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 self-start sm:self-center">
                {title}
            </p>

            <div className="relative w-full max-w-[220px] sm:max-w-[260px] aspect-square mx-auto">
                <svg
                    viewBox="0 0 120 120"
                    className="w-full h-full -rotate-90"
                    role="img"
                    aria-label={ariaLabel}
                >
                    <circle cx="60" cy="60" r="46" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                    {arcs.map((arc) => (
                        <path
                            key={arc.label}
                            d={describeArc(60, 60, 46, arc.start, arc.end - 0.4)}
                            fill="none"
                            stroke={arc.color}
                            strokeWidth="14"
                            strokeLinecap="round"
                        />
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none rotate-0">
                    {centerLabel && (
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums leading-none">
                            {centerLabel}
                        </span>
                    )}
                    {centerSub && (
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 text-center px-2">
                            {centerSub}
                        </span>
                    )}
                </div>
            </div>

            <ul className="mt-4 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {segments.map((segment) => {
                    const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
                    return (
                        <li
                            key={segment.label}
                            className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2 min-w-0"
                        >
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: segment.color }}
                                aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold text-slate-600 truncate">{segment.label}</p>
                                <p className="text-xs font-black text-slate-900 tabular-nums">
                                    {segment.value.toLocaleString('es-CO')}
                                    <span className="text-[10px] font-bold text-slate-400 ml-1">({pct}%)</span>
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export function buildParticipationSegments(
    summary: {
        membersWithPredictions: number;
        neverPredicted: number;
        notEnrolled: number;
        enrolledMembers: number;
        participationRate: number;
    },
    league?: { enrolledCount: number; predictedCount: number; participationRate: number },
): ParticipationSegment[] {
    if (league) {
        const without = Math.max(0, league.enrolledCount - league.predictedCount);
        return [
            { label: 'Con pronósticos', value: league.predictedCount, color: '#10b981' },
            { label: 'Sin pronósticos', value: without, color: '#f59e0b' },
        ];
    }

    return [
        { label: 'Con pronósticos', value: summary.membersWithPredictions, color: '#10b981' },
        { label: 'Inscritos sin pronósticos', value: summary.neverPredicted, color: '#f97316' },
        { label: 'Sin inscribir', value: summary.notEnrolled, color: '#94a3b8' },
    ];
}
