import type { PhaseBonusProgressItem } from '@polla-2026/shared';
import {
    getPhaseBonusProgressPercent,
    getPhaseBonusStatusHeadline,
    getPhaseBonusStatusSubline,
    getPhaseBonusChipFraction,
    getPhaseBonusVisualState,
    PHASE_BONUS_GLOBAL_HINT,
    PHASE_BONUS_SHORT_HINTS,
    PHASE_BONUS_COMPACT_LABELS,
} from '@polla-2026/shared';
import { HelpCircle } from 'lucide-react';
import { Tooltip } from './ui/Tooltip';

export type PhaseBonusIndicatorVariant = 'full' | 'ranking' | 'inline' | 'compact';

interface PhaseBonusProgressIndicatorProps {
    items: PhaseBonusProgressItem[];
    variant?: PhaseBonusIndicatorVariant;
    className?: string;
}

const PHASE_ICONS: Record<string, string> = {
    ROUND_OF_32: '🏟️',
    ROUND_OF_16: '🥈',
    QUARTER: '🥉',
    SEMI: '🏅',
    FINAL: '🏆',
};

function chipTone(state: ReturnType<typeof getPhaseBonusVisualState>): string {
    switch (state) {
        case 'awarded':
            return 'border-emerald-200 bg-emerald-50 text-emerald-800';
        case 'missed':
            return 'border-slate-200 bg-slate-50 text-slate-500';
        case 'in_progress':
            return 'border-amber-200 bg-amber-50 text-amber-900';
        default:
            return 'border-slate-200 bg-white text-slate-600';
    }
}

function barTone(state: ReturnType<typeof getPhaseBonusVisualState>): string {
    switch (state) {
        case 'awarded':
            return 'bg-emerald-500';
        case 'missed':
            return 'bg-slate-300';
        case 'in_progress':
            return 'bg-amber-400';
        default:
            return 'bg-slate-200';
    }
}

function PhaseBonusTooltipContent({ item }: { item: PhaseBonusProgressItem }) {
    const state = getPhaseBonusVisualState(item);
    const percent = getPhaseBonusProgressPercent(item);
    const hint = PHASE_BONUS_SHORT_HINTS[item.phase];

    return (
        <div className="space-y-2">
            <div>
                <p className="font-black text-[11px] uppercase tracking-wide text-white">
                    {PHASE_ICONS[item.phase]} {item.label}
                </p>
                {hint && <p className="text-[10px] text-slate-300 mt-0.5 leading-snug">{hint}</p>}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                <div
                    className={`h-full rounded-full ${barTone(state)}`}
                    style={{ width: `${Math.max(state === 'pending' ? 6 : 0, percent)}%` }}
                />
            </div>
            <div className="space-y-0.5">
                <p className="font-bold text-[11px] text-white">{getPhaseBonusStatusHeadline(item)}</p>
                <p className="text-[10px] text-slate-300 leading-snug">{getPhaseBonusStatusSubline(item)}</p>
                <p className="text-[10px] text-slate-400 pt-0.5">
                    Bono máximo: +{item.maxBonusPoints} pts al cerrar la fase
                </p>
            </div>
        </div>
    );
}

function PhaseBonusChip({ item }: { item: PhaseBonusProgressItem }) {
    const state = getPhaseBonusVisualState(item);
    const percent = getPhaseBonusProgressPercent(item);
    const icon = PHASE_ICONS[item.phase] ?? '⚽';
    const pointsLabel = `${item.awardedPoints} pts`;
    const desktopLabel = PHASE_BONUS_COMPACT_LABELS[item.phase] ?? item.label;

    return (
        <Tooltip content={<PhaseBonusTooltipContent item={item} />} position="top" className="min-w-0">
            <div
                className={`h-full w-full rounded-xl border px-2.5 py-2 transition-colors cursor-help ${chipTone(state)}`}
                aria-label={`${item.label}: ${getPhaseBonusStatusHeadline(item)}`}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm leading-none shrink-0" aria-hidden>{icon}</span>
                    <span className="text-[11px] font-black uppercase tracking-wide truncate" title={item.label}>
                        {desktopLabel}
                    </span>
                </div>
                <p
                    className="mt-1.5 text-sm font-black tabular-nums text-inherit"
                    title="aciertos en partidos ya jugados"
                >
                    {getPhaseBonusChipFraction(item)}
                </p>
                <p className="text-[11px] font-bold tabular-nums opacity-80">{pointsLabel}</p>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/5">
                    <div
                        className={`h-full rounded-full ${barTone(state)}`}
                        style={{ width: `${Math.max(state === 'pending' ? 8 : 0, percent)}%` }}
                    />
                </div>
            </div>
        </Tooltip>
    );
}

function CompactPhaseBonusCell({
    items,
    className = '',
}: {
    items: PhaseBonusProgressItem[];
    className?: string;
}) {
    return (
        <section
            className={`rounded-2xl border border-amber-100 bg-amber-50/50 px-3 py-3 ${className}`}
            aria-label="Bonos por clasificados en eliminatorias"
        >
            <div className="flex items-center justify-between gap-2 mb-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-900">
                    Bonos clasificados
                </p>
                <Tooltip
                    content={
                        <p className="text-[10px] leading-snug text-slate-200">{PHASE_BONUS_GLOBAL_HINT}</p>
                    }
                    position="left"
                >
                    <span className="inline-flex items-center text-amber-700/80 hover:text-amber-900">
                        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">Cómo funcionan los bonos</span>
                    </span>
                </Tooltip>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {items.map((item) => (
                    <PhaseBonusChip key={item.phase} item={item} />
                ))}
            </div>
        </section>
    );
}

export function PhaseBonusProgressIndicator({
    items,
    variant = 'full',
    className = '',
}: PhaseBonusProgressIndicatorProps) {
    if (items.length === 0) return null;
    return <CompactPhaseBonusCell items={items} className={className} />;
}
