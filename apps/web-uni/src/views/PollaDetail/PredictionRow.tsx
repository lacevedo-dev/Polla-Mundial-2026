import React, { useState, useCallback } from 'react';
import { CheckCircle2, Save, Loader2, AlertTriangle, Zap } from 'lucide-react';
import { UpcomingMatch } from './types';
import { Flag } from './Flag';
import {
    isPredictionClosed, isLiveStatus, isFinishedStatus,
    formatMatchTime, getDaysUntil, formatPhaseLabel,
} from './helpers';
import { request } from '../../api';
import { AdvanceTeamSelector } from '../../components/predictions/AdvanceTeamSelector';
import {
    isKnockoutPhase,
    requiresKnockoutAdvanceSelection,
    resolveAdvanceTeamIdFromScore,
    buildKnockoutAdvanceMatch,
} from '../../utils/knockout-advance';
import { SCORE_INPUT_PLACEHOLDER, scoreInputPlaceholderClass } from '../../utils/score-input';

interface Props {
    match: UpcomingMatch;
    leagueId: string;
    closeMin: number;
    isNext?: boolean;
    isWithoutPrediction?: boolean;
    onSaved: (matchId: string, home: number, away: number, advanceTeamId?: string | null) => void;
    onHomeEnter?: () => void;
    onAwayEnter?: () => void;
    homeInputRef?: (el: HTMLInputElement | null) => void;
    awayInputRef?: (el: HTMLInputElement | null) => void;
}

export function PredictionRow({
    match, leagueId, closeMin, onSaved,
    isNext = false, isWithoutPrediction = false,
    onHomeEnter, onAwayEnter, homeInputRef, awayInputRef,
}: Props) {
    const closed = isPredictionClosed(match.matchDate, closeMin);
    const live = isLiveStatus(match.status);
    const finished = isFinishedStatus(match.status);
    const canPredict = !closed && !finished && !live;
    const isKnockout = isKnockoutPhase(match.phase);

    const [home, setHome] = useState(match.myPrediction?.homeScore?.toString() ?? '');
    const [away, setAway] = useState(match.myPrediction?.awayScore?.toString() ?? '');
    const [advanceTeamId, setAdvanceTeamId] = useState<string | undefined>(
        match.myPrediction?.advanceTeamId ?? undefined,
    );
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const initHome = match.myPrediction?.homeScore?.toString() ?? '';
    const initAway = match.myPrediction?.awayScore?.toString() ?? '';
    const initAdvanceTeamId = match.myPrediction?.advanceTeamId ?? undefined;
    const isDirty = home !== initHome || away !== initAway || advanceTeamId !== initAdvanceTeamId;
    const homeCode = (match.homeTeam.shortCode ?? match.homeTeam.name.slice(0, 3)).toUpperCase();
    const awayCode = (match.awayTeam.shortCode ?? match.awayTeam.name.slice(0, 3)).toUpperCase();

    const timeFmt = formatMatchTime(match.matchDate);
    const daysUntil = getDaysUntil(match.matchDate);

    const knockoutMatch = buildKnockoutAdvanceMatch(match, homeCode, awayCode);

    const adjust = useCallback((side: 'home' | 'away', delta: number) => {
        if (!canPredict) return;
        if (side === 'home') {
            setHome((v) => {
                const next = String(Math.max(0, Math.min(99, (parseInt(v) || 0) + delta)));
                if (isKnockout) {
                    setAdvanceTeamId(resolveAdvanceTeamIdFromScore(next, away, match.homeTeam.id, match.awayTeam.id));
                }
                return next;
            });
        } else {
            setAway((v) => {
                const next = String(Math.max(0, Math.min(99, (parseInt(v) || 0) + delta)));
                if (isKnockout) {
                    setAdvanceTeamId(resolveAdvanceTeamIdFromScore(home, next, match.homeTeam.id, match.awayTeam.id));
                }
                return next;
            });
        }
    }, [canPredict, isKnockout, away, home, match.homeTeam.id, match.awayTeam.id]);

    const submit = useCallback(async () => {
        const h = parseInt(home);
        const a = parseInt(away);
        if (isNaN(h) || isNaN(a) || h < 0 || a < 0) { setErr('Marcadores inválidos'); return; }

        if (isKnockout && requiresKnockoutAdvanceSelection(home, away, advanceTeamId)) {
            setErr('En eliminatorias con empate debes indicar qué equipo clasifica.');
            return;
        }

        const resolvedAdvanceTeamId = isKnockout
            ? (advanceTeamId ??
              resolveAdvanceTeamIdFromScore(home, away, match.homeTeam.id, match.awayTeam.id))
            : advanceTeamId;

        setSaving(true); setErr(null);
        try {
            await request('/corp/predictions', {
                method: 'POST',
                body: JSON.stringify({
                    matchId: match.id,
                    leagueId,
                    homeScore: h,
                    awayScore: a,
                    advanceTeamId: resolvedAdvanceTeamId,
                }),
            });
            setSaved(true);
            onSaved(match.id, h, a, resolvedAdvanceTeamId ?? null);
            setTimeout(() => setSaved(false), 2500);
        } catch (e: any) {
            setErr(e?.message ?? 'Error al guardar');
        } finally {
            setSaving(false);
        }
    }, [home, away, leagueId, match.id, match.homeTeam.id, match.awayTeam.id, onSaved, isKnockout, advanceTeamId]);

    const handleHomeChange = useCallback((value: string) => {
        if (value && !/^\d*$/.test(value)) return;
        if (value.length > 2) return;
        setHome(value);
        if (isKnockout) {
            setAdvanceTeamId(resolveAdvanceTeamIdFromScore(value, away, match.homeTeam.id, match.awayTeam.id));
        }
        if (err) setErr(null);
    }, [err, isKnockout, away, match.homeTeam.id, match.awayTeam.id]);

    const handleAwayChange = useCallback((value: string) => {
        if (value && !/^\d*$/.test(value)) return;
        if (value.length > 2) return;
        setAway(value);
        if (isKnockout) {
            setAdvanceTeamId(resolveAdvanceTeamIdFromScore(home, value, match.homeTeam.id, match.awayTeam.id));
        }
        if (err) setErr(null);
    }, [err, isKnockout, home, match.homeTeam.id, match.awayTeam.id]);

    const handleAdvanceSelect = useCallback((_matchId: string, teamId: string) => {
        setAdvanceTeamId(teamId);
        if (err) setErr(null);
    }, [err]);

    const statusBadge = () => {
        if (live) return <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-rose-600 animate-pulse">En vivo</span>;
        if (finished) return <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-slate-500">Finalizado</span>;
        if (canPredict) return <span className="shrink-0 rounded-full border border-lime-200 bg-lime-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-lime-700">Abierto</span>;
        return <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-amber-700">Cerrado</span>;
    };

    const ScoreControl = ({ side, value, onChange, onAdjust, inputRef }: {
        side: 'home' | 'away'; value: string; onChange: (v: string) => void;
        onAdjust: (d: number) => void; inputRef?: (el: HTMLInputElement | null) => void;
    }) => (
        <>
            <input
                ref={inputRef}
                type="tel"
                min={0} max={99} inputMode="numeric" pattern="[0-9]*"
                disabled={!canPredict}
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                placeholder={SCORE_INPUT_PLACEHOLDER}
                className={`h-12 w-14 rounded-xl border-2 border-slate-200 bg-white text-center text-lg font-black text-slate-900 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 disabled:opacity-60 sm:hidden ${scoreInputPlaceholderClass}`}
                style={{ borderColor: canPredict && value !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }}
            />
            <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm sm:flex">
                <button type="button" onClick={() => onAdjust(-1)} disabled={!canPredict}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-400 transition hover:bg-slate-100 disabled:opacity-40">−</button>
                <input ref={inputRef} type="number" min={0} max={99} inputMode="numeric" pattern="[0-9]*"
                    disabled={!canPredict} value={value}
                    placeholder={SCORE_INPUT_PLACEHOLDER}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                    className={`h-8 w-10 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white disabled:opacity-60 ${scoreInputPlaceholderClass}`}
                    style={{ borderColor: canPredict && value !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }}
                />
                <button type="button" onClick={() => onAdjust(1)} disabled={!canPredict}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-400 transition hover:bg-slate-100 disabled:opacity-40">+</button>
            </div>
        </>
    );

    return (
        <div className="border-b border-slate-100 px-4 py-3 last:border-b-0">
            {/* Header */}
            <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="leading-tight">
                        <span className="text-sm font-black text-slate-900">{timeFmt}</span>
                        {daysUntil != null && (
                            <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                {daysUntil}d
                            </span>
                        )}
                    </div>
                    {statusBadge()}
                    {isNext && (
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-amber-600">
                            <Zap size={8} className="inline mr-0.5" />Siguiente
                        </span>
                    )}
                    {isWithoutPrediction && canPredict && (
                        <span className="shrink-0 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-orange-600">
                            <Zap size={8} className="inline mr-0.5" />Sin pronóstico
                        </span>
                    )}
                </div>
                <div className="shrink-0">
                    {canPredict ? (
                        <button onClick={submit} disabled={saving || !isDirty}
                            className="flex h-8 w-8 items-center justify-center rounded-full border transition-all disabled:opacity-40"
                            style={saved
                                ? { backgroundColor: '#d1fae5', color: '#059669', borderColor: '#a7f3d0' }
                                : { backgroundColor: 'var(--color-primary,#f59e0b)', color: '#fff', borderColor: 'transparent' }
                            }>
                            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
                        </button>
                    ) : finished && match.myPrediction?.points != null ? (
                        <span className="text-[10px] font-black" style={{ color: match.myPrediction.points > 0 ? 'var(--color-primary,#f59e0b)' : '#94a3b8' }}>
                            {match.myPrediction.points > 0 ? `+${match.myPrediction.points}` : '0'}pts
                        </span>
                    ) : null}
                </div>
            </div>

            {/* Teams + score */}
            <div className="flex items-center gap-1.5">
                {/* Home */}
                <div className="flex flex-1 items-center gap-2 justify-end min-w-0">
                    <div className="text-right min-w-0 sm:hidden">
                        <Flag team={match.homeTeam} size="lg" />
                        <span className="mt-1 block text-xs font-black uppercase tracking-wide text-slate-900 leading-none">{homeCode}</span>
                        <span className="block w-full truncate text-[9px] leading-none text-slate-400">{match.homeTeam.name}</span>
                    </div>
                    <div className="hidden sm:block text-right min-w-0">
                        <span className="block text-[10px] font-black uppercase text-slate-900 truncate">{match.homeTeam.name}</span>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{homeCode}</span>
                    </div>
                    <div className="hidden sm:block">
                        <Flag team={match.homeTeam} size="lg" />
                    </div>
                </div>

                {finished || live ? (
                    <div className="shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2" style={{ backgroundColor: live ? '#e11d48' : '#0f172a' }}>
                        <span className="text-lg font-black text-white">{match.homeScore ?? 0}</span>
                        <span className="text-sm font-black" style={{ color: live ? '#fecdd3' : '#64748b' }}>:</span>
                        <span className="text-lg font-black text-white">{match.awayScore ?? 0}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <ScoreControl side="home" value={home} onChange={handleHomeChange} onAdjust={d => adjust('home', d)} inputRef={homeInputRef} />
                        <span className="text-sm font-black text-slate-300">–</span>
                        <ScoreControl side="away" value={away} onChange={handleAwayChange} onAdjust={d => adjust('away', d)} inputRef={awayInputRef} />
                    </div>
                )}

                {/* Away */}
                <div className="flex flex-1 items-center gap-2 min-w-0">
                    <div className="sm:hidden min-w-0">
                        <Flag team={match.awayTeam} size="lg" />
                        <span className="mt-1 block text-xs font-black uppercase tracking-wide text-slate-900 leading-none">{awayCode}</span>
                        <span className="block w-full truncate text-[9px] leading-none text-slate-400">{match.awayTeam.name}</span>
                    </div>
                    <div className="hidden sm:block">
                        <Flag team={match.awayTeam} size="lg" />
                    </div>
                    <div className="hidden sm:block min-w-0">
                        <span className="block text-[10px] font-black uppercase text-slate-900 truncate">{match.awayTeam.name}</span>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{awayCode}</span>
                    </div>
                </div>
            </div>

            <AdvanceTeamSelector
                match={knockoutMatch}
                draft={{ home, away, advanceTeamId }}
                canEdit={canPredict}
                onSelect={handleAdvanceSelect}
                layout="centered"
                className="mt-2"
            />

            {/* Footer */}
            <div className="mt-2 flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {match.phase && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">{formatPhaseLabel(match.phase)}</span>}
                    {match.group && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 ring-1 ring-inset ring-slate-200">G{match.group}</span>}
                    {match.venue && <span className="text-[9px] text-slate-400">{match.venue}</span>}
                </div>
                {finished && match.myPrediction && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600">
                        <CheckCircle2 size={10} /> {match.myPrediction.homeScore}–{match.myPrediction.awayScore}
                    </span>
                )}
            </div>

            {err && <p className="text-[10px] text-rose-500 flex items-center gap-1 mt-1"><AlertTriangle size={10} /> {err}</p>}
        </div>
    );
}
