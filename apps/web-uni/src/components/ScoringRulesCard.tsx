import React, { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { TIEBREAK_CRITERIA } from '@polla-2026/shared';

type ScoringTab = 'resultado' | 'bonos' | 'desempate';

export function ScoringRulesCard() {
    const [scoringTab, setScoringTab] = useState<ScoringTab>('desempate');

    return (
        <article
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
            aria-label="Reglas de puntos"
        >
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                    Reglas de puntos
                </h2>
                <ListChecks className="h-4 w-4 text-slate-300" aria-hidden="true" />
            </div>

            <div
                role="tablist"
                aria-label="Secciones de reglas"
                className="flex rounded-xl bg-slate-100 p-0.5 gap-0.5 mb-4"
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
                    { label: 'Marcador exacto', sub: 'Ambos goles exactos', pts: '5 pts', icon: '🎯', accent: 'border-amber-100 bg-amber-50', text: 'text-amber-700' },
                    { label: 'Ganador + gol', sub: 'Resultado + un marcador correcto', pts: '3 pts', icon: '✅⚽', accent: 'border-teal-100 bg-teal-50', text: 'text-teal-700' },
                    { label: 'Solo ganador', sub: 'Empate o equipo ganador', pts: '2 pts', icon: '✅', accent: 'border-blue-100 bg-blue-50', text: 'text-blue-700' },
                    { label: 'Solo gol acertado', sub: 'Al menos un marcador exacto', pts: '1 pt', icon: '⚽', accent: 'border-purple-100 bg-purple-50', text: 'text-purple-700' },
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
                    El marcador exacto (5 pts) no se suma con otros bonos. El resto es{' '}
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
                        <span className="text-sm font-black text-amber-600 shrink-0">+5 pts</span>
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
                            { label: 'Octavos', pts: '8 pts', icon: '🥈' },
                            { label: 'Cuartos', pts: '4 pts', icon: '🥉' },
                            { label: 'Semifinal', pts: '2 pts', icon: '🏅' },
                            { label: 'Campeón', pts: '5 pts', icon: '🏆' },
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
                                    {bonus.pts}
                                </span>
                            </div>
                        ))}
                    </div>
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
        </article>
    );
}
