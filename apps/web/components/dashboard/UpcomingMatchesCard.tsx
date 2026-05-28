import React from 'react';
import { motion } from 'motion/react';
import { Clock, Minus, Plus, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fade, formatMatchTime, safeText, summarizeCloseTime, isPredictionWindowClosed } from '../../utils/dashboard';
import type { MatchViewModel } from '../../stores/prediction.store';

interface QuickDraft {
    home: string;
    away: string;
}

interface UpcomingMatchesCardProps {
    upcomingMatches: MatchViewModel[];
    closePredictionMinutes?: number | null;
    currentTime: number;
    quickPreds: Record<string, QuickDraft>;
    savingMatchId: string | null;
    isAdmin: boolean;
    onDraftChange: (matchId: string, side: 'home' | 'away', value: string) => void;
    onSave: (match: MatchViewModel) => void;
    getQuickDraft: (match: MatchViewModel) => QuickDraft;
}

const UpcomingMatchesCard: React.FC<UpcomingMatchesCardProps> = ({
    upcomingMatches,
    closePredictionMinutes,
    currentTime,
    savingMatchId,
    isAdmin,
    onDraftChange,
    onSave,
    getQuickDraft,
}) => (
    <motion.article {...fade(0.12)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Próximos partidos</h2>
            <Clock size={14} className="text-slate-300" />
        </div>

        {upcomingMatches.length > 0 ? (
            <div className="space-y-3">
                {upcomingMatches.map((match, i) => {
                    const draft = getQuickDraft(match);
                    const canEdit = !isPredictionWindowClosed(match.date, closePredictionMinutes, currentTime);
                    const isDirty =
                        draft.home !== (match.prediction.home ?? '') ||
                        draft.away !== (match.prediction.away ?? '');
                    const hasDraftValues = draft.home !== '' && draft.away !== '';

                    return (
                        <motion.div
                            key={match.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.07 }}
                            className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 shadow-sm shadow-slate-100"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                        {safeText(match.displayDate, match.date)}
                                    </p>
                                    <p className="mt-1 text-xs font-black text-slate-900">{formatMatchTime(match.date)}</p>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${
                                    !canEdit ? 'bg-slate-200 text-slate-600'
                                    : isDirty ? 'bg-amber-100 text-amber-700'
                                    : match.saved ? 'bg-lime-100 text-lime-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {!canEdit ? 'Cerrado' : isDirty ? 'Sin guardar' : match.saved ? 'Guardado' : 'Activo'}
                                </span>
                            </div>

                            {/* ── Equipos + marcador ── */}
                            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">

                                {/* Local */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <img
                                        src={match.homeFlag}
                                        alt=""
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                        className="h-8 w-11 shrink-0 rounded-md object-cover shadow-sm"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-black uppercase tracking-wide text-slate-900 leading-tight">
                                            {match.homeTeamCode || match.homeTeam.slice(0, 3).toUpperCase()}
                                        </p>
                                        <p className="text-[9px] text-slate-400 leading-tight truncate">
                                            {match.homeTeam}
                                        </p>
                                    </div>
                                </div>

                                {/* Inputs de marcador — centro */}
                                <div className="flex items-center gap-1 shrink-0">
                                    {(['home', 'away'] as const).map((side, scoreIndex) => (
                                        <React.Fragment key={side}>
                                            <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const cur = parseInt(side === 'home' ? draft.home || '0' : draft.away || '0', 10) || 0;
                                                        onDraftChange(match.id, side, String(Math.max(0, cur - 1)));
                                                    }}
                                                    disabled={!canEdit || savingMatchId === match.id}
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                                                    aria-label={`Disminuir ${side === 'home' ? 'local' : 'visitante'}`}
                                                >
                                                    <Minus size={11} />
                                                </button>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={99}
                                                    inputMode="numeric"
                                                    value={side === 'home' ? draft.home : draft.away}
                                                    onChange={(e) => onDraftChange(match.id, side, e.target.value)}
                                                    disabled={!canEdit || savingMatchId === match.id}
                                                    aria-label={`Marcador ${side === 'home' ? 'local' : 'visitante'}`}
                                                    className="h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-900 outline-none transition focus:border-lime-400 focus:bg-white disabled:opacity-60"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const cur = parseInt(side === 'home' ? draft.home || '0' : draft.away || '0', 10) || 0;
                                                        onDraftChange(match.id, side, String(cur + 1));
                                                    }}
                                                    disabled={!canEdit || savingMatchId === match.id}
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                                                    aria-label={`Aumentar ${side === 'home' ? 'local' : 'visitante'}`}
                                                >
                                                    <Plus size={11} />
                                                </button>
                                            </div>
                                            {scoreIndex === 0 && (
                                                <span className="text-slate-300 font-black px-0.5">-</span>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>

                                {/* Visitante */}
                                <div className="flex items-center gap-2 min-w-0 justify-end">
                                    <div className="min-w-0 text-right">
                                        <p className="text-sm font-black uppercase tracking-wide text-slate-900 leading-tight">
                                            {match.awayTeamCode || match.awayTeam.slice(0, 3).toUpperCase()}
                                        </p>
                                        <p className="text-[9px] text-slate-400 leading-tight truncate">
                                            {match.awayTeam}
                                        </p>
                                    </div>
                                    <img
                                        src={match.awayFlag}
                                        alt=""
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                        className="h-8 w-11 shrink-0 rounded-md object-cover shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3">
                                <div className="min-w-0 flex-1 text-[10px] font-bold text-slate-500">
                                    {isDirty ? (
                                        <span className="text-amber-600">Cambios listos para guardar</span>
                                    ) : match.saved ? (
                                        <span className="text-lime-600">✓ Pronóstico actual {match.prediction.home}-{match.prediction.away}</span>
                                    ) : canEdit ? (
                                        <span>Ingresa tu pronóstico · cierra en {summarizeCloseTime(match.date, closePredictionMinutes, currentTime)}</span>
                                    ) : (
                                        <span className="text-rose-500">Pronóstico cerrado 15 min antes del partido</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {canEdit && (
                                        <button
                                            onClick={() => onSave(match)}
                                            disabled={savingMatchId === match.id || !hasDraftValues || (!isDirty && match.saved)}
                                            className="rounded-xl bg-lime-400 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-950 transition-colors hover:bg-lime-500 disabled:opacity-60"
                                        >
                                            {savingMatchId === match.id ? 'Guardando...' : match.saved ? 'Actualizar' : 'Guardar'}
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <Link
                                            to="/predictions"
                                            className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <Settings size={11} /> Gestionar
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                No hay partidos próximos.
            </div>
        )}
    </motion.article>
);

export default UpcomingMatchesCard;
