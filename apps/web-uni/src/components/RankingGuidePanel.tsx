import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { TIEBREAK_ROW_METRICS } from '@polla-2026/shared';
import { POINTS_LEGEND } from '../views/ranking.utils';

export function RankingGuidePanel() {
    const [expanded, setExpanded] = useState(false);
    const panelId = useId();

    return (
        <section
            className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden mb-4"
            aria-label="Guía del ranking"
        >
            <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="w-full min-h-[3rem] px-3 py-3 sm:px-4 text-left hover:bg-slate-50/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
            >
                <div className="flex items-start gap-2 sm:gap-3">
                    <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                            Guía del ranking
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 leading-snug">
                            {expanded
                                ? 'Toca para ocultar la explicación'
                                : 'Iconos de desempate en cada fila · Toca para ver qué significa cada uno'}
                        </p>

                        {!expanded && (
                            <div
                                className="mt-2 -mx-1 px-1 flex gap-1.5 overflow-x-auto pb-0.5 snap-x snap-mandatory sm:flex-wrap sm:overflow-visible"
                                aria-hidden="true"
                            >
                                {TIEBREAK_ROW_METRICS.map((metric, index) => (
                                    <span
                                        key={metric.id}
                                        className="inline-flex shrink-0 snap-start items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 min-h-[2rem]"
                                    >
                                        <span className="text-sm leading-none">{metric.icon}</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 whitespace-nowrap">
                                            {metric.shortLabel}
                                        </span>
                                        <span className="text-[8px] font-black text-slate-300 tabular-nums">
                                            {index + 1}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <span className="shrink-0 pt-0.5 text-slate-400" aria-hidden="true">
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                </div>
            </button>

            <div
                id={panelId}
                hidden={!expanded}
                className="border-t border-slate-100 px-3 pb-4 pt-3 sm:px-4 space-y-4"
            >
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Criterios de desempate (en orden)
                    </h3>
                    <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {TIEBREAK_ROW_METRICS.map((metric, index) => (
                            <li
                                key={metric.id}
                                className="flex gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 sm:p-3"
                            >
                                <div className="flex flex-col items-center shrink-0 w-8">
                                    <span className="text-[9px] font-black text-slate-300 tabular-nums">
                                        {index + 1}
                                    </span>
                                    <span className="text-lg leading-none mt-0.5" aria-hidden="true">
                                        {metric.icon}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black text-slate-800 leading-tight">
                                        {metric.label}
                                    </p>
                                    <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 leading-snug">
                                        {metric.description}
                                    </p>
                                    <p className="text-[9px] text-slate-400 mt-1.5">
                                        En cada fila verás{' '}
                                        <span className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1 py-0.5 font-bold text-slate-600">
                                            <span aria-hidden="true">{metric.icon}</span>
                                            <span>valor</span>
                                        </span>
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>

                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                        Leyenda de puntos por partido
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                        {POINTS_LEGEND.map((item) => (
                            <span
                                key={item.code}
                                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600"
                            >
                                <span className="text-slate-400">{item.code}:</span> {item.label}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wide text-amber-800">
                        Cuando hay empate en puntos
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-amber-900/80 leading-snug">
                        Se comparan los criterios anteriores uno a uno. Si alguien gana en un criterio, queda arriba.
                        La fila muestra <span className="font-semibold text-emerald-700">por encima del siguiente</span> o{' '}
                        <span className="font-semibold text-slate-600">por debajo del anterior</span>.
                        Si todos los valores coinciden, comparten la misma posición.
                    </p>
                </div>

                <p className="text-[10px] text-slate-400 leading-snug">
                    Toca cualquier participante en la tabla para ver el detalle partido a partido.
                </p>
            </div>
        </section>
    );
}
