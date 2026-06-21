import type { GoalStickerParams } from './whatsapp-image.service';

const STICKER_WEBSITE_URL = 'www.tupollamundial.com';
const STICKER_BRAND_RING = 'POLLA MUNDIALISTA 2026';

const FIFA_2026_STICKER_BADGE_SVG = `<svg viewBox="0 0 48 64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <text x="2" y="36" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="900" fill="#12345a">2</text>
  <text x="22" y="36" font-family="Arial Black, Arial, sans-serif" font-size="34" font-weight="900" fill="#12345a">6</text>
  <path d="M28 14c3 0 5.5 2.2 5.5 5.5 0 2.8-1.6 4.8-3.8 6.2l-1.7 1.1v3.2h-3V26.8l-1.7-1.1C21.1 24.3 19.5 22.3 19.5 19.5 19.5 16.2 22 14 25 14h3z" fill="#12345a"/>
  <path d="M24 28h4v2.5c0 1.2-.8 2-2 2h0c-1.2 0-2-.8-2-2V28z" fill="#12345a"/>
  <text x="24" y="58" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="9" font-weight="900" fill="#12345a" letter-spacing="0.08em">FIFA</text>
</svg>`;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBirthDate(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.trim();
  return `${parsed.getDate()}-${parsed.getMonth() + 1}-${parsed.getFullYear()}`;
}

type StatItem = { type: 'birth' | 'height' | 'weight'; value: string };

function resolveStats(params: GoalStickerParams): StatItem[] {
  const items: StatItem[] = [];
  if (params.birthDate?.trim()) {
    items.push({ type: 'birth', value: params.birthDate.trim() });
  } else {
    const birth = formatBirthDate(params.birthDate);
    if (birth) items.push({ type: 'birth', value: birth });
  }
  if (params.height?.trim()) items.push({ type: 'height', value: params.height.trim() });
  if (params.weight?.trim()) items.push({ type: 'weight', value: params.weight.trim() });
  return items;
}

function statIcon(type: StatItem['type']): string {
  if (type === 'birth') {
    return '<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  }
  if (type === 'height') {
    return '<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/></svg>';
  }
  return '<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a4 4 0 014 4v2h2a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h2V7a4 4 0 014-4z"/><path d="M8 15h8"/></svg>';
}

function resolveCountryLabel(params: GoalStickerParams): string {
  if (params.countryCode?.trim()) return params.countryCode.trim().toUpperCase().slice(0, 3);
  const words = params.teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GOL';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

function formatJerseyDisplay(jersey: number | string | null | undefined): string {
  if (jersey == null || jersey === '') return '10';
  return String(jersey);
}

function formatDisplayName(name: string): string {
  return name.trim().toUpperCase();
}

export function buildPremiumGoalStickerHtml(params: GoalStickerParams): string {
  const primary = params.themePrimary ?? '#16b8b3';
  const secondary = params.themeSecondary ?? '#f58220';
  const accent = params.themeAccent ?? '#078c43';
  const pillFrom = params.themePillFrom ?? '#df3328';
  const country = resolveCountryLabel(params);
  const stats = resolveStats(params);
  const displayName = formatDisplayName(params.playerName);
  const jerseyNumber = formatJerseyDisplay(params.jerseyNumber);
  const statsHtml = stats
    .map((stat) => `<span class="stat-item">${statIcon(stat.type)}<span>${esc(stat.value)}</span></span>`)
    .join('');
  const countryLetters = country
    .split('')
    .map((letter) => `<span class="country-letter">${esc(letter)}</span>`)
    .join('');

  const flagHtml = params.teamFlagUrl
    ? `<img class="flag-img" src="${esc(params.teamFlagUrl)}" alt="" crossorigin="anonymous" />`
    : `<div class="flag-stripes"><span style="background:${esc(secondary)}"></span><span style="background:#fff"></span><span style="background:${esc(accent)}"></span></div>`;

  const photoHtml = params.photoUrl
    ? `<img class="photo-shadow" src="${esc(params.photoUrl)}" alt="" crossorigin="anonymous" />
       <img class="photo-main" src="${esc(params.photoUrl)}" alt="" crossorigin="anonymous" />`
    : `<div class="photo-placeholder"></div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: transparent; width: 340px; }
  .sticker-premium {
    --primary: ${esc(primary)};
    position: relative;
    width: 340px;
    height: 453px;
    overflow: hidden;
    border-radius: 30px;
    border: 7px solid #fff;
    background: var(--primary);
    box-shadow: 0 30px 70px rgba(0,0,0,.65);
  }
  .bg-gradient {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom right, ${esc(primary)}, color-mix(in srgb, ${esc(primary)} 85%, #0f172a), ${esc(accent)});
  }
  .digit-left {
    position: absolute; left: -40px; top: -48px;
    font-size: 300px; line-height: 1; font-weight: 900; opacity: .9;
    color: ${esc(secondary)};
  }
  .digit-right {
    position: absolute; right: -45px; top: 70px;
    font-size: 330px; line-height: 1; font-weight: 900; opacity: .9;
    color: ${esc(accent)};
  }
  .brush-orange {
    position: absolute; left: -25px; top: 105px; width: 300px; height: 80px;
    border-radius: 999px; transform: rotate(-18deg); filter: blur(1px);
    background: color-mix(in srgb, ${esc(secondary)} 90%, transparent);
  }
  .brush-green {
    position: absolute; right: -40px; top: 245px; width: 300px; height: 95px;
    border-radius: 999px; transform: rotate(-13deg); filter: blur(1px);
    background: color-mix(in srgb, ${esc(accent)} 90%, transparent);
  }
  .wc-badge {
    position: absolute; right: 20px; top: 20px; z-index: 40;
    width: 62px; height: 78px; border-radius: 16px; background: rgba(255,255,255,.95);
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
    display: flex; align-items: center; justify-content: center;
    padding: 4px 2px;
  }
  .wc-badge svg { width: 52px; height: 68px; }
  .player-wrap {
    position: absolute; left: 50%; top: 38px; z-index: 30;
    width: 250px; height: 310px; transform: translateX(-50%);
  }
  .player-glow {
    position: absolute; inset: 0; border-radius: 999px;
    background: rgba(103,232,249,.35); filter: blur(24px); transform: scale(.9);
  }
  .photo-shadow, .photo-main, .photo-placeholder { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: top; }
  .photo-shadow { transform: translateY(12px); filter: blur(2px) brightness(0); opacity: .45; }
  .photo-main {
    z-index: 20; position: relative;
    filter: contrast(1.08) saturate(1.12) brightness(1.03) drop-shadow(0 16px 18px rgba(0,0,0,.45));
    -webkit-mask-image: linear-gradient(to bottom, black 0%, black 78%, transparent 100%);
    mask-image: linear-gradient(to bottom, black 0%, black 78%, transparent 100%);
  }
  .photo-placeholder {
    width: 96px; height: 96px; margin: 64px auto 0; border-radius: 999px;
    border: 4px solid rgba(255,255,255,.6); background: rgba(255,255,255,.2);
    object-fit: unset; inset: unset; position: relative;
  }
  .country-col {
    position: absolute; right: 10px; bottom: 52px; z-index: 50;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
  }
  .flag-wrap {
    width: 54px; height: 54px; border-radius: 999px; background: #fff; padding: 5px;
    box-shadow: 0 8px 24px rgba(0,0,0,.25);
  }
  .flag-img { width: 100%; height: 100%; border-radius: 999px; object-fit: cover; }
  .flag-stripes { display: flex; width: 100%; height: 100%; border-radius: 999px; overflow: hidden; }
  .flag-stripes span { flex: 1; }
  .country-stack {
    display: flex; flex-direction: column; align-items: center; line-height: .84;
  }
  .country-letter {
    display: block; text-align: center;
    font-size: 44px; font-weight: 900; color: transparent;
    -webkit-text-stroke: 3.5px white;
    text-shadow: 2px 2px 0 #008fbd;
  }
  .name-box {
    position: absolute; left: 20px; right: 78px; bottom: 36px; z-index: 50;
    border-radius: 22px; border: 3px solid #fff; padding: 12px 16px 20px;
    background: ${esc(pillFrom)}; box-shadow: 0 8px 24px rgba(0,0,0,.25);
  }
  .name-line {
    font-size: 22px; font-weight: 900; text-transform: uppercase;
    line-height: 1; letter-spacing: -.02em; color: #fff;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .stats-line {
    margin-top: 12px; display: flex; flex-wrap: wrap; gap: 12px 16px;
    font-size: 12px; font-weight: 900; color: #fff;
  }
  .stat-item { display: flex; align-items: center; gap: 6px; }
  .stat-icon { width: 14px; height: 14px; opacity: .9; flex-shrink: 0; }
  .number-shield {
    position: absolute; left: 50%; bottom: -18px; z-index: 55;
    transform: translateX(-50%);
    min-width: 52px; height: 36px; padding: 0 12px;
    border: 3px solid #fff; border-radius: 6px 6px 16px 16px;
    background: ${esc(primary)}; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 900; line-height: 1;
    box-shadow: 0 8px 18px rgba(0,0,0,.25);
  }
  .website-strip {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 50;
    height: 32px; border-top: 3px solid #fff; background: #f5c518;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 900; letter-spacing: .04em; color: #1a1a1a;
  }
  .polla-badge {
    position: absolute; right: 12px; bottom: 10px; z-index: 60;
    width: 58px; height: 58px; border-radius: 999px;
    border: 3px solid #c41e1e;
    background: linear-gradient(135deg, #f5c518, #fbbf24, #f59e0b);
    box-shadow: 0 4px 14px rgba(0,0,0,.35);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center;
  }
  .polla-badge .pm {
    font-size: 13px; font-weight: 900; line-height: 1; color: #991b1b;
  }
  .polla-badge .ring {
    margin-top: 2px; max-width: 48px;
    font-size: 5px; font-weight: 900; line-height: 1.05;
    letter-spacing: .04em; text-transform: uppercase; color: #991b1b;
  }
  .inner-border {
    pointer-events: none; position: absolute; inset: 10px;
    border-radius: 22px; border: 1px solid rgba(255,255,255,.6);
  }
</style>
</head><body>
<div class="sticker-premium">
  <div class="bg-gradient"></div>
  <div class="digit-left" aria-hidden="true">2</div>
  <div class="digit-right" aria-hidden="true">6</div>
  <div class="brush-orange"></div>
  <div class="brush-green"></div>
  <div class="wc-badge">${FIFA_2026_STICKER_BADGE_SVG}</div>
  <div class="player-wrap">
    <div class="player-glow"></div>
    ${photoHtml}
  </div>
  <div class="country-col">
    <div class="flag-wrap">${flagHtml}</div>
    <div class="country-stack">${countryLetters}</div>
  </div>
  <div class="name-box">
    <div class="name-line">${esc(displayName)}</div>
    ${stats.length > 0 ? `<div class="stats-line">${statsHtml}</div>` : ''}
    <div class="number-shield">${esc(jerseyNumber)}</div>
  </div>
  <div class="website-strip">${esc(STICKER_WEBSITE_URL)}</div>
  <div class="polla-badge">
    <span class="pm">PM</span>
    <span class="ring">${esc(STICKER_BRAND_RING)}</span>
  </div>
  <div class="inner-border"></div>
</div>
</body></html>`;
}
