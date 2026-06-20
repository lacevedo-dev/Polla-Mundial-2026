import React from 'react';
import type { GoalScorerStickerProps } from './GoalScorerStickerCard';
import {
    buildPremiumCatalogNumber,
    buildPremiumFooterCode,
    formatPremiumStatsParts,
    resolveJerseyDigits,
    resolveStickerCountryCode,
    resolveStickerTheme,
    splitPlayerName,
} from './goal-sticker-view.util';

const CARD_W = 340;
const CARD_H = 453;
const DISPLAY_W = 200;
const SCALE = DISPLAY_W / CARD_W;

export const PremiumPaniniStickerCard: React.FC<GoalScorerStickerProps> = (props) => {
    const { event, teamName, teamFlagUrl } = props;
    if (!event.playerName?.trim()) return null;

    const theme = resolveStickerTheme(event);
    const profile = event.playerProfile;
    const photoUrl = profile?.photoUrl ?? null;
    const flagUrl = teamFlagUrl ?? event.teamStickerTheme?.flagUrl ?? null;
    const countryCode = resolveStickerCountryCode(event, teamName);
    const [digit1, digit2] = resolveJerseyDigits(profile?.jerseyNumber ?? null);
    const statsParts = formatPremiumStatsParts(event);
    const nameParts = splitPlayerName(event.playerName);
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
                <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:12px_12px]" />

                <div
                    className="absolute -left-10 -top-12 text-[300px] leading-none font-black opacity-95"
                    style={{ color: theme.secondary }}
                    aria-hidden
                >
                    {digit1}
                </div>
                <div
                    className="absolute right-[-45px] top-[70px] text-[330px] leading-none font-black opacity-95"
                    style={{ color: theme.accent }}
                    aria-hidden
                >
                    {digit2}
                </div>

                <div className="absolute left-[105px] top-[110px] h-[110px] w-[110px] rotate-3 bg-white/95" />
                <div
                    className="absolute left-[-25px] top-[105px] h-[80px] w-[300px] rotate-[-18deg] rounded-full blur-[1px]"
                    style={{ background: `color-mix(in srgb, ${theme.secondary} 90%, transparent)` }}
                />
                <div
                    className="absolute right-[-40px] top-[245px] h-[95px] w-[300px] rotate-[-13deg] rounded-full blur-[1px]"
                    style={{ background: `color-mix(in srgb, ${theme.accent} 90%, transparent)` }}
                />

                <div className="absolute right-5 top-5 z-40 flex h-[78px] w-[62px] flex-col items-center justify-center rounded-2xl bg-white/95 shadow-xl">
                    <div className="h-11 w-8 rounded-full" style={{ background: theme.primary }} />
                    <span className="mt-1 text-[10px] font-black text-[#12345a]">MUNDIAL</span>
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

                <div className="absolute left-[45px] top-[145px] z-[35] h-[110px] w-[140px] opacity-70 bg-[radial-gradient(circle,white_1.6px,transparent_2px)] [background-size:11px_11px]" />

                <div className="absolute right-[28px] bottom-[145px] z-50 h-[54px] w-[54px] rounded-full bg-white p-[5px] shadow-xl">
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

                <div className="absolute right-[18px] bottom-[38px] z-40 flex flex-col leading-[.76]">
                    {countryCode.split('').map((letter, i) => (
                        <span
                            key={`${letter}-${i}`}
                            className="text-[48px] font-black text-transparent [-webkit-text-stroke:4px_white] drop-shadow-[2px_2px_0_#008fbd]"
                        >
                            {letter}
                        </span>
                    ))}
                </div>

                <div className="absolute bottom-[62px] left-5 right-[70px] z-50">
                    <div
                        className="rounded-[22px] border-[3px] border-white px-4 py-3 shadow-xl"
                        style={{ background: theme.pillFrom }}
                    >
                        <div className="text-[22px] font-black uppercase leading-none tracking-tight text-white">
                            {nameParts.first ? `${nameParts.first} ` : ''}
                            <span className="font-black">{nameParts.last}</span>
                        </div>
                        {statsParts.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] font-black text-white">
                                {statsParts.map((part, i) => (
                                    <React.Fragment key={part}>
                                        {i > 0 && <span>•</span>}
                                        <span>{part}</span>
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="absolute bottom-3 left-5 right-5 z-50 flex items-center gap-2">
                    <div
                        className="flex h-[36px] flex-1 items-center justify-center rounded-xl border-[3px] border-white text-lg font-black text-white"
                        style={{ background: theme.pillFrom }}
                    >
                        {footerCode}
                    </div>
                    <div
                        className="flex h-[48px] w-[48px] items-center justify-center rounded-b-2xl rounded-t-md border-[3px] border-white text-xl font-black text-white"
                        style={{ background: theme.primary }}
                    >
                        {catalogNumber}
                    </div>
                    <div
                        className="relative h-[36px] flex-1 overflow-hidden rounded-xl border-[3px] border-white"
                        style={{ background: theme.pillTo }}
                    >
                        <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle,#ffd229_1.8px,transparent_2px)] [background-size:10px_10px]" />
                    </div>
                </div>

                <div className="pointer-events-none absolute inset-[10px] rounded-[22px] border border-white/60" />
            </div>
        </div>
    );
};
