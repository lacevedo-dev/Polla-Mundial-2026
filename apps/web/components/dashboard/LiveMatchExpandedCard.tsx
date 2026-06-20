import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LiveMatchTimer, MatchProgressBar } from '../live/LiveMatchTimer';
import type { MatchViewModel } from '../../stores/prediction.store';
import type { MatchEventItem } from '../../hooks/useLiveSyncEvents';
import { calcLivePoints } from '../../utils/dashboard';
import {
    formatAnnulledGoalLabel,
    splitGoalEvents,
    dedupeMatchEvents,
    partitionGoalsByTeam,
    buildMatchEventRowKey,
    formatGoalScorersByPlayer,
} from '../../utils/matchEvents';

interface LiveStandingsData {
    myProvisionalPosition?: number | null;
    myPositionChange: number;
}

interface LiveMatchExpandedCardProps {
    expandedMatch: MatchViewModel;
    liveSync: { lastSyncAt: number | null };
    liveStandings: LiveStandingsData | null;
    matchEvents: Map<string, MatchEventItem[]>;
    expandLevel: number;
}

const LiveMatchExpandedCard: React.FC<LiveMatchExpandedCardProps> = ({
    expandedMatch,
    liveSync,
    liveStandings,
    matchEvents,
    expandLevel,
}) => {
    const expandedPredHome = parseInt(expandedMatch.prediction.home, 10);
    const expandedPredAway = parseInt(expandedMatch.prediction.away, 10);
    const expandedRealHome = expandedMatch.result?.home ?? 0;
    const expandedRealAway = expandedMatch.result?.away ?? 0;
    const expandedHasPred = !!expandedMatch.saved && !isNaN(expandedPredHome) && !isNaN(expandedPredAway);

    let expandedStatus: 'exact' | 'winning' | 'losing' | null = null;
    let expandedPts = 0;
    if (expandedHasPred && expandedMatch.result) {
        if (expandedPredHome === expandedRealHome && expandedPredAway === expandedRealAway) {
            expandedStatus = 'exact';
        } else {
            expandedStatus = Math.sign(expandedPredHome - expandedPredAway) === Math.sign(expandedRealHome - expandedRealAway)
                ? 'winning'
                : 'losing';
        }
        expandedPts = calcLivePoints(expandedPredHome, expandedPredAway, expandedRealHome, expandedRealAway, !!expandedMatch.isKnockout);
    }
    const expandedStatusColor = expandedStatus === 'exact'
        ? 'text-lime-300'
        : expandedStatus === 'winning' ? 'text-lime-400' : 'text-rose-400';

    const expandedEvents = dedupeMatchEvents(
        (matchEvents.get(expandedMatch.id) ?? []).filter((e) => ['GOAL', 'CARD', 'VAR'].includes(e.type)),
    );
    const { active: activeGoals, annulled: annulledGoals } = splitGoalEvents(
        expandedEvents.filter((e) => e.type === 'GOAL'),
    );
    const { homeGoals, awayGoals } = partitionGoalsByTeam(
        activeGoals,
        expandedMatch.homeTeamId,
        expandedMatch.awayTeamId,
        expandedRealHome,
        expandedRealAway,
    );
    const { homeGoals: homeAnnulled, awayGoals: awayAnnulled } = partitionGoalsByTeam(
        annulledGoals,
        expandedMatch.homeTeamId,
        expandedMatch.awayTeamId,
        expandedRealHome,
        expandedRealAway,
    );
    const hasGoalSummary = homeGoals.length + awayGoals.length + homeAnnulled.length + awayAnnulled.length > 0;

    return (
        <AnimatePresence>
            <motion.div
                key={expandedMatch.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' as const }}
                className="overflow-hidden"
            >
                <div className="rounded-2xl bg-gradient-to-br from-rose-950 via-rose-950/80 to-slate-900 border border-rose-500/30 shadow-xl shadow-rose-950/40 p-3 xl:rounded-2xl xl:border-rose-400/35 max-w-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                            <LiveMatchTimer
                                matchDate={expandedMatch.date}
                                elapsed={expandedMatch.elapsed ?? null}
                                lastSyncAt={liveSync.lastSyncAt}
                                statusShort={expandedMatch.statusShort}
                            />
                            {liveStandings?.myProvisionalPosition != null && (
                                <span className={`text-[9px] font-black ${liveStandings.myPositionChange > 0 ? 'text-lime-400' : liveStandings.myPositionChange < 0 ? 'text-rose-400' : 'text-white/40'}`}>
                                    #{liveStandings.myProvisionalPosition}
                                    {liveStandings.myPositionChange > 0 && ` ↑${liveStandings.myPositionChange}`}
                                    {liveStandings.myPositionChange < 0 && ` ↓${Math.abs(liveStandings.myPositionChange)}`}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5">
                            {expandedPts > 0 && (
                                <span className="rounded-full bg-lime-400/20 px-1.5 py-0.5 font-mono text-[9px] font-black text-lime-300">
                                    +{expandedPts}pts
                                </span>
                            )}
                            {expandedStatus && (
                                <span className={`text-[9px] font-black ${expandedStatusColor}`}>
                                    {expandedStatus === 'exact' ? '⚽ Exacto' : expandedStatus === 'winning' ? '✓ Ganando' : '✗ Perdiendo'}
                                </span>
                            )}
                        </div>
                    </div>

                    <MatchProgressBar
                        matchDate={expandedMatch.date}
                        elapsed={expandedMatch.elapsed ?? null}
                        lastSyncAt={liveSync.lastSyncAt}
                        statusShort={expandedMatch.statusShort}
                        finished={false}
                    />

                    <div className="flex items-center justify-between mt-2">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            {expandedMatch.homeFlag && <img src={expandedMatch.homeFlag} alt="" className="h-5 w-7 rounded object-cover border border-white/10" />}
                            <span className="text-xs font-bold text-white truncate">{expandedMatch.homeTeam}</span>
                        </div>
                        <div className="mx-2 shrink-0 text-center">
                            <div className="rounded-lg bg-white/10 px-3 py-1 tabular-nums border border-white/10">
                                <span className="text-lg font-black text-white">{expandedRealHome}</span>
                                <span className="mx-1 text-white/30">—</span>
                                <span className="text-lg font-black text-white">{expandedRealAway}</span>
                            </div>
                            {expandedHasPred && (
                                <p className={`mt-0.5 font-mono text-[8px] font-bold ${expandedStatusColor}`}>
                                    pred {expandedPredHome}–{expandedPredAway}
                                </p>
                            )}
                        </div>
                        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{expandedMatch.awayTeam}</span>
                            {expandedMatch.awayFlag && <img src={expandedMatch.awayFlag} alt="" className="h-5 w-7 rounded object-cover border border-white/10" />}
                        </div>
                    </div>

                    {hasGoalSummary && (
                        <div className="mt-2.5 pt-2.5 border-t border-white/10">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="min-w-0 space-y-1">
                                    {formatGoalScorersByPlayer(homeGoals).map((line) => (
                                        <p key={`home-${line}`} className="flex items-center gap-1 text-[10px] font-semibold text-white/75">
                                            <span className="text-[11px]">⚽</span>
                                            <span className="truncate">{line}</span>
                                        </p>
                                    ))}
                                    {formatGoalScorersByPlayer(homeAnnulled).map((line) => (
                                        <p key={`home-a-${line}`} className="flex items-center gap-1 text-[10px] font-semibold text-white/40 line-through">
                                            <span>🚫</span>
                                            <span className="truncate">{line}</span>
                                        </p>
                                    ))}
                                </div>
                                <div className="min-w-0 space-y-1 text-right">
                                    {formatGoalScorersByPlayer(awayGoals).map((line) => (
                                        <p key={`away-${line}`} className="flex items-center justify-end gap-1 text-[10px] font-semibold text-white/75">
                                            <span className="truncate">{line}</span>
                                            <span className="text-[11px]">⚽</span>
                                        </p>
                                    ))}
                                    {formatGoalScorersByPlayer(awayAnnulled).map((line) => (
                                        <p key={`away-a-${line}`} className="flex items-center justify-end gap-1 text-[10px] font-semibold text-white/40 line-through">
                                            <span className="truncate">{line}</span>
                                            <span>🚫</span>
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {expandLevel === 1 && !hasGoalSummary && (
                        <p className="mt-2 text-center text-[9px] font-medium text-white/30">
                            Goleadores en actualización…
                        </p>
                    )}

                    {expandLevel === 2 && (
                        <>
                            {expandedEvents.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-white/25 mb-1.5">Eventos del partido</p>
                                    {expandedEvents.map((e) => {
                                        const isOG = e.detail?.toLowerCase().includes('own goal');
                                        const isPen = e.detail?.toLowerCase().includes('penalty');
                                        const isGoal = e.type === 'GOAL';
                                        const isVar = e.type === 'VAR';
                                        const isYellow = e.type === 'CARD' && e.detail?.toLowerCase().includes('yellow');
                                        const min = `${e.minute}'${e.extraMin ? `+${e.extraMin}` : ''}`;
                                        const isAnnulledGoal = isGoal && !!e.annulled;
                                        const icon = isVar
                                            ? '📺 VAR'
                                            : isAnnulledGoal
                                                ? '🚫'
                                            : isGoal
                                                ? (isOG ? '⚽ OG' : isPen ? '⚽ P' : '⚽')
                                                : isYellow ? '🟨' : '🟥';
                                        const iconBg = isVar || isAnnulledGoal
                                            ? 'bg-rose-500/15 text-rose-200'
                                            : isGoal
                                                ? 'bg-white/10 text-white'
                                                : isYellow ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-600/20 text-rose-300';
                                        const label = isVar
                                            ? `Gol anulado${e.detail ? ` · ${e.detail}` : ''}`
                                            : isAnnulledGoal
                                                ? `${e.playerName ?? '—'} · ${formatAnnulledGoalLabel(e.annulledReason)}`
                                                : (e.playerName ?? '—');
                                        return (
                                            <div key={buildMatchEventRowKey(e)} className="flex items-center gap-2">
                                                <span className="w-8 shrink-0 text-right text-[9px] font-black text-white/30 tabular-nums">{min}</span>
                                                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${iconBg}`}>{icon}</span>
                                                <span className={`min-w-0 flex-1 truncate text-[9px] font-bold ${isVar || isAnnulledGoal ? 'text-rose-200/80 line-through decoration-rose-200/30' : 'text-white/60'}`}>
                                                    {label}
                                                    {!isVar && e.assistName && <span className="ml-1 text-white/30">(asist. {e.assistName.split(' ').pop()})</span>}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {(() => {
                                const yellows = expandedEvents.filter((e) => e.type === 'CARD' && e.detail?.toLowerCase().includes('yellow')).length;
                                const reds = expandedEvents.filter((e) => e.type === 'CARD' && (e.detail?.toLowerCase().includes('red') || e.detail?.toLowerCase().includes('second yellow'))).length;
                                if (yellows + reds === 0) return null;
                                return (
                                    <div className="mt-2 flex items-center gap-2 border-t border-white/5 pt-2">
                                        {yellows > 0 && <span className="flex items-center gap-1 text-[9px] font-bold text-amber-300/80">🟨 <span>{yellows}</span></span>}
                                        {reds > 0 && <span className="flex items-center gap-1 text-[9px] font-bold text-rose-300/80">🟥 <span>{reds}</span></span>}
                                    </div>
                                );
                            })()}

                            {expandedMatch.phase && (
                                <p className="mt-1.5 text-[8px] font-black uppercase tracking-widest text-white/20">{expandedMatch.phase}</p>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default LiveMatchExpandedCard;
