import React, { useRef, useCallback } from 'react';
import { AlertTriangle, Clock, Zap, Trophy, CheckCircle2 } from 'lucide-react';
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
    groupBy: 'smart' | 'date';
    search: string;
    onSaved: (matchId: string, home: number, away: number) => void;
}

export function MatchSections({
    filtered, leagueId, closeMin, groupBy, search, onSaved,
}: Props) {
    const homeRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const awayRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const focusNext = useCallback((currentId: string, side: 'home' | 'away') => {
        const ids = filtered.map(m => m.id);
        const idx = ids.indexOf(currentId);
        if (idx < 0) return;
        if (side === 'home') {
            awayRefs.current[currentId]?.focus();
            return;
        }
        const nextId = ids[idx + 1];
        if (nextId) homeRefs.current[nextId]?.focus();
    }, [filtered]);

    const makeRow = (m: UpcomingMatch, opts?: { isNext?: boolean; isWithoutPrediction?: boolean }) => (
        <PredictionRow
            key={m.id} match={m}
            leagueId={leagueId}
            closeMin={closeMin}
            onSaved={onSaved}
            isNext={opts?.isNext}
            isWithoutPrediction={opts?.isWithoutPrediction}
            onHomeEnter={() => focusNext(m.id, 'home')}
            onAwayEnter={() => focusNext(m.id, 'away')}
            homeInputRef={el => { homeRefs.current[m.id] = el; }}
            awayInputRef={el => { awayRefs.current[m.id] = el; }}
        />
    );

    /* ── Smart grouping ── */
    const smartSorted = [...filtered].sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

    const live = smartSorted.filter(m => isLiveStatus(m.status));
    const next = smartSorted.find(m => !isFinishedStatus(m.status) && !isLiveStatus(m.status) && !isPredictionClosed(m.matchDate, closeMin));
    const unsaved = smartSorted.filter(m => {
        const cl = isPredictionClosed(m.matchDate, closeMin);
        return !cl && !isFinishedStatus(m.status) && !isLiveStatus(m.status) && !m.myPrediction && m.id !== next?.id;
    });
    const saved = smartSorted.filter(m => {
        const cl = isPredictionClosed(m.matchDate, closeMin);
        return !cl && !isFinishedStatus(m.status) && !isLiveStatus(m.status) && !!m.myPrediction && m.id !== next?.id;
    });
    const closedOrFinished = smartSorted.filter(m => {
        const cl = isPredictionClosed(m.matchDate, closeMin);
        return (cl || isFinishedStatus(m.status)) && !isLiveStatus(m.status) && m.id !== next?.id;
    });

    type SmartGroup = { id: string; title: string; icon: React.ReactNode; color: string; bg: string; border: string; matches: UpcomingMatch[]; isNext?: boolean };
    const smartGroups: SmartGroup[] = [
        { id: 'live', title: 'En vivo', icon: <Zap size={12} />, color: '#e11d48', bg: '#fff1f2', border: '#fecdd3', matches: live },
        ...(next ? [{ id: 'next', title: 'Próximo', icon: <Clock size={12} />, color: 'var(--color-primary,#f59e0b)', bg: '#fffbeb', border: '#fcd34d', matches: [next], isNext: true }] : []),
        { id: 'unsaved', title: 'Sin pronóstico', icon: <AlertTriangle size={12} />, color: '#f97316', bg: '#fff7ed', border: '#fed7aa', matches: unsaved },
        { id: 'saved', title: 'Con pronóstico', icon: <CheckCircle2 size={12} />, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', matches: saved },
        { id: 'closed', title: 'Cerrados / Finalizados', icon: <Trophy size={12} />, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', matches: closedOrFinished },
    ].filter(g => g.matches.length > 0);

    /* ── Date grouping ── */
    const groupByDate = (list: UpcomingMatch[]) => {
        const map: Record<string, UpcomingMatch[]> = {};
        for (const m of list) {
            const k = getDateKey(m.matchDate);
            if (!map[k]) map[k] = [];
            map[k].push(m);
        }
        return map;
    };
    const dateMap = groupByDate(smartSorted);
    const dateKeys = Object.keys(dateMap).sort();

    if (filtered.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm">
                {search ? `Sin resultados para "${search}"` : 'No hay partidos en esta polla aún'}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {groupBy === 'smart' ? (
                <>
                    {smartGroups.map(g => (
                        <div key={g.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: g.border, backgroundColor: g.bg }}>
                            <div className="px-4 py-2 flex items-center gap-2" style={{ color: g.color }}>
                                {g.icon}
                                <span className="text-[11px] font-black uppercase tracking-wider">{g.title}</span>
                                <span className="ml-auto text-[10px] font-bold opacity-60">{g.matches.length}</span>
                            </div>
                            <div className="divide-y divide-slate-100 bg-white">
                                {g.matches.map(m => makeRow(m, { isNext: g.isNext, isWithoutPrediction: g.id === 'unsaved' }))}
                            </div>
                        </div>
                    ))}
                </>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
                    {dateKeys.map(dateKey => {
                        const dayMatches = dateMap[dateKey];
                        const firstDate = dayMatches[0].matchDate;
                        return (
                            <div key={dateKey}>
                                <div className="px-4 py-2 bg-slate-50 flex items-center gap-1.5">
                                    <Clock size={10} className="text-slate-400" />
                                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">{formatDateHeader(firstDate)}</span>
                                    <span className="ml-auto text-[10px] font-bold text-slate-400">{dayMatches.length}</span>
                                </div>
                                <div>
                                    {dayMatches.map(m => makeRow(m))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
