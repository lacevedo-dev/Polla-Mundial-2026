import type { PhaseBonusProgressItem } from '@polla-2026/shared';

interface PhaseBonusProgressIndicatorProps {
    items: PhaseBonusProgressItem[];
    compact?: boolean;
    className?: string;
    primaryClassName?: string;
}

function progressTone(item: PhaseBonusProgressItem): string {
    if (item.isAwarded) return 'text-lime-600';
    if (item.isPhaseComplete && !item.isAwarded) return 'text-slate-400';
    return 'text-slate-700';
}

export function PhaseBonusProgressIndicator({
    items,
    compact = false,
    className = '',
    primaryClassName = 'text-lime-600',
}: PhaseBonusProgressIndicatorProps) {
    if (items.length === 0) return null;

    return (
        <div
            className={`rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 ${className}`}
            aria-label="Progreso bonos clasificados por fase"
        >
            {!compact && (
                <div className="mb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-900">
                        Bono clasificados por fase
                    </p>
                    <p className="text-[9px] text-amber-800/70 leading-snug mt-0.5">
                        Se otorga al cerrar cada fase si acertaste todos los picks.
                        Formato: <span className="font-mono font-bold">aciertos/total:pts</span>
                    </p>
                </div>
            )}
            <div className="space-y-1">
                {items.map((item) => (
                    <div
                        key={item.phase}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 border border-amber-100/80"
                    >
                        <div className="min-w-0 flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-600 truncate">
                                {item.label}
                            </span>
                            {!compact && (
                                <span className="text-[8px] font-bold text-slate-400 shrink-0">
                                    max {item.maxBonusPoints}
                                </span>
                            )}
                        </div>
                        <span
                            className={`text-[11px] font-black tabular-nums font-mono shrink-0 ${progressTone(item)} ${item.isAwarded ? primaryClassName : ''}`}
                            title={`${item.correctCount} aciertos de ${item.totalMatches} partidos finalizados · ${item.awardedPoints} pts otorgados`}
                        >
                            {item.progressLabel}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
