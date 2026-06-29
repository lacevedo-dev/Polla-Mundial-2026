import React from 'react';
import {
    KNOCKOUT_PHASE_MULTIPLIER,
    KNOCKOUT_MULTIPLIER_EXAMPLES,
    KNOCKOUT_MULTIPLIER_FORMULA,
    KNOCKOUT_MULTIPLIER_NOT_APPLIES,
    KNOCKOUT_MULTIPLIER_STEPS,
    KNOCKOUT_PHASES_LABEL,
} from '@polla-2026/shared';

type Variant = 'card' | 'compact';

interface KnockoutMultiplierGuideProps {
    variant?: Variant;
    className?: string;
    /** En panel compacto (ej. card del dashboard) se omiten los 4 ejemplos. */
    showExamples?: boolean;
}

export const KnockoutMultiplierGuide: React.FC<KnockoutMultiplierGuideProps> = ({
    variant = 'card',
    className = '',
    showExamples = variant !== 'compact',
}) => {
    const isCompact = variant === 'compact';

    return (
        <div
            className={`${isCompact ? 'space-y-3' : 'rounded-[2rem] border-2 border-sky-200 bg-sky-50 p-6 space-y-4'} ${className}`}
            aria-labelledby="knockout-multiplier-guide-title"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xl" aria-hidden="true">🔥</span>
                        <h4
                            id="knockout-multiplier-guide-title"
                            className={`font-black uppercase tracking-wide text-sky-900 ${isCompact ? 'text-[10px] tracking-[0.16em]' : 'text-sm'}`}
                        >
                            Multiplicador en eliminatorias
                        </h4>
                    </div>
                    <p className={`text-sky-800 leading-relaxed ${isCompact ? 'text-[10px]' : 'text-sm'}`}>
                        No es un bono fijo: es <strong>× {KNOCKOUT_PHASE_MULTIPLIER}</strong> sobre tus aciertos del partido
                        en {KNOCKOUT_PHASES_LABEL}.
                    </p>
                </div>
                <span className={`font-black text-sky-700 tabular-nums shrink-0 ${isCompact ? 'text-lg' : 'text-3xl'}`}>
                    ×{KNOCKOUT_PHASE_MULTIPLIER}
                </span>
            </div>

            <div className={`rounded-xl bg-white/80 border border-sky-200 px-3 py-2.5 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                <p className="font-black uppercase tracking-wide text-sky-900 text-[10px] mb-1">Fórmula</p>
                <p className="font-mono font-bold text-sky-800">{KNOCKOUT_MULTIPLIER_FORMULA}</p>
            </div>

            <ol className={`space-y-2 ${isCompact ? 'text-[10px] text-sky-800' : 'text-xs text-sky-800'}`}>
                {KNOCKOUT_MULTIPLIER_STEPS.map((step, idx) => (
                    <li key={step} className="flex gap-2 leading-relaxed">
                        <span className="font-black text-sky-500 shrink-0">{idx + 1}.</span>
                        <span>{step}</span>
                    </li>
                ))}
            </ol>

            <div className="space-y-2">
                {showExamples ? (
                    <>
                        <p className={`font-black uppercase tracking-wide text-sky-900 ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                            Ejemplos (resultado real 0-1)
                        </p>
                        <div className="space-y-1.5">
                            {KNOCKOUT_MULTIPLIER_EXAMPLES.map((ex) => (
                                <div
                                    key={ex.pred}
                                    className={`rounded-xl border px-3 py-2 ${
                                        'highlight' in ex && ex.highlight
                                            ? 'border-amber-300 bg-amber-50/90'
                                            : 'border-sky-100 bg-white/90'
                                    }`}
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className={`min-w-0 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                                            <span className="font-black text-slate-800">{ex.label}</span>
                                            <span className="text-slate-500">
                                                {' '}
                                                · Pronóstico <strong className="text-slate-700">{ex.pred}</strong>
                                            </span>
                                        </div>
                                        <span className={`font-black tabular-nums ${'highlight' in ex && ex.highlight ? 'text-amber-700' : 'text-sky-700'} ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                            {ex.total}
                                        </span>
                                    </div>
                                    <p className={`mt-1 font-mono text-slate-600 ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                                        {ex.calc} = {ex.total}
                                    </p>
                                    {'note' in ex && ex.note && (
                                        <p className={`mt-1 text-amber-800 ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                                            {ex.note}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/90 px-3 py-2">
                        <p className="text-[10px] font-black text-slate-800">Ganador + gol · Pronóstico 0-2 · Resultado 0-1</p>
                        <p className="mt-1 font-mono text-[9px] text-slate-600">(2 + 1) = 3 pts × 1.5 = 4.5 pts</p>
                        <p className="mt-1 text-[9px] text-amber-800">Primero sumas; luego multiplicas el total.</p>
                    </div>
                )}
            </div>

            <div className={`rounded-xl bg-sky-100/80 border border-sky-200 px-3 py-2 space-y-1 ${isCompact ? 'text-[9px] text-sky-800' : 'text-[10px] text-sky-800'}`}>
                <p className="font-black uppercase tracking-wide">No usa × {KNOCKOUT_PHASE_MULTIPLIER}</p>
                <ul className="space-y-0.5">
                    {KNOCKOUT_MULTIPLIER_NOT_APPLIES.map((item) => (
                        <li key={item}>· {item}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};
