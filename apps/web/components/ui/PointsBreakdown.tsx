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

interface PointsBreakdownProps {
    detail: PointDetail;
    /** Mostrar versión compacta */
    compact?: boolean;
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

/**
 * Componente para mostrar el desglose técnico de puntos
 *
 * Se usa dentro de tooltips o en vistas expandidas
 */
export const PointsBreakdown: React.FC<PointsBreakdownProps> = ({ detail, compact = false }) => {
    const items: Array<{ icon: typeof Target; label: string; value: number; highlight?: boolean }> = [];

    if (detail.exactPoints > 0) {
        items.push({
            icon: Target,
            label: 'Marcador exacto',
            value: detail.exactPoints,
            highlight: true,
        });
    }

    if (detail.winnerPoints > 0) {
        items.push({
            icon: Award,
            label: 'Ganador correcto',
            value: detail.winnerPoints,
        });
    }

    if (detail.goalPoints > 0) {
        items.push({
            icon: Sparkles,
            label: 'Gol acertado',
            value: detail.goalPoints,
        });
    }

    if (detail.uniqueBonus > 0) {
        items.push({
            icon: Trophy,
            label: 'Predicción única',
            value: detail.uniqueBonus,
            highlight: true,
        });
    }

    const isKnockout = detail.phase !== 'GROUP';

    if (compact) {
        return (
            <div className="space-y-1.5">
                {items.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                        <div key={idx} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                                <Icon className={`h-3 w-3 ${item.highlight ? 'text-amber-400' : 'text-slate-300'}`} />
                                <span className="text-xs text-slate-300">{item.label}</span>
                            </div>
                            <span className={`text-xs font-bold ${item.highlight ? 'text-amber-400' : 'text-white'}`}>
                                +{item.value}
                            </span>
                        </div>
                    );
                })}

                {isKnockout && (
                    <div className="flex items-center justify-between gap-3 border-t border-slate-700 pt-1.5">
                        <span className="text-xs text-slate-300">Multiplicador ({formatPhase(detail.phase)})</span>
                        <span className="text-xs font-bold text-sky-400">×{detail.multiplier}</span>
                    </div>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-slate-600 pt-1.5">
                    <span className="text-xs font-black uppercase tracking-wider text-white">Total</span>
                    <span className="text-sm font-black text-lime-400">{detail.total} pts</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="space-y-1.5">
                {items.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                        <div key={idx} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Icon className={`h-4 w-4 ${item.highlight ? 'text-amber-400' : 'text-slate-300'}`} />
                                <span className="text-sm text-slate-200">{item.label}</span>
                            </div>
                            <span className={`text-sm font-bold ${item.highlight ? 'text-amber-400' : 'text-white'}`}>
                                +{item.value} pts
                            </span>
                        </div>
                    );
                })}
            </div>

            {isKnockout && (
                <div className="rounded-lg border border-sky-700/30 bg-sky-950/20 px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-sky-300">Multiplicador ({formatPhase(detail.phase)})</span>
                        <span className="text-sm font-bold text-sky-400">×{detail.multiplier}</span>
                    </div>
                </div>
            )}

            <div className="rounded-lg border border-lime-700/30 bg-lime-950/20 px-2.5 py-2">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-wider text-lime-200">Total</span>
                    <span className="text-lg font-black text-lime-400">{detail.total} pts</span>
                </div>
            </div>
        </div>
    );
};
