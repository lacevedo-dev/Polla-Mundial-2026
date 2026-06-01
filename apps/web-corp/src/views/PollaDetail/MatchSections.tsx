import React from 'react';
import { AlertTriangle, Clock, Zap } from 'lucide-react';
import { UpcomingMatch } from './types';
import { PredictionRow } from './PredictionRow';
import {
    isLiveStatus, isFinishedStatus, isPredictionClosed,
    getDateKey, formatDateHeader,
} from './helpers';

interface Props {
    filtered: UpcomingMatch[];
    leagueId: string;
    closeMin: number;
    viewMode: 'expanded' | 'compact';
    search: string;
    onSaved: (matchId: string, home: number, away: number) => void;
    onGroupSelect: (group: string) => void;
}

export function MatchSections({
    filtered, leagueId, closeMin, viewMode, search, onSaved, onGroupSelect,
}: Props) {
    const nextMatch = filtered.find(m => !isFinishedStatus(m.status) && !isLiveStatus(m.status));

    const withoutPrediction = filtered.filter(m => {
        const cl = isPredictionClosed(m.matchDate, closeMin);
        return !cl && !isFinishedStatus(m.status) && !isLiveStatus(m.status) && !m.myPrediction && m.id !== nextMatch?.id;
    });

    const rest = filtered.filter(m =>
        m.id !== nextMatch?.id && !withoutPrediction.find(x => x.id === m.id)
    );

    /* Agrupar por fecha */
    const groupByDate = (list: UpcomingMatch[]) => {
        const map: Record<string, UpcomingMatch[]> = {};
        for (const m of list) {
            const k = getDateKey(m.matchDate);
            if (!map[k]) map[k] = [];
            map[k].push(m);
        }
        return map;
    };

    const restByDate = groupByDate(rest);
    const restDates = Object.keys(restByDate).sort();
    const noPredByDate = groupByDate(withoutPrediction);
    const noPredDates = Object.keys(noPredByDate).sort();

    const makeRow = (m: UpcomingMatch, opts?: { isNext?: boolean; isWithoutPrediction?: boolean }) => (
        <PredictionRow
            key={m.id} match={m}
            leagueId={leagueId}
            closeMin={closeMin}
            onSaved={onSaved}
            compact={viewMode === 'compact'}
            isNext={opts?.isNext}
            isWithoutPrediction={opts?.isWithoutPrediction}
        />
    );

    if (filtered.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm">
                {search ? `Sin resultados para "${search}"` : 'No hay partidos en esta polla aún'}
            </div>
        );
    }

    return (
        <>
            {/* Próximo partido */}
            {nextMatch && (
                <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: 'var(--color-primary,#f59e0b)' }}>
                    <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: 'var(--color-primary,#f59e0b)' }}>
                        <Zap size={12} className="text-white" />
                        <span className="text-[11px] font-black text-white uppercase tracking-wider">
                            {isLiveStatus(nextMatch.status) ? 'En vivo' : 'Próximo partido'}
                        </span>
                    </div>
                    <div className="bg-white">
                        {makeRow(nextMatch, { isNext: true })}
                    </div>
                </div>
            )}

            {/* Sin pronóstico — agrupado por fecha */}
            {withoutPrediction.length > 0 && (
                <div className="rounded-2xl border border-amber-200 overflow-hidden" style={{ backgroundColor: '#fffbeb' }}>
                    <div className="px-4 py-2.5 border-b border-amber-200 flex items-center gap-2">
                        <AlertTriangle size={12} className="text-amber-500" />
                        <span className="text-[11px] font-black text-amber-700 uppercase tracking-wider">
                            Sin pronóstico ({withoutPrediction.length})
                        </span>
                    </div>
                    {noPredDates.map(dateKey => {
                        const dayMatches = noPredByDate[dateKey];
                        const firstDate = dayMatches[0].matchDate;
                        return (
                            <div key={dateKey}>
                                <div className="px-4 py-1.5 border-b border-amber-100 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                        ↑ Ingresa tu pronóstico
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">{formatDateHeader(firstDate)}</span>
                                </div>
                                <div className={`bg-white ${viewMode === 'compact' ? '' : 'divide-y divide-slate-100'}`}>
                                    {dayMatches.map(m => makeRow(m, { isWithoutPrediction: true }))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Resto de partidos — agrupado por fecha */}
            {rest.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {restDates.map(dateKey => {
                        const dayMatches = restByDate[dateKey];
                        const firstDate = dayMatches[0].matchDate;
                        const primaryGroup = dayMatches.find(m => m.group)?.group;
                        return (
                            <div key={dateKey}>
                                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={10} className="text-slate-400" />
                                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                                            {formatDateHeader(firstDate)}
                                        </span>
                                    </div>
                                    {primaryGroup && (
                                        <button
                                            onClick={() => onGroupSelect(primaryGroup)}
                                            className="text-[10px] font-black hover:opacity-70 transition-opacity"
                                            style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                            Ver Grupo {primaryGroup} ›
                                        </button>
                                    )}
                                </div>
                                <div className={viewMode === 'compact' ? '' : 'divide-y divide-slate-100'}>
                                    {dayMatches.map(m => makeRow(m))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}
