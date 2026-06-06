import React, { useState } from 'react';
import {
    CheckCircle2, Save, Lock, Loader2, AlertTriangle, Zap, Info,
} from 'lucide-react';
import { UpcomingMatch } from './types';
import { Flag } from './Flag';
import {
    isPredictionClosed, isLiveStatus, isFinishedStatus,
    formatMatchTime, getDaysUntil, formatDateShort, formatPhaseLabel,
} from './helpers';
import { request } from '../../api';

interface Props {
    match: UpcomingMatch;
    leagueId: string;
    closeMin: number;
    compact?: boolean;
    isNext?: boolean;
    isWithoutPrediction?: boolean;
    onSaved: (matchId: string, home: number, away: number) => void;
}

export function PredictionRow({
    match, leagueId, closeMin, onSaved,
    compact = false, isNext = false, isWithoutPrediction = false,
}: Props) {
    const closed = isPredictionClosed(match.matchDate, closeMin);
    const live = isLiveStatus(match.status);
    const finished = isFinishedStatus(match.status);
    const canPredict = !closed && !finished && !live;

    const [home, setHome] = useState(match.myPrediction?.homeScore?.toString() ?? '');
    const [away, setAway] = useState(match.myPrediction?.awayScore?.toString() ?? '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const initHome = match.myPrediction?.homeScore?.toString() ?? '';
    const initAway = match.myPrediction?.awayScore?.toString() ?? '';
    const isDirty = home !== initHome || away !== initAway;
    const homeCode = (match.homeTeam.shortCode ?? match.homeTeam.name.slice(0, 3)).toUpperCase();
    const awayCode = (match.awayTeam.shortCode ?? match.awayTeam.name.slice(0, 3)).toUpperCase();

    const timeFmt = formatMatchTime(match.matchDate);
    const daysUntil = getDaysUntil(match.matchDate);

    function adjust(side: 'home' | 'away', delta: number) {
        if (side === 'home') setHome(v => String(Math.max(0, Math.min(99, (parseInt(v) || 0) + delta))));
        else setAway(v => String(Math.max(0, Math.min(99, (parseInt(v) || 0) + delta))));
    }

    async function submit() {
        const h = parseInt(home);
        const a = parseInt(away);
        if (isNaN(h) || isNaN(a) || h < 0 || a < 0) { setErr('Marcadores inválidos'); return; }
        setSaving(true); setErr(null);
        try {
            await request('/predictions', {
                method: 'POST',
                body: JSON.stringify({ matchId: match.id, leagueId, homeScore: h, awayScore: a }),
            });
            setSaved(true);
            onSaved(match.id, h, a);
            setTimeout(() => setSaved(false), 2500);
        } catch (e: any) {
            setErr(e?.message ?? 'Error al guardar');
        } finally {
            setSaving(false);
        }
    }

    /* ── MODO COMPACTO ── */
    if (compact) {
        return (
            <div className={`px-3 py-2 border-b border-slate-50 last:border-0 transition-colors ${canPredict ? 'hover:bg-slate-50/60' : ''}`}>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 w-12 text-right">
                        <span className="text-[9px] font-bold text-slate-400 block leading-tight">{formatDateShort(match.matchDate)}</span>
                        <span className="text-[10px] font-black text-slate-600 block">{timeFmt}</span>
                    </div>
                    <div className="flex items-center gap-1 w-20 justify-end shrink-0">
                        <span className="text-[11px] font-black text-slate-800 truncate text-right">{homeCode}</span>
                        <Flag team={match.homeTeam} size="sm" />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {finished || live ? (
                            <>
                                <span className={`text-sm font-black ${live ? 'text-rose-600' : 'text-slate-900'}`}>{match.homeScore ?? 0}</span>
                                <span className="text-xs font-black text-slate-300">–</span>
                                <span className={`text-sm font-black ${live ? 'text-rose-600' : 'text-slate-900'}`}>{match.awayScore ?? 0}</span>
                                {live && <span className="text-[8px] font-black text-rose-500 animate-pulse ml-0.5">LIVE</span>}
                            </>
                        ) : canPredict ? (
                            <>
                                <input type="number" min={0} max={99} inputMode="numeric" value={home} placeholder="0"
                                    onChange={e => setHome(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                    className="w-9 h-8 text-center font-black text-sm rounded-lg border-2 focus:outline-none transition-colors appearance-none"
                                    style={{ borderColor: home !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }} />
                                <span className="text-xs font-black text-slate-300">–</span>
                                <input type="number" min={0} max={99} inputMode="numeric" value={away} placeholder="0"
                                    onChange={e => setAway(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                    className="w-9 h-8 text-center font-black text-sm rounded-lg border-2 focus:outline-none transition-colors appearance-none"
                                    style={{ borderColor: away !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }} />
                            </>
                        ) : (
                            <div className="flex items-center gap-1 opacity-40">
                                <span className="w-9 h-8 flex items-center justify-center text-sm font-black text-slate-400 border-2 border-slate-100 rounded-lg bg-slate-50">{match.myPrediction?.homeScore ?? '–'}</span>
                                <span className="text-xs font-black text-slate-300">–</span>
                                <span className="w-9 h-8 flex items-center justify-center text-sm font-black text-slate-400 border-2 border-slate-100 rounded-lg bg-slate-50">{match.myPrediction?.awayScore ?? '–'}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1 w-20 shrink-0">
                        <Flag team={match.awayTeam} size="sm" />
                        <span className="text-[11px] font-black text-slate-800 truncate">{awayCode}</span>
                    </div>
                    <div className="ml-auto shrink-0 flex items-center gap-1.5">
                        {finished && match.myPrediction?.points != null && (
                            <span className="text-xs font-black" style={{ color: match.myPrediction.points > 0 ? 'var(--color-primary,#f59e0b)' : '#94a3b8' }}>
                                {match.myPrediction.points > 0 ? `+${match.myPrediction.points}` : '0'}pts
                            </span>
                        )}
                        {canPredict && (
                            <button onClick={submit} disabled={saving || !isDirty}
                                className="flex items-center gap-1 text-[11px] font-black px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-30 whitespace-nowrap"
                                style={saved ? { backgroundColor: '#d1fae5', color: '#059669' } : { backgroundColor: 'var(--color-primary,#f59e0b)', color: '#fff' }}>
                                {saving ? <Loader2 size={10} className="animate-spin" /> : saved ? <CheckCircle2 size={10} /> : <Save size={10} />}
                                {saved ? 'OK' : 'Guardar'}
                            </button>
                        )}
                        {!canPredict && !finished && <span className="flex items-center gap-0.5 text-[10px] text-slate-300 font-bold"><Lock size={9} /> Cerrado</span>}
                        {canPredict && match.myPrediction && !isDirty && <CheckCircle2 size={13} className="text-emerald-400" />}
                    </div>
                </div>
                {err && <p className="text-[10px] text-rose-500 mt-1 pl-14 flex items-center gap-1"><AlertTriangle size={9} /> {err}</p>}
            </div>
        );
    }

    /* ── MODO EXPANDIDO ── */
    return (
        <div className="border-b border-slate-100 px-4 py-3.5 last:border-b-0">
            {/* Header: hora + días + badges + botones */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <div>
                        <span className="text-sm font-black text-slate-900 block">{timeFmt}</span>
                        {daysUntil !== null && (
                            <span className="text-[10px] font-black block" style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                {daysUntil} DÍA{daysUntil !== 1 ? 'S' : ''}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                        {live && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-600 border border-rose-200 animate-pulse">EN VIVO</span>}
                        {finished && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200">FINALIZADO</span>}
                        {canPredict && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-lime-100 text-lime-700 border border-lime-200">ABIERTO</span>}
                        {!canPredict && !finished && !live && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200">CERRADO</span>}
                        {isNext && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-600 border border-amber-200">SIGUIENTE</span>}
                        {isWithoutPrediction && canPredict && (
                            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-orange-100 text-orange-600 border border-orange-200">
                                <Zap size={8} /> SIN PRONÓSTICO
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button title="Información" className="h-8 w-8 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50">
                        <Info size={13} />
                    </button>
                    {canPredict ? (
                        <button onClick={submit} disabled={saving || !isDirty}
                            className="h-8 w-8 flex items-center justify-center rounded-full transition-all disabled:opacity-40"
                            style={saved
                                ? { backgroundColor: '#d1fae5', color: '#059669', border: '1px solid #a7f3d0' }
                                : (isDirty || match.myPrediction)
                                    ? { backgroundColor: 'var(--color-primary,#f59e0b)', color: '#fff' }
                                    : { backgroundColor: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0' }
                            }>
                            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
                        </button>
                    ) : (
                        <div className="h-8 w-8 flex items-center justify-center rounded-full border border-slate-100 bg-slate-50">
                            <Lock size={12} className="text-slate-300" />
                        </div>
                    )}
                </div>
            </div>

            {/* Equipos + marcador */}
            <div className="flex items-center gap-2">
                {/* Local */}
                <div className="flex flex-1 items-center gap-2 justify-end min-w-0">
                    <div className="text-right min-w-0">
                        <span className="hidden sm:block text-[10px] font-black uppercase text-slate-900 truncate">{match.homeTeam.name}</span>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{homeCode}</span>
                    </div>
                    <Flag team={match.homeTeam} size="lg" />
                </div>

                {finished || live ? (
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <div className={`flex items-center gap-1.5 rounded-xl px-4 py-2 ${live ? 'bg-rose-600' : 'bg-slate-900'}`}>
                            <span className="text-lg font-black text-white">{match.homeScore ?? 0}</span>
                            <span className={`text-sm font-black ${live ? 'text-rose-300' : 'text-slate-500'}`}>:</span>
                            <span className="text-lg font-black text-white">{match.awayScore ?? 0}</span>
                        </div>
                    </div>
                ) : canPredict ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm">
                            <button type="button" onClick={() => adjust('home', -1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-400 hover:bg-slate-100">−</button>
                            <input type="number" min={0} max={99} inputMode="numeric" value={home} placeholder="0"
                                onChange={e => setHome(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                className="h-8 w-10 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-900 outline-none appearance-none" />
                            <button type="button" onClick={() => adjust('home', 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-400 hover:bg-slate-100">+</button>
                        </div>
                        <input type="number" min={0} max={99} inputMode="numeric" value={home} placeholder="0"
                            onChange={e => setHome(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                            className="sm:hidden h-12 w-14 rounded-xl border-2 bg-white text-center text-lg font-black outline-none transition appearance-none"
                            style={{ borderColor: home !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }} />
                        <span className="text-base font-black text-slate-300">–</span>
                        <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm">
                            <button type="button" onClick={() => adjust('away', -1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-400 hover:bg-slate-100">−</button>
                            <input type="number" min={0} max={99} inputMode="numeric" value={away} placeholder="0"
                                onChange={e => setAway(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                className="h-8 w-10 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-900 outline-none appearance-none" />
                            <button type="button" onClick={() => adjust('away', 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-400 hover:bg-slate-100">+</button>
                        </div>
                        <input type="number" min={0} max={99} inputMode="numeric" value={away} placeholder="0"
                            onChange={e => setAway(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                            className="sm:hidden h-12 w-14 rounded-xl border-2 bg-white text-center text-lg font-black outline-none transition appearance-none"
                            style={{ borderColor: away !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }} />
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 shrink-0">
                        <span className="text-lg font-black text-slate-400">{match.myPrediction?.homeScore ?? '–'}</span>
                        <span className="text-base font-black text-slate-300">:</span>
                        <span className="text-lg font-black text-slate-400">{match.myPrediction?.awayScore ?? '–'}</span>
                    </div>
                )}

                {/* Visitante */}
                <div className="flex flex-1 items-center gap-2 min-w-0">
                    <Flag team={match.awayTeam} size="lg" />
                    <div className="min-w-0">
                        <span className="hidden sm:block text-[10px] font-black uppercase text-slate-900 truncate">{match.awayTeam.name}</span>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{awayCode}</span>
                    </div>
                </div>
            </div>

            {/* Footer: fase + grupo + venue | predicción guardada */}
            <div className="flex items-center justify-between mt-2.5 flex-wrap gap-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {match.phase && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">{formatPhaseLabel(match.phase)}</span>}
                    {match.group && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 ring-1 ring-inset ring-slate-200">G{match.group}</span>}
                    {match.venue && <span className="text-[9px] text-slate-400">{match.venue}</span>}
                </div>
                <div className="flex items-center gap-2">
                    {finished && match.myPrediction && (
                        <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600">
                            <CheckCircle2 size={10} /> {match.myPrediction.homeScore}–{match.myPrediction.awayScore}
                            {match.myPrediction.points != null && (
                                <span className={match.myPrediction.points > 0 ? '' : 'text-slate-400'}>
                                    {match.myPrediction.points > 0 ? `+${match.myPrediction.points}pts` : '0pts'}
                                </span>
                            )}
                        </span>
                    )}
                    {isWithoutPrediction && canPredict && (
                        <span className="hidden sm:block text-[9px] text-slate-400">Completa y guarda para cerrar este partido.</span>
                    )}
                </div>
            </div>

            {err && <p className="text-[10px] text-rose-500 flex items-center gap-1 mt-1"><AlertTriangle size={10} /> {err}</p>}
        </div>
    );
}
