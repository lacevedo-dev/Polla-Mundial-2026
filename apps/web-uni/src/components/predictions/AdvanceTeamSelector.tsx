import React from 'react';
import {
    getLiveAdvancePickStatus,
    requiresKnockoutAdvanceSelection,
    resolvePredictionAdvanceTeamId,
    type MatchUiStatus,
} from '../../utils/knockout-advance';

export type KnockoutMatchForAdvance = {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeamCode: string;
    awayTeamCode: string;
    advancingTeamId?: string | null;
    isKnockout: boolean;
    status?: MatchUiStatus;
    statusShort?: string | null;
    result?: { home: number; away: number };
};

export type AdvanceTeamSelectorProps = {
    match: KnockoutMatchForAdvance;
    draft: { home: string; away: string; advanceTeamId?: string };
    canEdit: boolean;
    onSelect: (matchId: string, teamId: string) => void;
    className?: string;
    layout?: 'default' | 'centered';
    tone?: 'light' | 'dark';
};

export function AdvanceTeamSelector({
    match,
    draft,
    canEdit,
    onSelect,
    className,
    layout = 'default',
    tone = 'light',
}: AdvanceTeamSelectorProps) {
    if (!match.isKnockout) {
        return null;
    }

    const isCentered = layout === 'centered';
    const isDark = tone === 'dark';
    const tieRequiresSelection = requiresKnockoutAdvanceSelection(
        draft.home,
        draft.away,
        draft.advanceTeamId,
    );
    const resolvedAdvanceTeamId = resolvePredictionAdvanceTeamId(
        match.homeTeamId,
        match.awayTeamId,
        draft,
    );

    if (!canEdit && match.advancingTeamId) {
        return (
            <div
                className={`flex items-center gap-1.5 ${
                    isCentered ? 'w-full justify-center' : ''
                } ${className ?? ''}`}
            >
                <span className={`text-[9px] font-black uppercase ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                    Clasificó:
                </span>
                <span className={`text-[11px] font-bold ${isDark ? 'text-lime-300' : 'text-lime-600'}`}>
                    {match.advancingTeamId === match.homeTeamId ? match.homeTeamCode : match.awayTeamCode}
                </span>
                {draft.advanceTeamId && (
                    <span
                        className={`text-[9px] font-black uppercase ${
                            draft.advanceTeamId === match.advancingTeamId
                                ? isDark ? 'text-lime-300' : 'text-lime-500'
                                : isDark ? 'text-rose-300' : 'text-rose-500'
                        }`}
                    >
                        {draft.advanceTeamId === match.advancingTeamId ? '✓ Acertaste' : '✗ Fallaste'}
                    </span>
                )}
            </div>
        );
    }

    if (!canEdit && match.status === 'live' && resolvedAdvanceTeamId) {
        const advanceCode =
            resolvedAdvanceTeamId === match.homeTeamId ? match.homeTeamCode : match.awayTeamCode;
        const liveStatus = getLiveAdvancePickStatus({
            resolvedAdvanceTeamId,
            advancingTeamId: match.advancingTeamId ?? undefined,
            result: match.result,
            statusShort: match.statusShort,
        });

        return (
            <div
                className={`flex flex-col gap-0.5 ${
                    isCentered ? 'w-full items-center text-center' : ''
                } ${className ?? ''}`}
            >
                <div className={`flex flex-wrap items-center gap-1.5 ${isCentered ? 'justify-center' : ''}`}>
                    <span className={`text-[9px] font-black uppercase ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                        Tu clasificado:
                    </span>
                    <span className={`text-[11px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {advanceCode}
                    </span>
                    {liveStatus === 'winning' && (
                        <span className={`text-[9px] font-black uppercase ${isDark ? 'text-lime-300' : 'text-lime-500'}`}>
                            ✓ Acertaste
                        </span>
                    )}
                    {liveStatus === 'losing' && (
                        <span className={`text-[9px] font-black uppercase ${isDark ? 'text-rose-300' : 'text-rose-500'}`}>
                            ✗ Fallaste
                        </span>
                    )}
                </div>
                {liveStatus === 'pending_penalties' && (
                    <span className={`text-[9px] font-bold ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
                        Definiendo en penales
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
