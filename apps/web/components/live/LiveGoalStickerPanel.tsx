import React from 'react';
import type { MatchEventItem } from '../../hooks/useLiveSyncEvents';
import type { GoalStickerVariant } from '../../utils/goalStickerConfig';
import { buildMatchEventRowKey } from '../../utils/matchEvents';
import { useOpenAiStickerImage } from '../../hooks/useOpenAiStickerImage';
import {
    GoalScorerStickerCard,
    resolveGoalTeamFlag,
    resolveGoalTeamName,
} from './GoalScorerStickerCard';

export type LiveGoalStickerPanelMode = 'full' | 'mini' | 'hidden';

const PANEL_MODE_STORAGE_PREFIX = 'live-sticker-panel:';

function readStoredPanelMode(matchId: string): LiveGoalStickerPanelMode {
    try {
        const raw = sessionStorage.getItem(`${PANEL_MODE_STORAGE_PREFIX}${matchId}`);
        if (raw === 'full' || raw === 'mini' || raw === 'hidden') return raw;
    } catch {
        /* ignore */
    }
    return 'full';
}

function persistPanelMode(matchId: string, mode: LiveGoalStickerPanelMode): void {
    try {
        sessionStorage.setItem(`${PANEL_MODE_STORAGE_PREFIX}${matchId}`, mode);
    } catch {
        /* ignore */
    }
}

function formatGoalChipLabel(goal: MatchEventItem): string {
    const name = goal.playerName?.trim();
    const short = name ? (name.split(/\s+/).pop() ?? name) : 'Gol';
    const min = `${goal.minute}'${goal.extraMin ? `+${goal.extraMin}` : ''}`;
    return `${short} ${min}`;
}

export interface LiveGoalStickerPanelProps {
    matchId: string;
    goals: MatchEventItem[];
    selectedGoal: MatchEventItem | null;
    onSelectGoal: (goal: MatchEventItem) => void;
    variant: GoalStickerVariant;
    homeTeamId?: string;
    awayTeamId?: string;
    homeTeam: string;
    awayTeam: string;
    homeFlag?: string;
    awayFlag?: string;
    homeScore: number;
    awayScore: number;
}

const LiveGoalStickerDisplay: React.FC<{
    event: MatchEventItem;
    variant: GoalStickerVariant;
    homeTeamId?: string;
    awayTeamId?: string;
    homeTeam: string;
    awayTeam: string;
    homeFlag?: string;
    awayFlag?: string;
    homeScore: number;
    awayScore: number;
    compact?: boolean;
}> = (props) => {
    const { event, compact = false } = props;
    const playerExternalId = event.playerExternalId;
    const { imageUrl: openAiUrl, loading } = useOpenAiStickerImage(playerExternalId);

    if (loading) {
        return (
            <div
                className={`mx-auto flex items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-[9px] font-semibold text-white/40 ${
                    compact ? 'h-16 w-12' : 'h-32 w-full max-w-[200px]'
                }`}
            >
                Sticker…
            </div>
        );
    }

    if (openAiUrl) {
        return (
            <img
                src={openAiUrl}
                alt={`Sticker IA: ${event.playerName ?? 'goleador'}`}
                className={
                    compact
                        ? 'mx-auto h-20 w-auto max-w-[56px] rounded-lg border border-white/20 object-contain shadow-md'
                        : 'mx-auto w-full max-w-[200px] rounded-xl border border-white/15 object-contain shadow-lg'
                }
            />
        );
    }

    return (
        <GoalScorerStickerCard
            variant={props.variant}
            event={event}
            teamName={resolveGoalTeamName(
                event,
                props.homeTeamId,
                props.awayTeamId,
                props.homeTeam,
                props.awayTeam,
            )}
            teamFlagUrl={resolveGoalTeamFlag(
                event,
                props.homeTeamId,
                props.awayTeamId,
                props.homeFlag,
                props.awayFlag,
            )}
            homeTeam={props.homeTeam}
            awayTeam={props.awayTeam}
            homeScore={props.homeScore}
            awayScore={props.awayScore}
        />
    );
};

export const LiveGoalStickerPanel: React.FC<LiveGoalStickerPanelProps> = ({
    matchId,
    goals,
    selectedGoal,
    onSelectGoal,
    variant,
    homeTeamId,
    awayTeamId,
    homeTeam,
    awayTeam,
    homeFlag,
    awayFlag,
    homeScore,
    awayScore,
}) => {
    const [panelMode, setPanelMode] = React.useState<LiveGoalStickerPanelMode>(() =>
        readStoredPanelMode(matchId),
    );

    React.useEffect(() => {
        setPanelMode(readStoredPanelMode(matchId));
    }, [matchId]);

    const updatePanelMode = React.useCallback(
        (mode: LiveGoalStickerPanelMode) => {
            setPanelMode(mode);
            persistPanelMode(matchId, mode);
        },
        [matchId],
    );

    if (!selectedGoal || goals.length === 0) return null;

    const selectedKey = buildMatchEventRowKey(selectedGoal);

    return (
        <div className="mt-2.5 border-t border-white/10 pt-2.5">
            <div className="mb-2 flex flex-wrap gap-1">
                {goals.map((goal) => {
                    const key = buildMatchEventRowKey(goal);
                    const isSelected = key === selectedKey;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onSelectGoal(goal)}
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold transition-colors ${
                                isSelected
                                    ? 'bg-lime-400/25 text-lime-200 ring-1 ring-lime-400/50'
                                    : 'bg-white/10 text-white/70 hover:bg-white/15'
                            }`}
                            aria-pressed={isSelected}
                            aria-label={`Ver sticker de ${goal.playerName ?? 'goleador'}`}
                        >
                            ⚽ {formatGoalChipLabel(goal)}
                        </button>
                    );
                })}
            </div>

            <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="truncate text-[9px] font-black uppercase tracking-wide text-white/45">
                    Sticker · {selectedGoal.playerName?.trim() || 'Goleador'}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                    {panelMode === 'full' && (
                        <button
                            type="button"
                            onClick={() => updatePanelMode('mini')}
                            className="rounded-md bg-white/10 px-1.5 py-0.5 text-[8px] font-bold text-white/70 hover:bg-white/15"
                            title="Minimizar sticker"
                        >
                            −
                        </button>
                    )}
                    {panelMode === 'mini' && (
                        <button
                            type="button"
                            onClick={() => updatePanelMode('full')}
                            className="rounded-md bg-white/10 px-1.5 py-0.5 text-[8px] font-bold text-white/70 hover:bg-white/15"
                            title="Expandir sticker"
                        >
                            ⤢
                        </button>
                    )}
                    {panelMode !== 'hidden' ? (
                        <button
                            type="button"
                            onClick={() => updatePanelMode('hidden')}
                            className="rounded-md bg-white/10 px-1.5 py-0.5 text-[8px] font-bold text-white/70 hover:bg-white/15"
                            title="Ocultar sticker"
                        >
                            ✕
                        </button>
                    ) : null}
                </div>
            </div>

            {panelMode === 'hidden' ? (
                <button
                    type="button"
                    onClick={() => updatePanelMode('full')}
                    className="w-full rounded-lg border border-dashed border-white/15 py-1.5 text-[9px] font-bold text-white/50 hover:border-white/25 hover:text-white/70"
                >
                    Ver sticker de {formatGoalChipLabel(selectedGoal)}
                </button>
            ) : panelMode === 'mini' ? (
                <button
                    type="button"
                    onClick={() => updatePanelMode('full')}
                    className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-left hover:bg-white/10"
                    title="Expandir sticker"
                >
                    <LiveGoalStickerDisplay
                        event={selectedGoal}
                        variant={variant}
                        homeTeamId={homeTeamId}
                        awayTeamId={awayTeamId}
                        homeTeam={homeTeam}
                        awayTeam={awayTeam}
                        homeFlag={homeFlag}
                        awayFlag={awayFlag}
                        homeScore={homeScore}
                        awayScore={awayScore}
                        compact
                    />
                    <span className="min-w-0 flex-1 truncate text-[9px] font-semibold text-white/60">
                        Toca para ampliar
                    </span>
                </button>
            ) : (
                <LiveGoalStickerDisplay
                    event={selectedGoal}
                    variant={variant}
                    homeTeamId={homeTeamId}
                    awayTeamId={awayTeamId}
                    homeTeam={homeTeam}
                    awayTeam={awayTeam}
                    homeFlag={homeFlag}
                    awayFlag={awayFlag}
                    homeScore={homeScore}
                    awayScore={awayScore}
                />
            )}
        </div>
    );
};

export function useLiveGoalStickerSelection(
    matchId: string,
    activeGoals: MatchEventItem[],
): {
    selectedGoal: MatchEventItem | null;
    selectGoal: (goal: MatchEventItem) => void;
    isGoalSelected: (goal: MatchEventItem) => boolean;
} {
    const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

    const latestKey = React.useMemo(() => {
        if (activeGoals.length === 0) return null;
        const sorted = [...activeGoals].sort(
            (a, b) =>
                b.minute * 100 + (b.extraMin ?? 0) - (a.minute * 100 + (a.extraMin ?? 0)),
        );
        return buildMatchEventRowKey(sorted[0]);
    }, [activeGoals]);

    React.useEffect(() => {
        if (latestKey) setSelectedKey(latestKey);
    }, [latestKey]);

    React.useEffect(() => {
        setSelectedKey(null);
    }, [matchId]);

    const selectedGoal = React.useMemo(() => {
        if (activeGoals.length === 0) return null;
        if (selectedKey) {
            const found = activeGoals.find((g) => buildMatchEventRowKey(g) === selectedKey);
            if (found) return found;
        }
        return activeGoals[activeGoals.length - 1] ?? null;
    }, [activeGoals, selectedKey]);

    const selectGoal = React.useCallback((goal: MatchEventItem) => {
        setSelectedKey(buildMatchEventRowKey(goal));
    }, []);

    const isGoalSelected = React.useCallback(
        (goal: MatchEventItem) => buildMatchEventRowKey(goal) === selectedKey,
        [selectedKey],
    );

    return { selectedGoal, selectGoal, isGoalSelected };
}
