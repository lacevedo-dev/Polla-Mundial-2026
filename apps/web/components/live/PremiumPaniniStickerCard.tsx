import React from 'react';
import type { GoalScorerStickerProps } from './GoalScorerStickerCard';
import {
    formatJerseyBadge,
    formatPremiumDisplayName,
    resolvePremiumStats,
    resolveStickerCountryCode,
    resolveStickerTheme,
    resolveWorldCupBackgroundDigits,
    type PremiumStatItem,
} from './goal-sticker-view.util';
import { FIFA_2026_STICKER_BADGE_SVG, STICKER_BRAND_RING, STICKER_WEBSITE_URL } from '../../utils/fifa-2026-sticker-badge';

const CARD_W = 340;
const CARD_H = 453;
const DISPLAY_W = 200;
const SCALE = DISPLAY_W / CARD_W;

function StatIcon({ type }: { type: PremiumStatItem['type'] }) {
    const common = 'h-3.5 w-3.5 shrink-0 opacity-90';
    if (type === 'birth') {
        return (
            <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
        );
    }
    if (type === 'height') {
        return (
            <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />
            </svg>
        );
    }
    return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 3a4 4 0 014 4v2h2a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h2V7a4 4 0 014-4z" />
            <path d="M8 15h8" />
        </svg>
    );
}

function Fifa2026LogoBadge() {
    return (
        <div className="flex h-[78px] w-[62px] flex-col items-center justify-center rounded-2xl bg-white/95 px-1 shadow-xl">
            <div
                className="h-[68px] w-[52px]"
                dangerouslySetInnerHTML={{ __html: FIFA_2026_STICKER_BADGE_SVG }}
            />
        </div>
    );
}

function PollaBrandBadge() {
    return (
        <div className="relative flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full border-[3px] border-[#c41e1e] bg-gradient-to-br from-[#f5c518] via-[#fbbf24] to-[#f59e0b] shadow-[0_4px_14px_rgba(0,0,0,.35)]">
            <span className="absolute inset-[5px] rounded-full border border-[#c41e1e]/40" />
            <span className="text-[13px] font-black leading-none tracking-tight text-[#991b1b]">PM</span>
            <span className="mt-0.5 max-w-[48px] text-center text-[5px] font-black uppercase leading-[1.05] tracking-wide text-[#991b1b]">
                {STICKER_BRAND_RING}
            </span>
        </div>
    );
}

export const PremiumPaniniStickerCard: React.FC<GoalScorerStickerProps> = (props) => {
    const { event, teamName, teamFlagUrl } = props;
    if (!event.playerName?.trim()) return null;

    const theme = resolveStickerTheme(event);
    const profile = event.playerProfile;
    const photoUrl = profile?.photoUrl ?? null;
    const flagUrl = teamFlagUrl ?? event.teamStickerTheme?.flagUrl ?? null;
    const countryCode = resolveStickerCountryCode(event, teamName);
    const [bgDigitLeft, bgDigitRight] = resolveWorldCupBackgroundDigits();
    const stats = resolvePremiumStats(event);
    const displayName = formatPremiumDisplayName(event.playerName);
    const hasJerseyNumber = profile?.jerseyNumber != null;
    const jerseyNumber = hasJerseyNumber ? formatJerseyBadge(profile!.jerseyNumber) : '';

    return (
        <div
            className="relative mx-auto mt-2.5"
            style={{ width: DISPLAY_W, height: DISPLAY_W * (CARD_H / CARD_W) }}
            aria-label={`Sticker premium de goleador: ${event.playerName}`}
        >
            <div
                className="absolute left-0 top-0 origin-top-left overflow-hidden rounded-[30px] border-[7px] border-white shadow-[0_30px_70px_rgba(0,0,0,.65)]"
                style={{
                    width: CARD_W,
                    height: CARD_H,
                    transform: `scale(${SCALE})`,
                    background: theme.primary,
                }}
            >
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(to bottom right, ${theme.primary}, color-mix(in srgb, ${theme.primary} 85%, #0f172a), ${theme.accent})`,
                    }}
                />

                <div
                    className="absolute -left-10 -top-12 text-[300px] leading-none font-black opacity-90"
                    style={{ color: theme.secondary }}
                    aria-hidden
                >
                    {bgDigitLeft}
                </div>
                <div
                    className="absolute right-[-45px] top-[70px] text-[330px] leading-none font-black opacity-90"
                    style={{ color: theme.accent }}
                    aria-hidden
                >
                    {bgDigitRight}
                </div>

                <div
                    className="absolute left-[-25px] top-[105px] h-[80px] w-[300px] rotate-[-18deg] rounded-full blur-[1px]"
                    style={{ background: `color-mix(in srgb, ${theme.secondary} 90%, transparent)` }}
                />
                <div
                    className="absolute right-[-40px] top-[245px] h-[95px] w-[300px] rotate-[-13deg] rounded-full blur-[1px]"
                    style={{ background: `color-mix(in srgb, ${theme.accent} 90%, transparent)` }}
                />

                <div className="absolute right-5 top-5 z-40">
                    <Fifa2026LogoBadge />
                </div>

                <div className="absolute left-1/2 top-[38px] z-30 h-[310px] w-[250px] -translate-x-1/2">
                    <div className="absolute inset-0 scale-90 rounded-full bg-cyan-300/35 blur-2xl" />
                    {photoUrl ? (
                        <>
                            <img
                                src={photoUrl}
                                alt=""
                                className="absolute inset-0 h-full w-full translate-y-3 object-contain object-top opacity-45 blur-[2px] brightness-0"
                            />
                            <img
                                src={photoUrl}
                                alt=""
                                className="relative z-20 h-full w-full object-contain object-top contrast-[1.08] saturate-[1.12] brightness-[1.03] drop-shadow-[0_16px_18px_rgba(0,0,0,.45)] [mask-image:linear-gradient(to_bottom,black_0%,black_78%,transparent_100%)]"
                            />
                        </>
                    ) : (
                        <div className="relative z-20 mx-auto mt-16 h-24 w-24 rounded-full border-4 border-white/60 bg-white/20" />
                    )}
                    <div className="absolute right-3 top-12 z-30 h-[210px] w-5 rounded-full bg-cyan-300/50 blur-md" />
                </div>

                <div className="absolute right-[10px] bottom-[52px] z-50 flex flex-col items-center gap-2">
                    <div className="h-[54px] w-[54px] rounded-full bg-white p-[5px] shadow-xl">
                        {flagUrl ? (
                            <img src={flagUrl} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full overflow-hidden rounded-full">
                                <div className="w-1/3" style={{ background: theme.secondary }} />
                                <div className="w-1/3 bg-white" />
                                <div className="w-1/3" style={{ background: theme.accent }} />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-center justify-center leading-[0.84]">
                        {countryCode.split('').map((letter, i) => (
                            <span
                                key={`${letter}-${i}`}
                                className="block text-center text-[44px] font-black text-transparent [-webkit-text-stroke:3.5px_white] drop-shadow-[2px_2px_0_#008fbd]"
                            >
                                {letter}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="absolute bottom-[36px] left-5 right-[78px] z-50">
                    <div
                        className="relative rounded-[22px] border-[3px] border-white px-4 pb-5 pt-3 shadow-xl"
                        style={{ background: theme.pillFrom }}
                    >
                        <div className="text-[17px] font-black uppercase leading-tight tracking-tight text-white sm:text-[19px]">
                            {displayName}
                        </div>
                        {stats.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-black text-white">
                                {stats.map((stat) => (
                                    <span key={stat.type} className="flex items-center gap-1.5">
                                        <StatIcon type={stat.type} />
                                        <span>{stat.value}</span>
                                    </span>
                                ))}
                            </div>
                        )}
                        {hasJerseyNumber && (
                            <div
                                className="absolute -bottom-[18px] left-1/2 z-[55] flex h-[36px] min-w-[52px] -translate-x-1/2 items-center justify-center rounded-b-xl rounded-t-md border-[3px] border-white px-3 text-[18px] font-black text-white shadow-lg"
                                style={{ background: theme.primary }}
                                aria-label={`Dorsal ${jerseyNumber}`}
                            >
                                {jerseyNumber}
                            </div>
                        )}
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 z-50 flex h-[32px] items-center justify-center border-t-[3px] border-white bg-[#f5c518]">
                    <span className="text-[11px] font-black tracking-wide text-[#1a1a1a]">{STICKER_WEBSITE_URL}</span>
                </div>

                <div className="absolute bottom-[10px] right-3 z-[60]">
                    <PollaBrandBadge />
                </div>

                <div className="pointer-events-none absolute inset-[10px] rounded-[22px] border border-white/60" />
            </div>
        </div>
    );
};
