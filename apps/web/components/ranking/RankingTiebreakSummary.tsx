import React from 'react';
import {
    TIEBREAK_ROW_METRICS,
    formatTiebreakAdvantage,
    formatTiebreakNote,
    type TiebreakStats,
} from '@polla-2026/shared';
import type { LeaderboardRow } from '../../stores/prediction.store';

export interface TiebreakSummaryEntry {
    points: number;
    hasChampion?: boolean;
    exactCount?: number;
    winnerCount?: number;
    goalCount?: number;
    uniqueCount?: number;
}

interface RankingTiebreakSummaryProps {
    entry: TiebreakSummaryEntry;
    previous?: TiebreakSummaryEntry | null;
    next?: TiebreakSummaryEntry | null;
    compact?: boolean;
    variant?: 'light' | 'dark';
    phaseBonusPoints?: number;
    showTieNotes?: boolean;
}

export function toTiebreakStats(entry: TiebreakSummaryEntry): TiebreakStats {
    return {
        points: entry.points,
        hasChampion: entry.hasChampion ?? false,
        exactCount: entry.exactCount ?? 0,
        winnerCount: entry.winnerCount ?? 0,
        goalCount: entry.goalCount ?? 0,
        uniqueCount: entry.uniqueCount ?? 0,
    };
}

export function leaderboardToTiebreakEntry(row: LeaderboardRow): TiebreakSummaryEntry {
    return {
        points: row.points,
        hasChampion: row.hasChampion,
        exactCount: row.exactCount,
        winnerCount: row.winnerCount,
        goalCount: row.goalCount,
        uniqueCount: row.uniqueCount,
    };
}

export function RankingTiebreakSummary({
    entry,
    previous = null,
    next = null,
    compact = false,
    variant = 'light',
    phaseBonusPoints = 0,
    showTieNotes = true,
}: RankingTiebreakSummaryProps) {
    const stats = toTiebreakStats(entry);
    const tiedWithPrevious = previous != null && previous.points === entry.points;
    const tiedWithNext = next != null && next.points === entry.points;
    const noteBelow = showTieNotes && tiedWithPrevious && previous
        ? formatTiebreakNote(toTiebreakStats(previous), stats)
        : null;
    const noteAbove = showTieNotes && tiedWithNext && next
        ? formatTiebreakAdvantage(stats, toTiebreakStats(next))
        : null;

    const activeBadge =
        variant === 'dark'
            ? 'border-white/25 bg-white/10 text-white'
            : 'border-slate-200 bg-white text-slate-700';
    const inactiveBadge =
        variant === 'dark'
            ? 'border-white/10 bg-white/5 text-white/40'
            : 'border-slate-100 bg-slate-50 text-slate-400';

    return (
        <div className="space-y-1 mt-0.5">
            <div className={`flex flex-wrap justify-center gap-1 ${compact ? '' : 'gap-1.5'}`}>
                {TIEBREAK_ROW_METRICS.map((metric) => {
                    const value = metric.getValue(stats);
                    const isActive =
                        metric.id === 'champion'
                            ? stats.hasChampion
                            : metric.id === 'points'
                                ? stats.points > 0
                                : Number(value) > 0;

                    return (
                        <span
                            key={metric.id}
                            title={`${metric.label}: ${value}`}
                            aria-label={`${metric.label}: ${value}`}
                            className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[9px] font-bold leading-none ${
                                isActive ? activeBadge : inactiveBadge
                            }`}
                        >
                            <span aria-hidden="true">{metric.icon}</span>
                            <span className="tabular-nums">{value}</span>
                        </span>
                    );
                })}
                {phaseBonusPoints > 0 && (
                    <span
                        title={`Bono de fase: ${phaseBonusPoints} pts`}
                        aria-label={`Bono de fase: ${phaseBonusPoints} puntos`}
                        className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[9px] font-bold leading-none ${
                            variant === 'dark'
                                ? 'border-amber-400/40 bg-amber-400/15 text-amber-200'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                    >
                        <span aria-hidden="true">🎁</span>
                        <span className="tabular-nums">+{phaseBonusPoints}</span>
                    </span>
                )}
            </div>
            {(noteAbove || noteBelow) && (
                <div className="space-y-0.5">
                    {noteAbove && (
                        <p className={`text-[9px] font-semibold leading-snug ${variant === 'dark' ? 'text-lime-300' : 'text-emerald-700'}`}>
                            {noteAbove}
                        </p>
                    )}
                    {noteBelow && (
                        <p className={`text-[9px] leading-snug ${variant === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>
                            {noteBelow}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
