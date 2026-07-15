import React, { useMemo } from 'react';
import {
    isPhaseBonusAdvanceCorrect,
    resolveEffectiveAdvanceTeamId,
    type PhaseBonusProgressItem,
} from '@polla-2026/shared';
import { PhaseBonusProgressIndicator } from './PhaseBonusProgressIndicator';
import { RankingBreakdownAccordion } from './RankingBreakdownAccordion';
import type { RankingBreakdownMatch, RankingBreakdownResponse } from '../views/ranking.types';
import {
    formatPhaseLabel,
    toDisplayDate,
    toPointSummaryLabel,
} from '../views/ranking.utils';

function teamCode(team: RankingBreakdownMatch['match']['homeTeam']): string {
    return (team.shortCode ?? team.code ?? team.name.slice(0, 3)).toUpperCase();
}

function isKnockoutPhase(phase?: string | null): boolean {
    return !!phase && phase !== 'GROUP' && phase !== 'THIRD_PLACE';
}

function resolveMatchAdvancingTeamId(item: RankingBreakdownMatch): string | null {
    if (item.match.advancingTeamId) return item.match.advancingTeamId;
    if (!item.match.homeTeam.id || !item.match.awayTeam.id) return null;
    if (typeof item.match.homeScore !== 'number' || typeof item.match.awayScore !== 'number') return null;
    if (item.match.homeScore === item.match.awayScore) return null;
    return item.match.homeScore > item.match.awayScore
        ? item.match.homeTeam.id
        : item.match.awayTeam.id;
}

function isBreakdownAdvanceCorrect(item: RankingBreakdownMatch): boolean {
    if (!item.match.homeTeam.id || !item.match.awayTeam.id) return false;
    const advancingTeamId = resolveMatchAdvancingTeamId(item);
    if (!advancingTeamId) return false;
    return isPhaseBonusAdvanceCorrect(
        {
            matchId: item.match.id,
            homeScore: item.prediction.homeScore,
            awayScore: item.prediction.awayScore,
            advanceTeamId: item.prediction.advanceTeamId ?? null,
        },
        {
            id: item.match.id,
            status: 'FINISHED',
            homeTeamId: item.match.homeTeam.id,
            awayTeamId: item.match.awayTeam.id,
            advancingTeamId,
            homeScore: item.match.homeScore,
            awayScore: item.match.awayScore,
            penaltyHomeScore: item.match.penaltyHomeScore,
            penaltyAwayScore: item.match.penaltyAwayScore,
        },
    );
}

/** Alinea chips superiores con el detalle de partidos (evita 4/4 cuando un pick no cuenta). */
function reconcilePhaseBonusProgress(
    progress: PhaseBonusProgressItem[],
    matches: RankingBreakdownMatch[],
): PhaseBonusProgressItem[] {
    const byPhase = new Map<string, RankingBreakdownMatch[]>();
    for (const match of matches) {
        if (!isKnockoutPhase(match.match.phase)) continue;
        const list = byPhase.get(match.match.phase) ?? [];
        list.push(match);
        byPhase.set(match.match.phase, list);
    }

    return progress.map((item) => {
        const phaseMatches = byPhase.get(item.phase);
        if (!phaseMatches || phaseMatches.length === 0) return item;

        const finished = phaseMatches.filter((match) => resolveMatchAdvancingTeamId(match));
        if (finished.length === 0) return item;

        const correctCount = finished.filter((match) => isBreakdownAdvanceCorrect(match)).length;
        // Si el detalle trae todos los partidos de la fase, usa ese denominador; si no, conserva el del API.
        const totalMatches =
            phaseMatches.length >= item.totalMatches ? phaseMatches.length : item.totalMatches;
        const fullyCorrect = totalMatches > 0 && correctCount >= totalMatches;
        const isAwarded = fullyCorrect && item.isAwarded;
        const awardedPoints = isAwarded ? item.awardedPoints : 0;

        return {
            ...item,
            correctCount,
            totalMatches,
            isAwarded,
            awardedPoints,
            isPhaseComplete: item.isPhaseComplete || finished.length >= totalMatches,
            progressLabel: `${correctCount}/${totalMatches}:${awardedPoints}`,
        };
    });
}

function AdvancePickLine({ item }: { item: RankingBreakdownMatch }) {
    if (!isKnockoutPhase(item.match.phase)) return null;
    if (!item.match.homeTeam.id || !item.match.awayTeam.id) return null;

    const inferredAdvancingTeamId = resolveMatchAdvancingTeamId(item);

    const pred = {
        matchId: item.match.id,
        homeScore: item.prediction.homeScore,
        awayScore: item.prediction.awayScore,
        advanceTeamId: item.prediction.advanceTeamId ?? null,
    };
    const matchForCount = {
        id: item.match.id,
        status: inferredAdvancingTeamId ? 'FINISHED' : (item.match.status ?? 'SCHEDULED'),
        homeTeamId: item.match.homeTeam.id,
        awayTeamId: item.match.awayTeam.id,
        advancingTeamId: inferredAdvancingTeamId,
        homeScore: item.match.homeScore,
        awayScore: item.match.awayScore,
        penaltyHomeScore: item.match.penaltyHomeScore,
        penaltyAwayScore: item.match.penaltyAwayScore,
    };

    const effectiveAdvance = resolveEffectiveAdvanceTeamId(pred, matchForCount);
    if (!effectiveAdvance) return null;

    const pickCode =
        effectiveAdvance === item.match.homeTeam.id
            ? teamCode(item.match.homeTeam)
            : teamCode(item.match.awayTeam);

    const predictedDraw = item.prediction.homeScore === item.prediction.awayScore;
    const finished = Boolean(inferredAdvancingTeamId);
    const matchWentToPens =
        typeof item.match.homeScore === 'number' &&
        typeof item.match.awayScore === 'number' &&
        item.match.homeScore === item.match.awayScore;

    if (!finished) {
        return (
            <p className="text-[11px] font-medium text-slate-500 mt-1">
                Clasifica: <span className="font-bold text-slate-700">{pickCode}</span>
                {predictedDraw ? <span className="text-slate-400"> (pick por empate)</span> : null}
            </p>
        );
    }

    const correct = isBreakdownAdvanceCorrect(item);

    let note: string | null = null;
    if (predictedDraw && !matchWentToPens) {
        note = 'Tu empate no cuenta para el bono: el partido se resolvió en el marcador (no hubo penales).';
    } else if (predictedDraw && matchWentToPens && correct) {
        note = 'Definido en penales: pick válido para el bono.';
    }

    return (
        <div className="mt-1 space-y-0.5">
            <p className="text-[11px] font-medium">
                <span className="text-slate-500">Clasifica: </span>
                <span className="font-bold text-slate-700">{pickCode}</span>
                {predictedDraw ? (
                    <span className="text-slate-400">
                        {matchWentToPens ? ' (penales reales)' : ' (predijiste empate)'}
                    </span>
                ) : null}
                {' '}
                <span className={`font-black uppercase ${correct ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {correct ? '✓ Acertaste' : '✗ No cuenta'}
                </span>
            </p>
            {note ? <p className="text-[10px] text-amber-700 leading-snug">{note}</p> : null}
        </div>
    );
}

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
                    <AdvancePickLine item={match} />
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
    const reconciledProgress = useMemo(() => {
        if (!breakdown?.phaseBonusProgress?.length) return [];
        return reconcilePhaseBonusProgress(breakdown.phaseBonusProgress, breakdown.matches);
    }, [breakdown]);

    const visibleBonuses = useMemo(() => {
        if (!breakdown) return [];
        const awardedPhases = new Set(
            reconciledProgress.filter((item) => item.isAwarded && item.awardedPoints > 0).map((item) => item.phase),
        );
        // Si hay progreso reconciliado, oculta bonos de fase que ya no aplican.
        if (reconciledProgress.length > 0) {
            return breakdown.bonuses.filter((bonus) => awardedPhases.has(bonus.phase));
        }
        return breakdown.bonuses;
    }, [breakdown, reconciledProgress]);

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
            {reconciledProgress.length > 0 && (
                <PhaseBonusProgressIndicator items={reconciledProgress} variant="ranking" />
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
            {visibleBonuses.map((bonus) => (
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
