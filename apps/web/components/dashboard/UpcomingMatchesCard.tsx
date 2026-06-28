import React from 'react';
import { motion } from 'motion/react';
import { Clock, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fade, formatMatchTime, safeText, summarizeCloseTime, isPredictionWindowClosed } from '../../utils/dashboard';
import type { MatchViewModel } from '../../stores/prediction.store';
import { AdvanceTeamSelector } from '../predictions/AdvanceTeamSelector';
import {
    requiresKnockoutAdvanceSelection,
    type QuickPredictionDraft,
} from '../../utils/knockout-advance';
import { SCORE_INPUT_PLACEHOLDER, scoreInputPlaceholderClass } from '../../utils/score-input';

interface UpcomingMatchesCardProps {
    upcomingMatches: MatchViewModel[];
    closePredictionMinutes?: number | null;
    currentTime: number;
    savingMatchId: string | null;
    isAdmin: boolean;
    onDraftChange: (matchId: string, side: 'home' | 'away', value: string) => void;
    onAdvanceTeamSelect: (matchId: string, teamId: string) => void;
    onSave: (match: MatchViewModel) => void;
    getQuickDraft: (match: MatchViewModel) => QuickPredictionDraft;
}

const UpcomingMatchesCard: React.FC<UpcomingMatchesCardProps> = ({
    upcomingMatches,
    closePredictionMinutes,
    currentTime,
    savingMatchId,
    isAdmin,
    onDraftChange,
    onAdvanceTeamSelect,
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
                    const savedAdvanceTeamId = match.prediction.advanceTeamId ?? undefined;
                    const isDirty =
                        draft.home !== (match.prediction.home ?? '') ||
                        draft.away !== (match.prediction.away ?? '') ||
                        (match.isKnockout && draft.advanceTeamId !== savedAdvanceTeamId);
                    const hasDraftValues = draft.home !== '' && draft.away !== '';
                    const needsAdvanceSelection = match.isKnockout &&
                        requiresKnockoutAdvanceSelection(draft.home, draft.away, draft.advanceTeamId);

                    return (
                        <motion.div
                            key={match.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.07 }}
                            className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm shadow-slate-100"
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

                            <div className="mt-3 space-y-2">
                                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
                                    <div className="flex flex-col items-start gap-0.5 min-w-0 overflow-hidden">
                                        <img
                                            src={match.homeFlag}
                                            alt=""
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                            className="h-8 w-12 rounded-md object-cover shadow-sm"
                                        />
                                        <p className="text-sm font-black uppercase tracking-wide text-slate-900 leading-none">
                                            {match.homeTeamCode || match.homeTeam.slice(0, 3).toUpperCase()}
                                        </p>
                                        <p className="text-[9px] text-slate-400 leading-none truncate w-full">
                                            {match.homeTeam}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <input
                                            type="number"
                                            min={0}
                                            max={99}
                                            inputMode="numeric"
                                            value={draft.home}
                                            onChange={(e) => onDraftChange(match.id, 'home', e.target.value)}
                                            disabled={!canEdit || savingMatchId === match.id}
                                            aria-label="Marcador local"
                                            placeholder={SCORE_INPUT_PLACEHOLDER}
                                            className={`h-10 w-10 rounded-xl border-2 border-slate-200 bg-white text-center text-lg font-black text-slate-900 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 disabled:opacity-60 ${scoreInputPlaceholderClass}`}
                                        />
                                        <span className="text-lg font-black text-slate-300 leading-none">:</span>
                                        <input
                                            type="number"
                                            min={0}
                                            max={99}
                                            inputMode="numeric"
                                            value={draft.away}
                                            onChange={(e) => onDraftChange(match.id, 'away', e.target.value)}
                                            disabled={!canEdit || savingMatchId === match.id}
                                            aria-label="Marcador visitante"
                                            placeholder={SCORE_INPUT_PLACEHOLDER}
                                            className={`h-10 w-10 rounded-xl border-2 border-slate-200 bg-white text-center text-lg font-black text-slate-900 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 disabled:opacity-60 ${scoreInputPlaceholderClass}`}
                                        />
                                    </div>

                                    <div className="flex flex-col items-end gap-0.5 min-w-0 overflow-hidden">
                                        <img
                                            src={match.awayFlag}
                                            alt=""
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                            className="h-8 w-12 rounded-md object-cover shadow-sm"
                                        />
                                        <p className="text-sm font-black uppercase tracking-wide text-slate-900 leading-none">
                                            {match.awayTeamCode || match.awayTeam.slice(0, 3).toUpperCase()}
                                        </p>
                                        <p className="text-[9px] text-slate-400 leading-none truncate w-full text-right">
                                            {match.awayTeam}
                                        </p>
                                    </div>
                                </div>

                                <AdvanceTeamSelector
                                    match={match}
                                    draft={draft}
                                    canEdit={canEdit}
                                    onSelect={onAdvanceTeamSelect}
                                    layout="centered"
                                />
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3">
                                <div className="min-w-0 flex-1 text-[10px] font-bold text-slate-500">
                                    {needsAdvanceSelection ? (
                                        <span className="text-amber-600">Indica quién clasifica en penales</span>
                                    ) : isDirty ? (
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
                                            disabled={
                                                savingMatchId === match.id ||
                                                !hasDraftValues ||
                                                needsAdvanceSelection ||
                                                (!isDirty && match.saved)
                                            }
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
