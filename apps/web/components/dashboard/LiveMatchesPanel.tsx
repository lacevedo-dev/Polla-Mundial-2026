import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlignJustify, ChevronDown, Maximize2, Minimize2, Plus } from 'lucide-react';
import { LiveMatchTimerInline, MatchProgressBar } from '../live/LiveMatchTimer';
import { LiveMatchTimer } from '../live/LiveMatchTimer';
import LiveMatchExpandedCard from './LiveMatchExpandedCard';
import type { MatchViewModel } from '../../stores/prediction.store';
import type { MatchEventItem } from '../../hooks/useLiveSyncEvents';
import { dedupeMatchEvents, formatGoalScorersByPlayer, partitionGoalsByTeam, splitGoalEvents } from '../../utils/matchEvents';
import { effectiveStatusShort } from '../../utils/liveFixture.util';
import {
    filterEventsForLiveDisplay,
    isRedCardEvent,
    isSubstitutionEvent,
    isYellowCardEvent,
    type LiveDisplaySettings,
    DEFAULT_LIVE_DISPLAY_SETTINGS,
} from '../../utils/liveDisplayConfig';
import {
    DEFAULT_GOAL_STICKER_SETTINGS,
    type GoalStickerSettings,
} from '../../utils/goalStickerConfig';
import { calcLivePoints } from '../../utils/dashboard';
import { MatchScoreDisplay } from '../MatchScoreDisplay';
import { AdvanceTeamSelector } from '../predictions/AdvanceTeamSelector';
import { resolvePredictionAdvanceTeamId, isPenaltyPhaseStatus } from '../../utils/knockout-advance';

/* ─── Types ──────────────────────────────────────────────────────── */

interface LiveStandingsData {
    myProvisionalPosition?: number | null;
    myPositionChange: number;
}

interface LiveSyncState {
    lastSyncAt: number | null;
    matchesUpdatedCount: number;
}

interface DraggableState {
    ref: React.RefObject<HTMLDivElement>;
    position: { x: number; y: number };
    handleMouseDown: (e: React.MouseEvent) => void;
    handleTouchStart: (e: React.TouchEvent) => void;
}

interface LiveMatchesPanelProps {
    liveMatches: MatchViewModel[];
    liveSync: LiveSyncState;
    liveStandings: LiveStandingsData | null;
    matchEvents: Map<string, MatchEventItem[]>;
    eventsLoadingMatchIds?: Set<string>;
    liveDisplay?: LiveDisplaySettings;
    goalSticker?: GoalStickerSettings;
    expandedMatchId: string | null;
    expandLevel: number;
    isFloating: boolean;
    floatingExpanded: boolean;
    draggable: DraggableState;
    onChipClick: (matchId: string) => void;
    onSetFloating: (v: boolean) => void;
    onSetFloatingExpanded: (v: boolean) => void;
}

/* ─── Chip helper ────────────────────────────────────────────────── */

function resolveMatchSyncAt(match: MatchViewModel): number | null {
    if (!match.lastSyncAt) return null;
    const parsed = Date.parse(match.lastSyncAt);
    return Number.isFinite(parsed) ? parsed : null;
}

function getLatestGoalHint(
    match: MatchViewModel,
    matchEvents: Map<string, MatchEventItem[]>,
    showGoals: boolean,
): string | null {
    if (!showGoals) return null;
    const events = dedupeMatchEvents(
        (matchEvents.get(match.id) ?? []).filter((e) => e.type === 'GOAL' && !e.annulled),
    );
    if (events.length === 0) return null;

    const { active } = splitGoalEvents(events);
    const latest = [...active].sort(
        (a, b) => a.minute - b.minute || (a.extraMin ?? 0) - (b.extraMin ?? 0),
    ).pop();
    if (!latest) return null;

    const name = latest.playerName?.split(/\s+/).pop() ?? 'Gol';
    return `${name} ${latest.minute}'`;
}


function getKnockoutAdvanceChipCode(match: MatchViewModel): string | null {
    if (!match.isKnockout || !match.saved) return null;
    const advanceId = resolvePredictionAdvanceTeamId(
        match.homeTeamId,
        match.awayTeamId,
        match.prediction,
    );
    if (!advanceId) return null;
    return advanceId === match.homeTeamId
        ? (match.homeTeamCode || match.homeTeam.slice(0, 3))
        : (match.awayTeamCode || match.awayTeam.slice(0, 3));
}

function shouldShowKnockoutAdvanceHint(
    match: MatchViewModel,
    clockStatusShort: string | null,
): boolean {
    const code = getKnockoutAdvanceChipCode(match);
    if (!code) return false;
    const rH = match.result?.home ?? 0;
    const rA = match.result?.away ?? 0;
    return rH === rA || isPenaltyPhaseStatus(clockStatusShort);
}

function getChipStatus(match: MatchViewModel) {
    const pH = parseInt(match.prediction.home, 10);
    const pA = parseInt(match.prediction.away, 10);
    const rH = match.result?.home ?? 0;
    const rA = match.result?.away ?? 0;
    if (!match.saved || isNaN(pH) || isNaN(pA) || !match.result) return null;
    if (pH === rH && pA === rA) return 'exact';
    return Math.sign(pH - pA) === Math.sign(rH - rA) ? 'winning' : 'losing';
}

/* ─── Component ──────────────────────────────────────────────────── */

const LiveMatchesPanel: React.FC<LiveMatchesPanelProps> = ({
    liveMatches,
    liveSync: _liveSync,
    liveStandings,
    matchEvents,
    eventsLoadingMatchIds,
    liveDisplay = DEFAULT_LIVE_DISPLAY_SETTINGS,
    goalSticker = DEFAULT_GOAL_STICKER_SETTINGS,
    expandedMatchId,
    expandLevel,
    isFloating,
    floatingExpanded,
    draggable,
    onChipClick,
    onSetFloating,
    onSetFloatingExpanded,
}) => {
    const expandedMatch = liveMatches.find((m) => m.id === expandedMatchId) ?? null;

    /* ── Panel content (chips + expanded card) ── */
    const panelContent = (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' as const }}
            className="space-y-2 xl:space-y-3"
        >
            <div className="grid gap-2 xl:gap-2 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))] xl:grid-cols-3 2xl:grid-cols-6">
                {liveMatches.map((match) => {
                    const isActive = match.id === expandedMatchId;
                    const rH = match.result?.home ?? 0;
                    const rA = match.result?.away ?? 0;
                    const chipStatus = getChipStatus(match);
                    const goalHint = getLatestGoalHint(match, matchEvents, liveDisplay.goals);
                    const clockStatusShort = effectiveStatusShort(match.statusShort, match.elapsed);
                    const knockoutAdvanceCode = getKnockoutAdvanceChipCode(match);
                    const showKnockoutHint = shouldShowKnockoutAdvanceHint(match, clockStatusShort);
                    const borderColor = chipStatus === 'exact' || chipStatus === 'winning'
                        ? 'border-lime-500/50'
                        : chipStatus === 'losing' ? 'border-rose-500/50' : 'border-white/10';
                    const scoreColor = chipStatus === 'exact' ? 'text-lime-300' : chipStatus === 'winning' ? 'text-lime-400' : 'text-white';

                    return (
                        <button
                            key={match.id}
                            onClick={() => onChipClick(match.id)}
                            className={`w-full rounded-xl border transition-all flex flex-col items-center px-1 py-1.5 xl:flex xl:flex-col xl:items-center xl:justify-center xl:px-1 xl:py-1.5 xl:gap-0.5 xl:min-h-[44px] xl:rounded-lg ${
                                isActive
                                    ? `bg-slate-900 ${borderColor} shadow-md xl:shadow-lg xl:shadow-slate-950/40`
                                    : `bg-slate-900/60 ${borderColor} hover:bg-slate-900 xl:hover:shadow-md xl:hover:shadow-slate-950/30`
                            }`}
                            aria-expanded={isActive}
                            aria-label={`${match.homeTeam} vs ${match.awayTeam}`}
                        >
                            {/* Móvil: chip vertical */}
                            <div className="xl:hidden w-full flex justify-center">
                                <LiveMatchTimerInline
                                    matchDate={match.date}
                                    elapsed={match.elapsed ?? null}
                                    lastSyncAt={resolveMatchSyncAt(match)}
                                    statusShort={clockStatusShort}
                                />
                            </div>
                            <div className="xl:hidden flex items-center justify-between w-full mt-1 gap-1">
                                <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1">
                                    {match.homeFlag && <img src={match.homeFlag} alt="" className="h-4 w-6 rounded-[3px] object-cover" />}
                                    <span className="text-[9px] font-bold text-white/60 uppercase leading-none truncate w-full text-center">
                                        {match.homeTeamCode || match.homeTeam.slice(0, 3)}
                                    </span>
                                </div>
                                <span className={`shrink-0 ${scoreColor}`}>
                                    {match.result ? (
                                        <MatchScoreDisplay
                                            homeScore={match.result.home}
                                            awayScore={match.result.away}
                                            penaltyHomeScore={match.penaltyHomeScore}
                                            penaltyAwayScore={match.penaltyAwayScore}
                                            scoreClassName="text-[15px] font-black"
                                            penaltyClassName="text-[9px] font-bold text-white/55"
                                            separatorClassName="text-[15px] font-black mx-0.5"
                                        />
                                    ) : '–'}
                                </span>
                                <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1">
                                    {match.awayFlag && <img src={match.awayFlag} alt="" className="h-4 w-6 rounded-[3px] object-cover" />}
                                    <span className="text-[9px] font-bold text-white/60 uppercase leading-none truncate w-full text-center">
                                        {match.awayTeamCode || match.awayTeam.slice(0, 3)}
                                    </span>
                                </div>
                            </div>
                            {goalHint && (
                                <p className="xl:hidden mt-0.5 text-[8px] font-semibold text-lime-300/90 truncate w-full text-center">
                                    ⚽ {goalHint}
                                </p>
                            )}
                            {showKnockoutHint && knockoutAdvanceCode && (
                                <p className="xl:hidden mt-0.5 text-[8px] font-semibold text-purple-300/90 truncate w-full text-center">
                                    ↑ {knockoutAdvanceCode}
                                </p>
                            )}

                            {/* Escritorio: centrado con timer arriba */}
                            <div className="hidden xl:w-full xl:flex xl:justify-center xl:mb-0.5">
                                <LiveMatchTimerInline
                                    matchDate={match.date}
                                    elapsed={match.elapsed ?? null}
                                    lastSyncAt={resolveMatchSyncAt(match)}
                                    statusShort={clockStatusShort}
                                    className="text-[7px]"
                                />
                            </div>
                            <div className="hidden xl:flex xl:items-center xl:justify-center xl:gap-1.5 xl:w-full">
                                <div className="flex flex-col items-center gap-0.5 shrink-0">
                                    {match.homeFlag && <img src={match.homeFlag} alt="" className="h-3.5 w-4.5 rounded object-cover" />}
                                    <span className="text-[8px] font-bold text-white/80 truncate">{match.homeTeamCode || match.homeTeam.slice(0, 3)}</span>
                                </div>
                                <span className={`shrink-0 ${scoreColor} mx-1`}>
                                    {match.result ? (
                                        <MatchScoreDisplay
                                            homeScore={match.result.home}
                                            awayScore={match.result.away}
                                            penaltyHomeScore={match.penaltyHomeScore}
                                            penaltyAwayScore={match.penaltyAwayScore}
                                            scoreClassName="text-base font-black"
                                            penaltyClassName="text-[8px] font-bold text-white/55"
                                            separatorClassName="text-base font-black mx-0.5"
                                        />
                                    ) : '–'}
                                </span>
                                <div className="flex flex-col items-center gap-0.5 shrink-0">
                                    {match.awayFlag && <img src={match.awayFlag} alt="" className="h-3.5 w-4.5 rounded object-cover" />}
                                    <span className="text-[8px] font-bold text-white/80 truncate">{match.awayTeamCode || match.awayTeam.slice(0, 3)}</span>
                                </div>
                            </div>
                            {goalHint && (
                                <p className="hidden xl:block mt-0.5 text-[7px] font-semibold text-lime-300/80 truncate w-full text-center">
                                    ⚽ {goalHint}
                                </p>
                            )}
                            {showKnockoutHint && knockoutAdvanceCode && (
                                <p className="hidden xl:block mt-0.5 text-[7px] font-semibold text-purple-300/80 truncate w-full text-center">
                                    ↑ {knockoutAdvanceCode}
                                </p>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Card expandida */}
            <AnimatePresence>
                {expandedMatch && (
                    <LiveMatchExpandedCard
                        expandedMatch={expandedMatch}
                        liveStandings={liveStandings}
                        matchEvents={matchEvents}
                        expandLevel={expandLevel}
                        eventsLoading={eventsLoadingMatchIds?.has(expandedMatch.id) ?? false}
                        liveDisplay={liveDisplay}
                        goalSticker={goalSticker}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );

    /* ── Modo flotante ── */
    if (isFloating) {
        return (
            <div
                ref={draggable.ref}
                style={{
                    position: 'fixed',
                    left: `${draggable.position.x}px`,
                    top: `${draggable.position.y}px`,
                    zIndex: 50,
                    width: floatingExpanded ? '340px' : '280px',
                    maxWidth: '95vw',
                }}
                className="rounded-xl bg-white shadow-2xl border border-slate-300 transition-all duration-300"
            >
                {/* Drag handle */}
                <div
                    onMouseDown={draggable.handleMouseDown}
                    onTouchStart={draggable.handleTouchStart}
                    className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-xl cursor-move select-none"
                >
                    <div className="flex items-center gap-1.5">
                        <AlignJustify size={12} className="text-slate-400" />
                        <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-rose-500" />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">En vivo</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onSetFloatingExpanded(!floatingExpanded); }}
                            className="p-1 rounded hover:bg-slate-200 transition-colors"
                            title={floatingExpanded ? 'Colapsar' : 'Expandir'}
                        >
                            {floatingExpanded
                                ? <ChevronDown size={12} className="text-slate-600" />
                                : <Plus size={12} className="text-slate-600" />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onSetFloating(false); }}
                            className="p-1 rounded hover:bg-slate-200 transition-colors"
                            title="Anclar al dashboard"
                        >
                            <Minimize2 size={12} className="text-slate-600" />
                        </button>
                    </div>
                </div>

                <div className="p-2 max-h-[60vh] overflow-y-auto">
                    <div className="grid gap-1.5 grid-cols-2">
                        {liveMatches.map((match) => {
                            const isActive = match.id === expandedMatchId;
                            const rH = match.result?.home ?? 0;
                            const rA = match.result?.away ?? 0;
                            const chipStatus = getChipStatus(match);
                            const goalHint = getLatestGoalHint(match, matchEvents, liveDisplay.goals);
                            const clockStatusShort = effectiveStatusShort(match.statusShort, match.elapsed);
                            const knockoutAdvanceCode = getKnockoutAdvanceChipCode(match);
                            const showKnockoutHint = shouldShowKnockoutAdvanceHint(match, clockStatusShort);
                            const borderColor = chipStatus === 'exact' || chipStatus === 'winning'
                                ? 'border-lime-500/50'
                                : chipStatus === 'losing' ? 'border-rose-500/50' : 'border-slate-200';
                            const scoreColor = chipStatus === 'exact' ? 'text-lime-400' : chipStatus === 'winning' ? 'text-lime-500' : 'text-white';

                            return (
                                <button
                                    key={match.id}
                                    onClick={() => onChipClick(match.id)}
                                    className={`rounded-lg border transition-all p-1.5 ${
                                        isActive
                                            ? `bg-slate-900 ${borderColor} ring-1 ring-offset-1 ring-slate-400`
                                            : `bg-slate-800/90 ${borderColor} hover:bg-slate-800`
                                    }`}
                                >
                                    <div className="flex justify-center mb-0.5">
                                        <LiveMatchTimerInline
                                            matchDate={match.date}
                                            elapsed={match.elapsed ?? null}
                                            lastSyncAt={resolveMatchSyncAt(match)}
                                            statusShort={clockStatusShort}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1">
                                            {match.homeFlag && <img src={match.homeFlag} alt="" className="h-3 w-5 rounded-[2px] object-cover" />}
                                            <span className="text-[8px] font-bold text-white/60 uppercase leading-none truncate w-full text-center">
                                                {match.homeTeamCode || match.homeTeam.slice(0, 3)}
                                            </span>
                                        </div>
                                        <span className={`shrink-0 ${scoreColor}`}>
                                            {match.result ? (
                                                <MatchScoreDisplay
                                                    homeScore={match.result.home}
                                                    awayScore={match.result.away}
                                                    penaltyHomeScore={match.penaltyHomeScore}
                                                    penaltyAwayScore={match.penaltyAwayScore}
                                                    scoreClassName="text-xs font-black"
                                                    penaltyClassName="text-[7px] font-bold text-white/55"
                                                    separatorClassName="text-xs font-black mx-0.5"
                                                />
                                            ) : '–'}
                                        </span>
                                        <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1">
                                            {match.awayFlag && <img src={match.awayFlag} alt="" className="h-3 w-5 rounded-[2px] object-cover" />}
                                            <span className="text-[8px] font-bold text-white/60 uppercase leading-none truncate w-full text-center">
                                                {match.awayTeamCode || match.awayTeam.slice(0, 3)}
                                            </span>
                                        </div>
                                    </div>
                                    {goalHint && (
                                        <p className="mt-0.5 text-[8px] font-semibold text-lime-300/90 truncate w-full text-center">
                                            ⚽ {goalHint}
                                        </p>
                                    )}
                                    {showKnockoutHint && knockoutAdvanceCode && (
                                        <p className="mt-0.5 text-[8px] font-semibold text-purple-300/90 truncate w-full text-center">
                                            ↑ {knockoutAdvanceCode}
                                        </p>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Panel expandido colapsable */}
                    <AnimatePresence>
                        {floatingExpanded && expandedMatch && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mt-2 overflow-hidden"
                            >
                                <FloatingExpandedCard
                                    expandedMatch={expandedMatch}
                                    matchEvents={matchEvents}
                                    expandLevel={expandLevel}
                                    liveDisplay={liveDisplay}
                                    expandedPts={(() => {
                                        const pH = parseInt(expandedMatch.prediction.home, 10);
                                        const pA = parseInt(expandedMatch.prediction.away, 10);
                                        const rH = expandedMatch.result?.home ?? 0;
                                        const rA = expandedMatch.result?.away ?? 0;
                                        if (!expandedMatch.saved || isNaN(pH) || isNaN(pA) || !expandedMatch.result) return 0;
                                        return calcLivePoints(pH, pA, rH, rA, !!expandedMatch.isKnockout);
                                    })()}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    }

    /* ── Modo sticky ── */
    return (
        <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 bg-slate-50/95 shadow-sm pb-2 pt-2 md:pb-2 md:pt-2 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">En vivo</span>
                </div>
                <button
                    onClick={() => onSetFloating(true)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                    title="Hacer flotante"
                >
                    <Maximize2 size={12} className="text-slate-600" />
                    <span className="text-[9px] font-bold text-slate-600 hidden lg:inline">Flotante</span>
                </button>
            </div>
            <div className="xl:overflow-x-auto">
                {panelContent}
            </div>
        </div>
    );
};

/* ─── Floating expanded mini-card ────────────────────────────────── */

interface FloatingExpandedCardProps {
    expandedMatch: MatchViewModel;
    matchEvents: Map<string, MatchEventItem[]>;
    expandLevel: number;
    expandedPts: number;
    liveDisplay?: LiveDisplaySettings;
}

const FloatingExpandedCard: React.FC<FloatingExpandedCardProps> = ({
    expandedMatch, matchEvents, expandLevel, expandedPts, liveDisplay = DEFAULT_LIVE_DISPLAY_SETTINGS,
}) => {
    const clockStatusShort = effectiveStatusShort(
        expandedMatch.statusShort,
        expandedMatch.elapsed,
    );
    const matchSyncAt = resolveMatchSyncAt(expandedMatch);
    const expandedPredHome = parseInt(expandedMatch.prediction.home, 10);
    const expandedPredAway = parseInt(expandedMatch.prediction.away, 10);
    const expandedRealHome = expandedMatch.result?.home ?? 0;
    const expandedRealAway = expandedMatch.result?.away ?? 0;
    const expandedHasPred = !!expandedMatch.saved && !isNaN(expandedPredHome) && !isNaN(expandedPredAway);

    let expandedStatus: 'exact' | 'winning' | 'losing' | null = null;
    if (expandedHasPred && expandedMatch.result) {
        if (expandedPredHome === expandedRealHome && expandedPredAway === expandedRealAway) expandedStatus = 'exact';
        else expandedStatus = Math.sign(expandedPredHome - expandedPredAway) === Math.sign(expandedRealHome - expandedRealAway) ? 'winning' : 'losing';
    }
    const expandedStatusColor = expandedStatus === 'exact' ? 'text-lime-300' : expandedStatus === 'winning' ? 'text-lime-400' : 'text-rose-400';
    const expandedEvents = dedupeMatchEvents(
        filterEventsForLiveDisplay(matchEvents.get(expandedMatch.id) ?? [], liveDisplay),
    );
    const { active: activeGoals } = splitGoalEvents(
        liveDisplay.goals ? expandedEvents.filter((e) => e.type === 'GOAL') : [],
    );
    const { homeGoals, awayGoals } = partitionGoalsByTeam(
        activeGoals,
        expandedMatch.homeTeamId,
        expandedMatch.awayTeamId,
        expandedRealHome,
        expandedRealAway,
    );
    const homeScorers = formatGoalScorersByPlayer(homeGoals);
    const awayScorers = formatGoalScorersByPlayer(awayGoals);

    return (
        <div className="rounded-lg bg-gradient-to-br from-rose-950 via-rose-950/80 to-slate-900 border border-rose-500/30 p-2.5 max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-2">
                <LiveMatchTimer
                    matchDate={expandedMatch.date}
                    elapsed={expandedMatch.elapsed ?? null}
                    lastSyncAt={matchSyncAt}
                    statusShort={clockStatusShort}
                />
                {expandedPts > 0 && (
                    <span className="rounded-full bg-lime-400/20 px-1.5 py-0.5 font-mono text-[9px] font-black text-lime-300">
                        +{expandedPts}pts
                    </span>
                )}
            </div>

            <MatchProgressBar
                matchDate={expandedMatch.date}
                elapsed={expandedMatch.elapsed ?? null}
                lastSyncAt={matchSyncAt}
                statusShort={clockStatusShort}
                finished={false}
            />

            <div className="flex items-center justify-between mt-2 text-xs">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                    {expandedMatch.homeFlag && <img src={expandedMatch.homeFlag} alt="" className="h-4 w-6 rounded object-cover" />}
                    <span className="font-bold text-white truncate text-[10px]">{expandedMatch.homeTeam}</span>
                </div>
                <div className="mx-2 shrink-0">
                    <div className="rounded-lg bg-white/10 px-2 py-0.5 tabular-nums text-[11px] text-center">
                        <MatchScoreDisplay
                            homeScore={expandedRealHome}
                            awayScore={expandedRealAway}
                            penaltyHomeScore={expandedMatch.penaltyHomeScore}
                            penaltyAwayScore={expandedMatch.penaltyAwayScore}
                            scoreClassName="text-[11px] font-black text-white"
                            penaltyClassName="text-[8px] font-bold text-white/55"
                            separatorClassName="text-[11px] font-black text-white mx-0.5"
                        />
                    </div>
                    {expandedHasPred && (
                        <p className={`mt-0.5 font-mono text-[8px] font-bold text-center ${expandedStatusColor}`}>
                            {expandedPredHome}–{expandedPredAway}
                        </p>
                    )}
                    {expandedMatch.isKnockout && expandedHasPred && (
                        <AdvanceTeamSelector
                            match={expandedMatch}
                            draft={{
                                home: expandedMatch.prediction.home,
                                away: expandedMatch.prediction.away,
                                advanceTeamId: expandedMatch.prediction.advanceTeamId,
                            }}
                            canEdit={false}
                            onSelect={() => {}}
                            layout="centered"
                            tone="dark"
                            className="mt-1"
                        />
                    )}
                </div>
                <div className="flex items-center justify-end gap-1 min-w-0 flex-1">
                    <span className="font-bold text-white truncate text-[10px]">{expandedMatch.awayTeam}</span>
                    {expandedMatch.awayFlag && <img src={expandedMatch.awayFlag} alt="" className="h-4 w-6 rounded object-cover" />}
                </div>
            </div>

            {(liveDisplay.goals && (homeScorers.length > 0 || awayScorers.length > 0)) && (
                <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[8px] font-semibold text-white/70">
                    <div className="min-w-0 truncate">{homeScorers.join(' · ')}</div>
                    <div className="min-w-0 truncate text-right">{awayScorers.join(' · ')}</div>
                </div>
            )}

            {expandLevel === 2 && expandedEvents.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-x-2 gap-y-0.5">
                    {expandedEvents.slice(0, 4).map((e, i) => {
                        const isOG = e.detail?.toLowerCase().includes('own goal');
                        const icon = e.type === 'GOAL'
                            ? (isOG ? '⚽OG' : '⚽')
                            : isSubstitutionEvent(e)
                                ? '↔️'
                                : isYellowCardEvent(e)
                                    ? '🟨'
                                    : isRedCardEvent(e)
                                        ? '🟥'
                                        : '•';
                        const min = `${e.minute}'`;
                        return (
                            <span key={i} className="text-[8px] text-white/40">
                                {icon} {min}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LiveMatchesPanel;
