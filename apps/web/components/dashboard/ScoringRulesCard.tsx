import React, { useState, useEffect } from 'react';
import { ListChecks } from 'lucide-react';
import type { LeagueScoringRule } from '../../stores/league.adapters';
import type { PhaseBonusProgressItem } from '@polla-2026/shared';
import { PHASE_BONUS_HELP_ITEMS, resolvePhaseBonusPoints } from '@polla-2026/shared';
import { KnockoutMultiplierGuide } from '../help/KnockoutMultiplierGuide';
import PhaseBonusProgressIndicator from '../ranking/PhaseBonusProgressIndicator';
import { request } from '../../api';

type ScoringTab = 'resultado' | 'bonos' | 'desempate';

interface ScoringRulesCardProps {
    scoringRules?: LeagueScoringRule[];
    leagueId?: string;
}

function getPoints(rules: LeagueScoringRule[] | undefined, ruleType: string, fallback: number): number {
    if (!rules) return fallback;
    const rule = rules.find((r) => r.ruleType === ruleType && r.active !== false);
    return rule?.points ?? fallback;
}

const KNOCKOUT_MULTIPLIER = 1.5;

function fmtPts(n: number): string {
    return `${n} ${n === 1 ? 'pt' : 'pts'}`;
}

function fmtKnockoutPts(base: number): string {
    const total = base * KNOCKOUT_MULTIPLIER;
    return fmtPts(total);
}

const ScoringRulesCard: React.FC<ScoringRulesCardProps> = ({ scoringRules, leagueId }) => {
    const [scoringTab, setScoringTab] = useState<ScoringTab>('resultado');
    const [phaseBonusProgress, setPhaseBonusProgress] = useState<PhaseBonusProgressItem[] | null>(null);

    useEffect(() => {
        if (scoringTab !== 'bonos' || !leagueId) {
            return;
        }

        let cancelled = false;
        void request<PhaseBonusProgressItem[]>(`/predictions/league/${leagueId}/phase-bonus-progress`)
            .then((data) => {
                if (!cancelled) setPhaseBonusProgress(data);
            })
            .catch(() => {
                if (!cancelled) setPhaseBonusProgress([]);
            });

        return () => {
            cancelled = true;
        };
    }, [scoringTab, leagueId]);

    const exactScore      = getPoints(scoringRules, 'EXACT_SCORE',        5);
    const correctWinner   = getPoints(scoringRules, 'CORRECT_WINNER',     2);
    const teamGoals       = getPoints(scoringRules, 'TEAM_GOALS',         1);
    const uniquePred      = getPoints(scoringRules, 'UNIQUE_PREDICTION',  5);

    const phaseBonusItems = PHASE_BONUS_HELP_ITEMS.map((item) => ({
        ...item,
        pts: resolvePhaseBonusPoints(scoringRules, item.ruleType),
    }));

    return (
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm" aria-label="Reglas de puntos">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Reglas de puntos</h2>
                <ListChecks className="h-4 w-4 text-slate-300" aria-hidden="true" />
            </div>

            {/* Segmented control */}
            <div role="tablist" aria-label="Secciones de reglas" className="flex rounded-xl bg-slate-100 p-0.5 gap-0.5 mb-4">
                {([
                    { id: 'resultado', label: 'Resultado' },
                    { id: 'bonos', label: 'Bonos' },
                    { id: 'desempate', label: 'Desempate' },
                ] as const).map((tab) => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={scoringTab === tab.id}
                        aria-controls={`scoring-panel-${tab.id}`}
                        id={`scoring-tab-${tab.id}`}
                        onClick={() => setScoringTab(tab.id)}
                        className={`flex-1 rounded-[10px] py-1.5 text-[9px] font-black uppercase tracking-[0.14em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1 ${
                            scoringTab === tab.id
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Panel: Resultado */}
            <div
                role="tabpanel"
                id="scoring-panel-resultado"
                aria-labelledby="scoring-tab-resultado"
                hidden={scoringTab !== 'resultado'}
                className="space-y-1.5"
            >
                {[
                    { label: 'Marcador exacto',  sub: 'Ambos goles exactos',                   pts: fmtPts(exactScore),                   icon: '🎯', accent: 'border-lime-100 bg-lime-50',   text: 'text-lime-700' },
                    { label: 'Ganador + gol',    sub: 'Resultado + un marcador correcto',       pts: fmtPts(correctWinner + teamGoals),    icon: '✅⚽', accent: 'border-teal-100 bg-teal-50', text: 'text-teal-700' },
                    { label: 'Solo ganador',     sub: 'Empate o equipo ganador',                pts: fmtPts(correctWinner),                icon: '✅',  accent: 'border-blue-100 bg-blue-50',   text: 'text-blue-700' },
                    { label: 'Solo gol acertado',sub: 'Al menos un marcador exacto',           pts: fmtPts(teamGoals),                    icon: '⚽',  accent: 'border-purple-100 bg-purple-50', text: 'text-purple-700' },
                ].map((r) => (
                    <div key={r.label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${r.accent}`}>
                        <span className="text-base leading-none shrink-0" aria-hidden="true">{r.icon}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-800 leading-tight">{r.label}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{r.sub}</p>
                        </div>
                        <span className={`text-sm font-black shrink-0 ${r.text}`}>{r.pts}</span>
                    </div>
                ))}
                <p className="text-[9px] text-slate-400 pt-1 leading-snug">
                    El marcador exacto ({fmtPts(exactScore)}) no se suma con otros bonos. El resto es <span className="font-bold text-slate-500">aditivo</span>.
                    En eliminatorias, marcador, ganador y gol se multiplican ×{KNOCKOUT_MULTIPLIER} (ej. exacto = {fmtKnockoutPts(exactScore)}).
                </p>
            </div>

            {/* Panel: Bonos */}
            <div
                role="tabpanel"
                id="scoring-panel-bonos"
                aria-labelledby="scoring-tab-bonos"
                hidden={scoringTab !== 'bonos'}
                className="space-y-3"
            >
                <KnockoutMultiplierGuide variant="compact" />
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1.5">Predicción única</p>
                    <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                        <span className="text-base leading-none shrink-0" aria-hidden="true">⭐</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-800 leading-tight">Marcador único en la liga</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">Nadie más predijo ese marcador exacto</p>
                        </div>
                        <span className="text-sm font-black text-amber-600 shrink-0">+{fmtPts(uniquePred)}</span>
                    </div>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1">Bono clasificados</p>
                    <p className="text-[9px] text-slate-400 leading-snug mb-1.5">
                        Predice qué equipo clasifica en cada partido de eliminatoria.
                        El bono se otorga al <span className="font-bold text-slate-600">cerrar la fase</span> si todos tus picks son correctos.
                    </p>
                    {phaseBonusProgress && phaseBonusProgress.length > 0 && (
                        <PhaseBonusProgressIndicator items={phaseBonusProgress} variant="ranking" className="mb-2" />
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {phaseBonusItems.map((bonus) => (
                            <div key={bonus.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs leading-none shrink-0" aria-hidden="true">{bonus.icon}</span>
                                    <div className="min-w-0">
                                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-600 truncate block">{bonus.label}</span>
                                        <span className="text-[8px] text-slate-400">{bonus.sub}</span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-[11px] font-black text-lime-600">+{fmtPts(bonus.pts)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Panel: Desempate */}
            <div
                role="tabpanel"
                id="scoring-panel-desempate"
                aria-labelledby="scoring-tab-desempate"
                hidden={scoringTab !== 'desempate'}
                className="space-y-1.5"
            >
                <p className="text-[9px] text-slate-500 leading-snug mb-2">
                    Cuando dos participantes tienen los mismos puntos, se aplican estos criterios <span className="font-bold">en orden</span> hasta resolver el empate:
                </p>
                {[
                    { n: '1', label: 'Puntos totales', icon: '🏅' },
                    { n: '2', label: 'Campeón acertado', icon: '🏆' },
                    { n: '3', label: 'Marcadores exactos', icon: '🎯' },
                    { n: '4', label: 'Ganadores acertados', icon: '✅' },
                    { n: '5', label: 'Goles acertados', icon: '⚽' },
                    { n: '6', label: 'Predicciones únicas', icon: '⭐' },
                ].map((c) => (
                    <div key={c.n} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <span className="text-[10px] font-black text-slate-300 w-3 shrink-0 tabular-nums">{c.n}</span>
                        <span className="text-sm leading-none shrink-0" aria-hidden="true">{c.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">{c.label}</span>
                    </div>
                ))}
            </div>
        </article>
    );
};

export default ScoringRulesCard;
