import React from 'react';
import type { MatchViewModel } from '../../stores/prediction.store';
import { requiresKnockoutAdvanceSelection } from '../../utils/knockout-advance';

export type AdvanceTeamSelectorProps = {
    match: Pick<
        MatchViewModel,
        'id' | 'homeTeamId' | 'awayTeamId' | 'homeTeamCode' | 'awayTeamCode' | 'advancingTeamId' | 'isKnockout'
    >;
    draft: { home: string; away: string; advanceTeamId?: string };
    canEdit: boolean;
    onSelect: (matchId: string, teamId: string) => void;
    className?: string;
    layout?: 'default' | 'centered';
};

export function AdvanceTeamSelector({
    match,
    draft,
    canEdit,
    onSelect,
    className,
    layout = 'default',
}: AdvanceTeamSelectorProps) {
    if (!match.isKnockout) {
        return null;
    }

    const isCentered = layout === 'centered';
    const tieRequiresSelection = requiresKnockoutAdvanceSelection(
        draft.home,
        draft.away,
        draft.advanceTeamId,
    );

    if (!canEdit && match.advancingTeamId) {
        return (
            <div
                className={`flex items-center gap-1.5 ${
                    isCentered ? 'w-full justify-center' : ''
                } ${className ?? ''}`}
            >
                <span className="text-[9px] font-black uppercase text-slate-400">Clasificó:</span>
                <span className="text-[11px] font-bold text-lime-600">
                    {match.advancingTeamId === match.homeTeamId ? match.homeTeamCode : match.awayTeamCode}
                </span>
                {draft.advanceTeamId && (
                    <span
                        className={`text-[9px] font-black uppercase ${
                            draft.advanceTeamId === match.advancingTeamId ? 'text-lime-500' : 'text-rose-500'
                        }`}
                    >
                        {draft.advanceTeamId === match.advancingTeamId ? '✓ Acertaste' : '✗ Fallaste'}
                    </span>
                )}
            </div>
        );
    }

    if (!canEdit) {
        return null;
    }

    const panelClasses = tieRequiresSelection
        ? 'border-2 border-amber-300 bg-amber-50/90 ring-1 ring-amber-200/60'
        : 'border border-slate-200 bg-slate-50/90';

    const content = (
        <>
            <div className={`flex flex-wrap items-center gap-2 ${isCentered ? 'justify-center' : ''}`}>
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Clasifica:</span>
                <button
                    type="button"
                    onClick={() => onSelect(match.id, match.homeTeamId)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                        draft.advanceTeamId === match.homeTeamId
                            ? 'bg-lime-400 text-slate-900 shadow-sm'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                    }`}
                >
                    {match.homeTeamCode}
                </button>
                <button
                    type="button"
                    onClick={() => onSelect(match.id, match.awayTeamId)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                        draft.advanceTeamId === match.awayTeamId
                            ? 'bg-lime-400 text-slate-900 shadow-sm'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                    }`}
                >
                    {match.awayTeamCode}
                </button>
            </div>
            {tieRequiresSelection ? (
                <span className={`text-[9px] font-bold text-amber-700 ${isCentered ? 'text-center' : ''}`}>
                    Selecciona quién pasa en penales
                </span>
            ) : (
                <span className={`text-[9px] font-medium text-slate-400 ${isCentered ? 'text-center' : ''}`}>
                    {draft.advanceTeamId ? 'Definido por el marcador' : 'Se asigna al ganador del marcador'}
                </span>
            )}
        </>
    );

    if (isCentered) {
        return (
            <div className={`flex w-full flex-col items-center ${className ?? ''}`}>
                <div className={`flex w-full max-w-sm flex-col items-center gap-1.5 rounded-xl px-3 py-2 ${panelClasses}`}>
                    {content}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1 ${
                tieRequiresSelection ? 'bg-amber-50/80 ring-2 ring-amber-300' : ''
            } ${className ?? ''}`}
        >
            {content}
        </div>
    );
}
