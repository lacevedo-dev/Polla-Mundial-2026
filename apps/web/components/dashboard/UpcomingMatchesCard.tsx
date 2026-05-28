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

                            <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1 text-left">
                                    <div className="flex items-center gap-2">
                                        <img src={match.homeFlag} alt={`Bandera de ${match.homeTeam}`} className="h-5 w-7 rounded-md object-cover shadow-sm" />
                                        <p className="truncate text-base font-black uppercase text-slate-900 sm:text-lg">{match.homeTeamCode}</p>
                                    </div>
                                    <p className="mt-1 truncate text-[10px] text-slate-400">{match.homeTeam}</p>
                                </div>

                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    {(['home', 'away'] as const).map((side, scoreIndex) => (
                                        <React.Fragment key={side}>
                                            {/* Mobile: plain input */}
                                            <div className="sm:hidden">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={99}
                                                    inputMode="numeric"
                                                    value={side === 'home' ? draft.home : draft.away}
                                                    onChange={(e) => onDraftChange(match.id, side, e.target.value)}
                                                    disabled={!canEdit || savingMatchId === match.id}
                                                    aria-label={`Marcador ${side === 'home' ? 'local' : 'visitante'} para ${side === 'home' ? match.homeTeam : match.awayTeam}`}
                                                    className="h-11 w-12 rounded-xl border-2 border-slate-200 bg-white text-center text-lg font-black text-slate-900 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 disabled:opacity-60"
                                                />
                                            </div>
                                            {/* Desktop: stepper */}
                                            <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-white px-1.5 py-1 shadow-sm shadow-slate-100 sm:flex">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const cur = parseInt(side === 'home' ? draft.home || '0' : draft.away || '0', 10) || 0;
                                                        onDraftChange(match.id, side, String(Math.max(0, cur - 1)));
                                                    }}
                                                    disabled={!canEdit || savingMatchId === match.id}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                                                    aria-label={`Disminuir marcador ${side === 'home' ? 'local' : 'visitante'}`}
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={99}
                                                    inputMode="numeric"
                                                    value={side === 'home' ? draft.home : draft.away}
                                                    onChange={(e) => onDraftChange(match.id, side, e.target.value)}
                                                    disabled={!canEdit || savingMatchId === match.id}
                                                    aria-label={`Marcador ${side === 'home' ? 'local' : 'visitante'} para ${side === 'home' ? match.homeTeam : match.awayTeam}`}
                                                    className="h-8 w-10 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white disabled:opacity-60"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const cur = parseInt(side === 'home' ? draft.home || '0' : draft.away || '0', 10) || 0;
                                                        onDraftChange(match.id, side, String(cur + 1));
                                                    }}
                                                    disabled={!canEdit || savingMatchId === match.id}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                                                    aria-label={`Aumentar marcador ${side === 'home' ? 'local' : 'visitante'}`}
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                            {scoreIndex === 0 ? <span className="text-slate-300 font-black">-</span> : null}
                                        </React.Fragment>
                                    ))}
                                </div>

                                <div className="min-w-0 flex-1 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <p className="truncate text-base font-black uppercase text-slate-900 sm:text-lg">{match.awayTeamCode}</p>
                                        <img src={match.awayFlag} alt={`Bandera de ${match.awayTeam}`} className="h-5 w-7 rounded-md object-cover shadow-sm" />
                                    </div>
                                    <p className="mt-1 truncate text-[10px] text-slate-400">{match.awayTeam}</p>
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
