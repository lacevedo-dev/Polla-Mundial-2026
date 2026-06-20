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

function formatStatsParts(params: GoalStickerParams): string[] {
  const parts: string[] = [];
  if (params.birthDate?.trim()) {
    parts.push(params.birthDate.trim());
  } else {
    const birth = formatBirthDate(params.birthDate);
    if (birth) parts.push(birth);
  }
  if (params.height?.trim()) parts.push(params.height.trim());
  if (params.weight?.trim()) parts.push(params.weight.trim());
  return parts;
}

function resolveCountryLabel(params: GoalStickerParams): string {
  if (params.countryCode?.trim()) return params.countryCode.trim().toUpperCase().slice(0, 3);
  const words = params.teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GOL';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

function resolveJerseyDigits(params: GoalStickerParams): [string, string] {
  const n = params.jerseyNumber;
  const raw = n != null && n !== '' ? String(n).padStart(2, '0').slice(-2) : '10';
  return [raw[0] ?? '1', raw[1] ?? '0'];
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: '', last: parts[0] ?? '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] ?? '' };
}

function buildFooterCode(country: string, jersey: number | string | null | undefined): string {
  const j = String(jersey ?? 0).padStart(2, '0');
  return `${country}${j}`.slice(0, 5).toUpperCase();
}

function buildCatalogNumber(jersey: number | string | null | undefined, minute: number | null): string {
  const j = String(jersey ?? 10).padStart(2, '0');
  const m = String(minute ?? 0).padStart(1, '0');
  return `${j}${m}`.slice(0, 3);
}

export function buildPremiumGoalStickerHtml(params: GoalStickerParams): string {
  const primary = params.themePrimary ?? '#16b8b3';
  const secondary = params.themeSecondary ?? '#f58220';
  const accent = params.themeAccent ?? '#078c43';
  const pillFrom = params.themePillFrom ?? '#df3328';
  const pillTo = params.themePillTo ?? '#ef4a27';
  const country = resolveCountryLabel(params);
  const [digit1, digit2] = resolveJerseyDigits(params);
  const statsParts = formatStatsParts(params);
  const nameParts = splitName(params.playerName);
  const footerCode = buildFooterCode(country, params.jerseyNumber);
  const catalogNumber = buildCatalogNumber(params.jerseyNumber, params.minute);
  const statsHtml = statsParts
    .map((part, i) => `${i > 0 ? '<span class="dot">•</span>' : ''}<span>${esc(part)}</span>`)
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
    position: relative;
    width: 340px;
    height: 453px;
    overflow: hidden;
    border-radius: 30px;
    border: 7px solid #fff;
    background: ${esc(primary)};
    box-shadow: 0 30px 70px rgba(0,0,0,.65);
  }
  .bg-gradient {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom right, ${esc(primary)}, color-mix(in srgb, ${esc(primary)} 85%, #0f172a), ${esc(accent)});
  }
  .halftone-bg {
    position: absolute; inset: 0; opacity: .25;
    background-image: radial-gradient(circle at 20% 20%, white 1px, transparent 1px);
    background-size: 12px 12px;
  }
  .digit-left {
    position: absolute; left: -40px; top: -48px;
    font-size: 300px; line-height: 1; font-weight: 900; opacity: .95;
    color: ${esc(secondary)};
  }
  .digit-right {
    position: absolute; right: -45px; top: 70px;
    font-size: 330px; line-height: 1; font-weight: 900; opacity: .95;
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
  }
  .wc-badge .dot { width: 32px; height: 44px; border-radius: 999px; background: ${esc(primary)}; }
  .wc-badge span { margin-top: 4px; font-size: 10px; font-weight: 900; color: #12345a; }
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
  .halftone-mid {
    position: absolute; left: 45px; top: 145px; z-index: 35;
    width: 140px; height: 110px; opacity: .7;
    background-image: radial-gradient(circle, white 1.6px, transparent 2px);
    background-size: 11px 11px;
  }
  .flag-wrap {
    position: absolute; right: 28px; bottom: 145px; z-index: 50;
    width: 54px; height: 54px; border-radius: 999px; background: #fff; padding: 5px;
    box-shadow: 0 8px 24px rgba(0,0,0,.25);
  }
  .flag-img { width: 100%; height: 100%; border-radius: 999px; object-fit: cover; }
  .flag-stripes { display: flex; width: 100%; height: 100%; border-radius: 999px; overflow: hidden; }
  .flag-stripes span { flex: 1; }
  .country-stack {
    position: absolute; right: 18px; bottom: 38px; z-index: 40;
    display: flex; flex-direction: column; line-height: .76;
  }
  .country-letter {
    font-size: 48px; font-weight: 900; color: transparent;
    -webkit-text-stroke: 4px white;
    text-shadow: 2px 2px 0 #008fbd;
  }
  .name-box {
    position: absolute; left: 20px; right: 70px; bottom: 62px; z-index: 50;
    border-radius: 22px; border: 3px solid #fff; padding: 12px 16px;
    background: ${esc(pillFrom)}; box-shadow: 0 8px 24px rgba(0,0,0,.25);
  }
  .name-line {
    font-size: 22px; font-weight: 900; text-transform: uppercase;
    line-height: 1; letter-spacing: -.02em; color: #fff;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .stats-line {
    margin-top: 12px; display: flex; flex-wrap: wrap; gap: 12px;
    font-size: 13px; font-weight: 900; color: #fff;
  }
  .stats-line .dot { opacity: .85; }
  .footer {
    position: absolute; left: 20px; right: 20px; bottom: 12px; z-index: 50;
    display: flex; align-items: center; gap: 8px;
  }
  .footer-code, .footer-catalog, .footer-dots {
    border: 3px solid #fff; color: #fff; font-weight: 900;
    display: flex; align-items: center; justify-content: center;
  }
  .footer-code {
    flex: 1; height: 36px; border-radius: 12px; font-size: 18px;
    background: ${esc(pillFrom)};
  }
  .footer-catalog {
    width: 48px; height: 48px; border-radius: 0 0 16px 16px; border-top-left-radius: 6px;
    border-top-right-radius: 6px; font-size: 20px; background: ${esc(primary)};
  }
  .footer-dots {
    flex: 1; height: 36px; border-radius: 12px; position: relative; overflow: hidden;
    background: ${esc(pillTo)};
  }
  .footer-dots::after {
    content: ''; position: absolute; inset: 0; opacity: .7;
    background-image: radial-gradient(circle, #ffd229 1.8px, transparent 2px);
    background-size: 10px 10px;
  }
  .inner-border {
    pointer-events: none; position: absolute; inset: 10px;
    border-radius: 22px; border: 1px solid rgba(255,255,255,.6);
  }
</style>
</head><body>
<div class="sticker-premium">
  <div class="bg-gradient"></div>
  <div class="halftone-bg"></div>
  <div class="digit-left" aria-hidden="true">${esc(digit1)}</div>
  <div class="digit-right" aria-hidden="true">${esc(digit2)}</div>
  <div class="brush-orange"></div>
  <div class="brush-green"></div>
  <div class="wc-badge"><div class="dot"></div><span>MUNDIAL</span></div>
  <div class="player-wrap">
    <div class="player-glow"></div>
    ${photoHtml}
  </div>
  <div class="halftone-mid"></div>
  <div class="flag-wrap">${flagHtml}</div>
  <div class="country-stack">${countryLetters}</div>
  <div class="name-box">
    <div class="name-line">${esc(nameParts.first ? `${nameParts.first} ` : '')}<strong>${esc(nameParts.last)}</strong></div>
    ${statsParts.length > 0 ? `<div class="stats-line">${statsHtml}</div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-code">${esc(footerCode)}</div>
    <div class="footer-catalog">${esc(catalogNumber)}</div>
    <div class="footer-dots"></div>
  </div>
  <div class="inner-border"></div>
</div>
</body></html>`;
}
