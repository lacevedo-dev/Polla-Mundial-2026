import type { GoalStickerParams } from './whatsapp-image.service';

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

function formatJerseyPadded(jersey: number | string | null | undefined, digits = 3): string {
  const n = jersey != null && jersey !== '' ? Number(jersey) : 10;
  return String(Number.isFinite(n) ? n : 10).padStart(digits, '0').slice(-digits);
}

function buildFooterCode(country: string, jersey: number | string | null | undefined): string {
  return `${country} ${formatJerseyPadded(jersey)}`.trim().toUpperCase();
}

function buildCatalogNumber(jersey: number | string | null | undefined, minute: number | null | undefined): string {
  const j = String(jersey != null && jersey !== '' ? jersey : 10).padStart(2, '0');
  const min = String(minute ?? 0).padStart(1, '0');
  return `${j}${min}`.slice(0, 3);
}

function formatDisplayName(name: string): string {
  return name.trim().toUpperCase();
}

const TROPHY_SVG = `<svg class="trophy-svg" viewBox="0 0 48 48" aria-hidden="true">
  <defs>
    <linearGradient id="trophyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="var(--primary)"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <path d="M14 8h20v6c0 5.5-4.5 10-10 10S14 19.5 14 14V8z" fill="url(#trophyGrad)"/>
  <path d="M10 10h4v4c0 1.1-.9 2-2 2h-2V10zM38 10h-4v4c0 1.1.9 2 2 2h2V10z" fill="url(#trophyGrad)"/>
  <path d="M18 28h12v3H18z" fill="#12345a"/>
  <path d="M16 31h16v4a2 2 0 01-2 2H18a2 2 0 01-2-2v-4z" fill="#12345a"/>
  <ellipse cx="24" cy="14" rx="6" ry="2" fill="white" opacity="0.35"/>
</svg>`;

export function buildPremiumGoalStickerHtml(params: GoalStickerParams): string {
  const primary = params.themePrimary ?? '#16b8b3';
  const secondary = params.themeSecondary ?? '#f58220';
  const accent = params.themeAccent ?? '#078c43';
  const pillFrom = params.themePillFrom ?? '#df3328';
  const pillTo = params.themePillTo ?? '#ef4a27';
  const country = resolveCountryLabel(params);
  const stats = resolveStats(params);
  const displayName = formatDisplayName(params.playerName);
  const footerCode = buildFooterCode(country, params.jerseyNumber);
  const jerseyPadded = formatJerseyPadded(params.jerseyNumber);
  const catalogNumber = buildCatalogNumber(params.jerseyNumber, params.minute ?? null);
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
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 4px 2px;
  }
  .trophy-svg { width: 44px; height: 44px; }
  .wc-badge span { margin-top: 2px; font-size: 9px; font-weight: 900; color: #12345a; letter-spacing: .04em; }
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
  .jersey-badge {
    position: absolute; left: 52px; top: 168px; z-index: 45;
    width: 78px; height: 78px; border-radius: 999px;
    border: 5px solid #fff; background: rgba(255,255,255,.95);
    box-shadow: 0 8px 24px rgba(0,0,0,.35);
    display: flex; align-items: center; justify-content: center;
    font-size: 34px; font-weight: 900; line-height: 1; color: ${esc(accent)};
  }
  .photo-placeholder {
    width: 96px; height: 96px; margin: 64px auto 0; border-radius: 999px;
    border: 4px solid rgba(255,255,255,.6); background: rgba(255,255,255,.2);
    object-fit: unset; inset: unset; position: relative;
  }
  .country-col {
    position: absolute; right: 10px; bottom: 34px; z-index: 50;
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
    position: absolute; left: 20px; right: 78px; bottom: 62px; z-index: 50;
    border-radius: 22px; border: 3px solid #fff; padding: 12px 16px;
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
  .footer {
    position: absolute; left: 20px; right: 20px; bottom: 12px; z-index: 50;
    display: flex; align-items: center; gap: 8px;
  }
  .footer-code, .footer-catalog, .footer-accent {
    border: 3px solid #fff; color: #fff; font-weight: 900;
    display: flex; align-items: center; justify-content: center;
  }
  .footer-code {
    flex: 1; height: 36px; border-radius: 12px; font-size: 15px;
    letter-spacing: .04em; background: ${esc(pillFrom)};
  }
  .footer-catalog {
    width: 48px; height: 48px; border-radius: 0 0 16px 16px; border-top-left-radius: 6px;
    border-top-right-radius: 6px; font-size: 18px; background: ${esc(primary)};
  }
  .footer-accent {
    flex: 1; height: 36px; border-radius: 12px; position: relative; overflow: hidden;
    background: ${esc(pillTo)};
  }
  .footer-accent::after {
    content: ''; position: absolute; inset: 0; opacity: .5;
    background: linear-gradient(135deg, color-mix(in srgb, ${esc(secondary)} 60%, transparent), color-mix(in srgb, ${esc(accent)} 50%, transparent));
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
  <div class="wc-badge">${TROPHY_SVG}<span>FOOTBALL</span></div>
  <div class="player-wrap">
    <div class="player-glow"></div>
    ${photoHtml}
  </div>
  <div class="jersey-badge" aria-hidden="true">${esc(jerseyPadded)}</div>
  <div class="country-col">
    <div class="flag-wrap">${flagHtml}</div>
    <div class="country-stack">${countryLetters}</div>
  </div>
  <div class="name-box">
    <div class="name-line">${esc(displayName)}</div>
    ${stats.length > 0 ? `<div class="stats-line">${statsHtml}</div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-code">${esc(footerCode)}</div>
    <div class="footer-catalog">${esc(catalogNumber)}</div>
    <div class="footer-accent"></div>
  </div>
  <div class="inner-border"></div>
</div>
</body></html>`;
}
