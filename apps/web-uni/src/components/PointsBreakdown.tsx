import React from 'react';
import { Target, Trophy, Award, Sparkles } from 'lucide-react';

export interface PointDetail {
    type: 'EXACT_SCORE' | 'CORRECT_WINNER_GOAL' | 'CORRECT_WINNER' | 'TEAM_GOALS' | 'NONE';
    exactPoints: number;
    winnerPoints: number;
    goalPoints: number;
    uniqueBonus: number;
    basePoints: number;
    phase: string;
    multiplier: number;
    total: number;
    explanation?: string;
}

function formatPhase(phase: string): string {
    switch (phase) {
        case 'GROUP': return 'Grupos';
        case 'ROUND_OF_32': return 'Dieciseisavos';
        case 'ROUND_OF_16': return 'Octavos';
        case 'QUARTER': return 'Cuartos';
        case 'SEMI': return 'Semifinal';
        case 'THIRD_PLACE': return 'Tercer puesto';
        case 'FINAL': return 'Final';
        default: return phase;
    }
}

export function PointsBreakdown({ detail, light = false }: { detail: PointDetail; light?: boolean }) {
    const items: Array<{ icon: typeof Target; label: string; value: number; highlight?: boolean }> = [];

    if (detail.exactPoints > 0) {
        items.push({ icon: Target, label: 'Marcador exacto', value: detail.exactPoints, highlight: true });
    }
    if (detail.winnerPoints > 0) {
        items.push({ icon: Award, label: 'Ganador correcto', value: detail.winnerPoints });
    }
    if (detail.goalPoints > 0) {
        items.push({ icon: Sparkles, label: 'Gol acertado', value: detail.goalPoints });
    }
    if (detail.uniqueBonus > 0) {
        items.push({ icon: Trophy, label: 'Predicción única', value: detail.uniqueBonus, highlight: true });
    }

    const isKnockout = detail.phase !== 'GROUP';
    const labelCls = light ? 'text-slate-600' : 'text-slate-300';
    const valueCls = (highlight?: boolean) =>
        light
            ? highlight ? 'text-amber-600' : 'text-slate-900'
            : highlight ? 'text-amber-400' : 'text-white';
    const iconCls = (highlight?: boolean) =>
        light
            ? highlight ? 'text-amber-500' : 'text-slate-400'
            : highlight ? 'text-amber-400' : 'text-slate-300';
    const borderCls = light ? 'border-slate-200' : 'border-slate-700';
    const totalCls = light ? 'text-lime-700' : 'text-lime-400';

    if (items.length === 0) {
        return (
            <p className={`text-xs ${light ? 'text-slate-500' : 'text-slate-300'}`}>
                {detail.explanation ?? 'Sin desglose disponible'}
            </p>
        );
    }

    return (
        <div className="space-y-1.5">
            {items.map((item, idx) => {
                const Icon = item.icon;
                return (
                    <div key={idx} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                            <Icon className={`h-3.5 w-3.5 ${iconCls(item.highlight)}`} />
                            <span className={`text-xs ${labelCls}`}>{item.label}</span>
                        </div>
                        <span className={`text-xs font-bold ${valueCls(item.highlight)}`}>+{item.value}</span>
                    </div>
                );
            })}
            {isKnockout && (
                <div className={`flex items-center justify-between gap-3 border-t ${borderCls} pt-1.5`}>
                    <span className={`text-xs ${labelCls}`}>Multiplicador ({formatPhase(detail.phase)})</span>
                    <span className={`text-xs font-bold ${light ? 'text-sky-600' : 'text-sky-400'}`}>×{detail.multiplier}</span>
                </div>
            )}
            <div className={`flex items-center justify-between gap-3 border-t ${borderCls} pt-1.5`}>
                <span className={`text-xs font-black uppercase tracking-wider ${light ? 'text-slate-700' : 'text-white'}`}>Total</span>
                <span className={`text-sm font-black ${totalCls}`}>{detail.total} pts</span>
            </div>
        </div>
    );
}

export function buildPointsResume(summary: {
    exactCount: number;
    winnerCount: number;
    goalCount: number;
    uniqueCount: number;
    phaseBonusPoints?: number;
}): string {
    const parts: string[] = [];
    if (summary.exactCount) parts.push(`${summary.exactCount} marcador${summary.exactCount === 1 ? '' : 'es'} exacto${summary.exactCount === 1 ? '' : 's'}`);
    if (summary.winnerCount) parts.push(`${summary.winnerCount} ganador${summary.winnerCount === 1 ? '' : 'es'} acertado${summary.winnerCount === 1 ? '' : 's'}`);
    if (summary.goalCount) parts.push(`${summary.goalCount} gol${summary.goalCount === 1 ? '' : 'es'} acertado${summary.goalCount === 1 ? '' : 's'}`);
    if (summary.uniqueCount) parts.push(`${summary.uniqueCount} predicción${summary.uniqueCount === 1 ? '' : 'es'} única${summary.uniqueCount === 1 ? '' : 's'}`);
    if (summary.phaseBonusPoints) parts.push(`${summary.phaseBonusPoints} pts en bonos de fase`);
    return parts.length ? parts.join(' · ') : 'Aún no suma puntos detallados';
}
