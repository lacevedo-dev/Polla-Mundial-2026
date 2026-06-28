import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import { TIEBREAK_CRITERIA } from '@polla-2026/shared';

type ScoringTab = 'resultado' | 'bonos' | 'desempate';

interface ScoringRule {
    ruleType: string;
    points: number;
    active?: boolean;
    description?: string | null;
}

interface ScoringRulesCardProps {
    defaultExpanded?: boolean;
    defaultTab?: ScoringTab;
    className?: string;
    scoringRules?: ScoringRule[];
}

function getPoints(rules: ScoringRule[] | undefined, ruleType: string, fallback: number): number {
    if (!rules) return fallback;
    const rule = rules.find((r) => r.ruleType === ruleType && r.active !== false);
    return rule?.points ?? fallback;
}

function fmtPts(n: number): string {
    return `${n} ${n === 1 ? 'pt' : 'pts'}`;
}

export function ScoringRulesCard({
    defaultExpanded = false,
    defaultTab = 'desempate',
    className = '',
    scoringRules,
}: ScoringRulesCardProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [scoringTab, setScoringTab] = useState<ScoringTab>(defaultTab);

    const exactScore    = getPoints(scoringRules, 'EXACT_SCORE',        5);
    const correctWinner = getPoints(scoringRules, 'CORRECT_WINNER',     2);
    const teamGoals     = getPoints(scoringRules, 'TEAM_GOALS',         1);
    const uniquePred    = getPoints(scoringRules, 'UNIQUE_PREDICTION',  5);
    const bonusR16      = getPoints(scoringRules, 'PHASE_BONUS_R16',    8);
    const bonusQF       = getPoints(scoringRules, 'PHASE_BONUS_QF',     4);
    const bonusSF       = getPoints(scoringRules, 'PHASE_BONUS_SF',     2);
    const bonusFinal    = getPoints(scoringRules, 'PHASE_BONUS_FINAL',  5);

    return (
        <article
            className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`}
            aria-label="Reglas de puntos"
        >
            <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
            >
                <ListChecks className="h-4 w-4 text-slate-300 shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-900">
                        Reglas de puntos
                    </h2>
                    {!expanded && (
                        <p className="text-[9px] text-slate-400 mt-0.5 truncate">
                            Resultado · Bonos · Desempate (6 criterios en orden)
                        </p>
                    )}
                </div>
                {expanded
                    ? <ChevronUp size={16} className="text-slate-400 shrink-0" />
                    : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
            </button>

            {expanded && (
                <div className="px-4 pb-4 border-t border-slate-100">
                    <div
                        role="tablist"
                        aria-label="Secciones de reglas"
                        className="flex rounded-xl bg-slate-100 p-0.5 gap-0.5 my-3"
                    >
                        {([
                            { id: 'resultado', label: 'Resultado' },
                            { id: 'bonos', label: 'Bonos' },
                            { id: 'desempate', label: 'Desempate' },
                        ] as const).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={scoringTab === tab.id}
                                aria-controls={`scoring-panel-${tab.id}`}
                                id={`scoring-tab-${tab.id}`}
                                onClick={() => setScoringTab(tab.id)}
                                className={`flex-1 rounded-[10px] py-1.5 text-[9px] font-black uppercase tracking-[0.14em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                                    scoringTab === tab.id
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div
                        role="tabpanel"
                        id="scoring-panel-resultado"
                        aria-labelledby="scoring-tab-resultado"
                        hidden={scoringTab !== 'resultado'}
                        className="space-y-1.5"
                    >
                        {[
                            { label: 'Marcador exacto',   sub: 'Ambos goles exactos',                 pts: fmtPts(exactScore),                icon: '🎯', accent: 'border-amber-100 bg-amber-50',   text: 'text-amber-700' },
                            { label: 'Ganador + gol',     sub: 'Resultado + un marcador correcto',    pts: fmtPts(correctWinner + teamGoals), icon: '✅⚽', accent: 'border-teal-100 bg-teal-50',   text: 'text-teal-700' },
                            { label: 'Solo ganador',      sub: 'Empate o equipo ganador',             pts: fmtPts(correctWinner),             icon: '✅',  accent: 'border-blue-100 bg-blue-50',    text: 'text-blue-700' },
                            { label: 'Solo gol acertado', sub: 'Al menos un marcador exacto',        pts: fmtPts(teamGoals),                 icon: '⚽',  accent: 'border-purple-100 bg-purple-50', text: 'text-purple-700' },
                        ].map((rule) => (
                            <div key={rule.label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${rule.accent}`}>
                                <span className="text-base leading-none shrink-0" aria-hidden="true">{rule.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-800 leading-tight">{rule.label}</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{rule.sub}</p>
                                </div>
                                <span className={`text-sm font-black shrink-0 ${rule.text}`}>{rule.pts}</span>
                            </div>
                        ))}
                        <p className="text-[9px] text-slate-400 pt-1 leading-snug">
                            El marcador exacto ({fmtPts(exactScore)}) no se suma con otros bonos. El resto es{' '}
                            <span className="font-bold text-slate-500">aditivo</span>.
                        </p>
                    </div>

                    <div
                        role="tabpanel"
                        id="scoring-panel-bonos"
                        aria-labelledby="scoring-tab-bonos"
                        hidden={scoringTab !== 'bonos'}
                        className="space-y-3"
                    >
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
                                El bono se otorga si <span className="font-bold text-slate-600">todos</span> tus picks de la fase son correctos.
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {[
                                    { label: 'Octavos',   pts: bonusR16,   icon: '🥈' },
                                    { label: 'Cuartos',   pts: bonusQF,    icon: '🥉' },
                                    { label: 'Semifinal', pts: bonusSF,    icon: '🏅' },
                                    { label: 'Campeón',   pts: bonusFinal, icon: '🏆' },
                                ].map((bonus) => (
                                    <div key={bonus.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs leading-none" aria-hidden="true">{bonus.icon}</span>
                                            <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-600">{bonus.label}</span>
                                        </div>
                                        <span
                                            className="text-[11px] font-black"
                                            style={{ color: 'var(--color-primary, #f59e0b)' }}
                                        >
                                            {fmtPts(bonus.pts)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[9px] text-slate-500 leading-snug pt-1">
                                Si fallas aunque sea uno de los picks de la fase, no obtienes el bono de esa ronda.
                            </p>
                        </div>
                    </div>

                    <div
                        role="tabpanel"
                        id="scoring-panel-desempate"
                        aria-labelledby="scoring-tab-desempate"
                        hidden={scoringTab !== 'desempate'}
                        className="space-y-1.5"
                    >
                        <p className="text-[9px] text-slate-500 leading-snug mb-2">
                            Cuando dos participantes tienen los mismos puntos, se aplican estos criterios{' '}
                            <span className="font-bold">en orden</span> hasta resolver el empate:
                        </p>
                        {TIEBREAK_CRITERIA.map((criterion, index) => (
                            <div
                                key={criterion.id}
                                className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                            >
                                <span className="text-[10px] font-black text-slate-300 w-3 shrink-0 tabular-nums">
                                    {index + 1}
                                </span>
                                <span className="text-sm leading-none shrink-0" aria-hidden="true">{criterion.icon}</span>
                                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">
                                    {criterion.label}
                                </span>
                            </div>
                        ))}
                        <p className="text-[9px] text-slate-400 pt-1 leading-snug">
                            El ranking aplica estos criterios automáticamente. Si persiste el empate, los participantes comparten posición.
                        </p>
                    </div>
                </div>
            )}
        </article>
    );
}
