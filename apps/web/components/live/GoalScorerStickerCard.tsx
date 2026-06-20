import React from 'react';
import type { MatchEventItem } from '../../hooks/useLiveSyncEvents';
import type { GoalStickerVariant } from '../../utils/goalStickerConfig';
import { PremiumPaniniStickerCard } from './PremiumPaniniStickerCard';
import {
    formatClassicStatsLine,
    resolveJerseyDigits,
    resolveStickerCountryCode,
    resolveStickerTheme,
} from './goal-sticker-view.util';

export interface GoalScorerStickerProps {
    event: MatchEventItem;
    teamName: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    leagueName?: string;
    teamFlagUrl?: string | null;
    variant?: GoalStickerVariant;
}

const ClassicGoalScorerStickerCard: React.FC<GoalScorerStickerProps> = (props) => {
    const { event, teamName, leagueName, teamFlagUrl } = props;
    if (!event.playerName?.trim()) return null;

    const theme = resolveStickerTheme(event);
    const profile = event.playerProfile;
    const photoUrl = profile?.photoUrl ?? null;
    const flagUrl = teamFlagUrl ?? event.teamStickerTheme?.flagUrl ?? null;

    const minuteLabel = `${event.minute}'${event.extraMin ? `+${event.extraMin}` : ''}`;
    const detailLabel =
        event.detail?.toLowerCase().includes('own goal')
            ? 'Autogol'
            : event.detail?.toLowerCase().includes('penalty')
                ? 'Penalti'
                : 'Gol';
    const countryCode = resolveStickerCountryCode(event, teamName);
    const [digit1, digit2] = resolveJerseyDigits(profile?.jerseyNumber ?? null);
    const statsLine = formatClassicStatsLine(event, props, minuteLabel, detailLabel);

    return (
        <div
            className="relative mt-2.5 mx-auto w-full max-w-[200px] overflow-hidden rounded-xl shadow-lg"
            style={{ aspectRatio: '300 / 420' }}
            aria-label={`Sticker de goleador: ${event.playerName}`}
        >
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(165deg, ${theme.primary} 0%, ${theme.primary}dd 45%, ${theme.primary}bb 100%)`,
                }}
            />
            <div
                className="pointer-events-none absolute inset-x-0 top-2 flex select-none items-start justify-center text-[5.5rem] font-black leading-none tracking-tighter"
                aria-hidden
            >
                <span style={{ color: theme.secondary, textShadow: `2px 2px 0 ${theme.pillFrom}` }}>{digit1}</span>
                <span className="-ml-1" style={{ color: theme.accent, textShadow: `2px 2px 0 ${theme.pillTo}` }}>{digit2}</span>
            </div>

            <div className="absolute right-1.5 top-1.5 z-10 rounded-md bg-white/90 px-1.5 py-0.5 text-center text-[6px] font-black leading-tight text-blue-900">
                ⚽<br />MUNDIAL
            </div>

            <div className="absolute right-1 top-1/2 z-10 flex -translate-y-[42%] flex-col items-center gap-1">
                {flagUrl ? (
                    <img src={flagUrl} alt="" className="h-4 w-4 rounded-full border border-white object-cover" />
                ) : (
                    <span className="h-4 w-4 rounded-full border border-white bg-gradient-to-b from-yellow-300 via-blue-600 to-red-600" />
                )}
                <span
                    className="text-lg font-black tracking-wide text-white"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                    {countryCode}
                </span>
            </div>

            <div className="absolute left-1/2 top-[44%] z-[5] flex h-[56%] w-[84%] -translate-x-1/2 -translate-y-1/2 items-end justify-center overflow-hidden">
                {photoUrl ? (
                    <img
                        src={photoUrl}
                        alt=""
                        className="h-full w-full object-cover object-[center_8%] drop-shadow-lg scale-110"
                    />
                ) : (
                    <div className="mb-3 h-14 w-14 rounded-full border-2 border-white/50 bg-white/20" />
                )}
            </div>
            <div
                className="pointer-events-none absolute inset-x-0 bottom-[4.5rem] z-[6] h-10"
                style={{
                    background: `linear-gradient(to bottom, transparent, ${theme.primary})`,
                }}
            />

            <div className="absolute inset-x-2 bottom-7 z-10 space-y-0.5">
                <div
                    className="rounded-lg px-2 py-1.5 shadow-md"
                    style={{ background: `linear-gradient(180deg, ${theme.pillFrom} 0%, ${theme.pillTo} 100%)` }}
                >
                    <p className="truncate text-[10px] font-black uppercase tracking-wide text-white">
                        {event.playerName}
                    </p>
                    <p className="truncate text-[7px] font-semibold text-white/95">{statsLine}</p>
                </div>
                <div
                    className="rounded-lg px-2 py-1 shadow-md"
                    style={{ background: `linear-gradient(180deg, ${theme.pillFrom} 0%, ${theme.pillTo} 100%)` }}
                >
                    {event.assistName ? (
                        <p className="truncate text-[6px] font-bold uppercase tracking-wide text-white/90">
                            Asist. {event.assistName}
                        </p>
                    ) : (
                        <p className="truncate text-[6px] font-bold uppercase tracking-wide text-white/90">
                            {teamName}{leagueName ? ` · ${leagueName}` : ''}
                        </p>
                    )}
                </div>
            </div>

            <div className="absolute bottom-1 right-1.5 z-10 rounded border border-yellow-600 bg-yellow-400 px-1.5 py-0.5 text-[6px] font-black tracking-widest text-red-700">
                POLLA
            </div>
        </div>
    );
};

export const GoalScorerStickerCard: React.FC<GoalScorerStickerProps> = (props) => {
    if (props.variant === 'premium') {
        return <PremiumPaniniStickerCard {...props} />;
    }
    return <ClassicGoalScorerStickerCard {...props} />;
};

export function pickLatestActiveGoal(events: MatchEventItem[]): MatchEventItem | null {
    const goals = events
        .filter((e) => e.type === 'GOAL' && !e.annulled && e.playerName?.trim())
        .sort((a, b) => {
            const ma = a.minute * 100 + (a.extraMin ?? 0);
            const mb = b.minute * 100 + (b.extraMin ?? 0);
            return mb - ma;
        });
    return goals[0] ?? null;
}

export function resolveGoalTeamName(
    event: MatchEventItem,
    homeTeamId: string | undefined,
    awayTeamId: string | undefined,
    homeTeam: string,
    awayTeam: string,
): string {
    if (event.teamId && homeTeamId && event.teamId === homeTeamId) return homeTeam;
    if (event.teamId && awayTeamId && event.teamId === awayTeamId) return awayTeam;
    return homeTeam;
}

export function resolveGoalTeamFlag(
    event: MatchEventItem,
    homeTeamId: string | undefined,
    awayTeamId: string | undefined,
    homeFlag?: string,
    awayFlag?: string,
): string | null {
    if (event.teamStickerTheme?.flagUrl) return event.teamStickerTheme.flagUrl;
    if (event.teamId && homeTeamId && event.teamId === homeTeamId) return homeFlag ?? null;
    if (event.teamId && awayTeamId && event.teamId === awayTeamId) return awayFlag ?? null;
    return homeFlag ?? null;
}
