import React from 'react';
import type { GoalScorerStickerProps } from './GoalScorerStickerCard';
import {
    buildPremiumCatalogNumber,
    buildPremiumFooterCode,
    formatJerseyNumberPadded,
    formatPremiumDisplayName,
    resolvePremiumStats,
    resolveStickerCountryCode,
    resolveStickerTheme,
    resolveWorldCupBackgroundDigits,
    type PremiumStatItem,
} from './goal-sticker-view.util';

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

function TrophyBadge({ primary }: { primary: string }) {
    return (
        <div className="flex h-[78px] w-[62px] flex-col items-center justify-center rounded-2xl bg-white/95 px-1 shadow-xl">
            <svg viewBox="0 0 48 48" className="h-11 w-11" aria-hidden>
                <defs>
                    <linearGradient id="trophyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={primary} />
                        <stop offset="100%" stopColor="#0ea5e9" />
                    </linearGradient>
                </defs>
                <path
                    d="M14 8h20v6c0 5.5-4.5 10-10 10S14 19.5 14 14V8z"
                    fill="url(#trophyGrad)"
                />
                <path d="M10 10h4v4c0 1.1-.9 2-2 2h-2V10zM38 10h-4v4c0 1.1.9 2 2 2h2V10z" fill="url(#trophyGrad)" />
                <path d="M18 28h12v3H18z" fill="#12345a" />
                <path d="M16 31h16v4a2 2 0 01-2 2H18a2 2 0 01-2-2v-4z" fill="#12345a" />
                <ellipse cx="24" cy="14" rx="6" ry="2" fill="white" opacity="0.35" />
            </svg>
            <span className="mt-0.5 text-[9px] font-black tracking-wide text-[#12345a]">FOOTBALL</span>
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
    const jerseyPadded = formatJerseyNumberPadded(profile?.jerseyNumber);
    const footerCode = buildPremiumFooterCode(countryCode, profile?.jerseyNumber);
    const catalogNumber = buildPremiumCatalogNumber(profile?.jerseyNumber, event.minute);

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
                    <TrophyBadge primary={theme.primary} />
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

                {/* Dorsal destacado — identificador del jugador aparte del 26 de fondo */}
                <div
                    className="absolute left-[52px] top-[168px] z-[45] flex h-[78px] w-[78px] items-center justify-center rounded-full border-[5px] border-white bg-white/95 shadow-[0_8px_24px_rgba(0,0,0,.35)]"
                    aria-label={`Dorsal ${jerseyPadded}`}
                >
                    <span
                        className="text-[34px] font-black leading-none tracking-tight"
                        style={{ color: theme.accent }}
                    >
                        {jerseyPadded}
                    </span>
                </div>

                <div className="absolute right-[10px] bottom-[34px] z-50 flex flex-col items-center gap-2">
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

                <div className="absolute bottom-[62px] left-5 right-[78px] z-50">
                    <div
                        className="rounded-[22px] border-[3px] border-white px-4 py-3 shadow-xl"
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
                    </div>
                </div>

                <div className="absolute bottom-3 left-5 right-5 z-50 flex items-center gap-2">
                    <div
                        className="flex h-[36px] flex-1 items-center justify-center rounded-xl border-[3px] border-white text-[15px] font-black tracking-wide text-white"
                        style={{ background: theme.pillFrom }}
                    >
                        {footerCode}
                    </div>
                    <div
                        className="flex h-[48px] w-[48px] items-center justify-center rounded-b-2xl rounded-t-md border-[3px] border-white text-lg font-black text-white"
                        style={{ background: theme.primary }}
                    >
                        {catalogNumber}
                    </div>
                    <div
                        className="relative h-[36px] flex-1 overflow-hidden rounded-xl border-[3px] border-white"
                        style={{ background: theme.pillTo }}
                    >
                        <div
                            className="absolute inset-0 opacity-50"
                            style={{
                                background: `linear-gradient(135deg, color-mix(in srgb, ${theme.secondary} 60%, transparent), color-mix(in srgb, ${theme.accent} 50%, transparent))`,
                            }}
                        />
                    </div>
                </div>

                <div className="pointer-events-none absolute inset-[10px] rounded-[22px] border border-white/60" />
            </div>
        </div>
    );
};
