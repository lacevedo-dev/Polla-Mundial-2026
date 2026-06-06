import React from 'react';
import { Clock } from 'lucide-react';
import { ScoringRule } from './types';

interface Props {
    scoringRules: ScoringRule[];
    closePredictionMinutes: number;
}

export function RulesTab({ scoringRules, closePredictionMinutes }: Props) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-50">
                <h2 className="font-black text-slate-900 text-sm">Reglas de puntuación</h2>
            </div>

            {scoringRules.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Sin reglas configuradas</div>
            ) : (
                <div className="px-4 py-2 divide-y divide-slate-50">
                    {scoringRules.map((r) => (
                        <div key={r.ruleType} className="flex items-center justify-between py-3">
                            <span className="text-sm text-slate-700 font-medium">{r.description ?? r.ruleType}</span>
                            <span className="text-sm font-black" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                                {r.points} pts
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <div className="px-4 py-4 border-t border-slate-50 bg-slate-50">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={12} />
                    <span>Los pronósticos cierran {closePredictionMinutes} min antes del partido</span>
                </div>
            </div>
        </div>
    );
}
