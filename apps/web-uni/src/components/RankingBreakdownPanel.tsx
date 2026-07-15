import React from 'react';
import { PhaseBonusProgressIndicator } from './PhaseBonusProgressIndicator';
import { RankingBreakdownAccordion } from './RankingBreakdownAccordion';
import type { RankingBreakdownMatch, RankingBreakdownResponse } from '../views/ranking.types';
import {
    formatPhaseLabel,
    toDisplayDate,
    toPointSummaryLabel,
} from '../views/ranking.utils';

function BreakdownMatchCard({ match }: { match: RankingBreakdownMatch }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                        {match.match.homeTeam.name} vs {match.match.awayTeam.name}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-0.5">
                        {toDisplayDate(match.match.matchDate)}
                        {match.match.group ? ` · Grupo ${match.match.group}` : ` · ${formatPhaseLabel(match.match.phase)}`}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        Pronóstico {match.prediction.homeScore}-{match.prediction.awayScore}
                        {typeof match.match.homeScore === 'number' && typeof match.match.awayScore === 'number'
                            ? ` · Resultado ${match.match.homeScore}-${match.match.awayScore}`
                            : ''}
                    </p>
                    <p className="text-[11px] font-medium text-slate-600 mt-1">
                        {toPointSummaryLabel(match.pointDetail)}
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-base font-black" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                        {match.points}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-slate-400">pts</p>
                </div>
            </div>
        </div>
    );
}

export function RankingBreakdownPanel({
    breakdown,
    loading,
    className = 'border-t border-slate-100 bg-slate-50/80 px-4 py-3 space-y-2',
}: {
    breakdown: RankingBreakdownResponse | null;
    loading: boolean;
    className?: string;
}) {
    if (loading) {
        return <p className="px-4 py-3 text-sm text-slate-500">Cargando detalle...</p>;
    }
    if (breakdown?.loadError) {
        return (
            <p className="px-4 py-3 text-sm text-rose-600">
                {breakdown.loadErrorMessage
                    ?? 'No se pudo cargar el detalle. Intenta de nuevo en unos segundos.'}
            </p>
        );
    }
    if (!breakdown || (!breakdown.matches.length && !breakdown.bonuses.length && !breakdown.phaseBonusProgress?.length)) {
        return <p className="px-4 py-3 text-sm text-slate-500">Sin detalle disponible para esta categoría.</p>;
    }

    return (
        <div className={className}>
            {breakdown.phaseBonusProgress && breakdown.phaseBonusProgress.length > 0 && (
                <PhaseBonusProgressIndicator items={breakdown.phaseBonusProgress} variant="ranking" />
            )}
            <RankingBreakdownAccordion
                matches={breakdown.matches}
                getMatchKey={(match) => match.id}
                matchSelectors={{
                    phase: (match) => match.match.phase,
                    group: (match) => match.match.group,
                    points: (match) => match.points,
                    date: (match) => match.match.matchDate,
                }}
                renderMatch={(match) => <BreakdownMatchCard match={match} />}
            />
            {breakdown.bonuses.map((bonus) => (
                <div
                    key={bonus.id}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-center justify-between gap-3"
                >
                    <div>
                        <p className="text-sm font-bold text-amber-900">Bono de fase</p>
                        <p className="text-[10px] font-semibold uppercase text-amber-700">
                            {formatPhaseLabel(bonus.phase)}
                        </p>
                    </div>
                    <p className="text-base font-black text-amber-700">+{bonus.points}</p>
                </div>
            ))}
        </div>
    );
}
