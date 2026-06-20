import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ResultEntry } from '../prediction-report/prediction-report-email.service';

export interface MatchInfo {
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  homeScore?: number | null;
  awayScore?: number | null;
  venue?: string | null;
  round?: string | null;
}

export interface ResultsCardParams {
  match: MatchInfo & { homeScore: number; awayScore: number };
  leagueName: string;
  leagueCode: string;
  results: ResultEntry[];
  sentAt: Date;
}

export interface PredictionsCardParams {
  match: MatchInfo;
  leagueName: string;
  leagueCode: string;
  predictors: Array<{
    name: string;
    homeScore: number;
    awayScore: number;
    isAdmin: boolean;
  }>;
  sentAt: Date;
}

export interface GoalStickerParams {
  playerName: string;
  teamName: string;
  minute: number | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  leagueName: string;
  assistName?: string | null;
  goalDetail?: string | null;
  photoUrl?: string | null;
  nationality?: string | null;
  /** Dorsal del jugador (gráfico de fondo). */
  jerseyNumber?: number | string | null;
  birthDate?: string | null;
  height?: string | null;
  weight?: string | null;
  /** Código ISO3 o abreviatura del país/selección (vertical derecha). */
  countryCode?: string | null;
  teamFlagUrl?: string | null;
  themePrimary?: string;
  themeSecondary?: string;
  themeAccent?: string;
  themePillFrom?: string;
  themePillTo?: string;
}

const OUTCOME_ICON: Record<string, string> = {
  EXACT_UNIQUE: '👑',
  EXACT: '🎯',
  WINNER_GOAL: '⚽',
  WINNER: '✅',
  GOAL: '🏃',
  WRONG: '❌',
};

function slug(text: string): string {
  return text.replace(/\s+/g, '_').replace(/[^\w_]/g, '');
}

function formatStickerBirthDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getDate()}-${parsed.getMonth() + 1}-${parsed.getFullYear()}`;
}

function formatStickerStats(params: GoalStickerParams): string {
  const parts: string[] = [];
  if (params.birthDate?.trim()) {
    parts.push(params.birthDate.trim());
  } else {
    const birth = formatStickerBirthDate(params.birthDate);
    if (birth) parts.push(birth);
  }
  if (params.height?.trim()) parts.push(params.height.trim());
  if (params.weight?.trim()) parts.push(params.weight.trim());
  if (parts.length > 0) return parts.join(' | ');

  const minute = params.minute != null ? `${params.minute}'` : 'En vivo';
  const detail =
    params.goalDetail === 'Own Goal'
      ? 'Autogol'
      : params.goalDetail === 'Penalty'
        ? 'Penalti'
        : 'Gol';
  return `${detail} · ${minute} · ${params.homeScore}–${params.awayScore}`;
}

function resolveCountryVerticalLabel(params: GoalStickerParams): string {
  if (params.countryCode?.trim()) return params.countryCode.trim().toUpperCase().slice(0, 3);
  const words = params.teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GOL';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

function resolveJerseyGraphic(params: GoalStickerParams): string {
  const n = params.jerseyNumber;
  if (n == null || n === '') return '10';
  return String(n).slice(0, 2);
}

@Injectable()
export class WhatsappImageService {
  private readonly logger = new Logger(WhatsappImageService.name);
  private readonly executablePath: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.executablePath = this.config.get<string>('PUPPETEER_EXECUTABLE_PATH');
  }

  async buildResultsCard(params: ResultsCardParams): Promise<Buffer> {
    const top5 = [...params.results]
      .sort((a, b) => (a.newPosition ?? 99) - (b.newPosition ?? 99))
      .slice(0, 5);

    const rows = top5
      .map(
        (r) => `
        <tr>
          <td class="pos">${r.newPosition}</td>
          <td class="name">${esc(r.name)}${r.isAdmin ? ' <span class="badge">Admin</span>' : ''}</td>
          <td class="pred">${r.homeScore}–${r.awayScore}</td>
          <td class="pts">${OUTCOME_ICON[r.outcome] ?? ''} +${r.pointsEarned}pts</td>
        </tr>`,
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #fff; width: 520px; }
  .card { padding: 24px; }
  .header { text-align: center; margin-bottom: 16px; }
  .badge-done { background: #22c55e; color: #fff; font-size: 10px; font-weight: 900;
    letter-spacing: .12em; text-transform: uppercase; padding: 3px 10px;
    border-radius: 20px; display: inline-block; margin-bottom: 10px; }
  .score { font-size: 48px; font-weight: 900; letter-spacing: -2px; color: #fbbf24; }
  .teams { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  .league { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: #64748b; margin-top: 8px; }
  .divider { border: none; border-top: 1px solid #1e293b; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: #475569; padding-bottom: 6px; text-align: left; }
  td { padding: 5px 4px; border-bottom: 1px solid #1e293b; }
  td.pos { width: 28px; font-weight: 900; color: #fbbf24; }
  td.name { font-weight: 600; }
  td.pred { color: #94a3b8; font-size: 12px; }
  td.pts { text-align: right; font-weight: 700; white-space: nowrap; }
  .badge { background: #1e293b; color: #64748b; font-size: 9px; padding: 1px 5px;
    border-radius: 8px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .footer { text-align: center; font-size: 10px; color: #334155; margin-top: 14px; }
</style>
</head><body>
<div class="card">
  <div class="header">
    <div class="badge-done">Partido Finalizado</div>
    <div class="score">${params.match.homeScore} – ${params.match.awayScore}</div>
    <div class="teams">${esc(params.match.homeTeam)} vs ${esc(params.match.awayTeam)}</div>
    <div class="league">${esc(params.leagueName)} · ${esc(params.leagueCode)}</div>
  </div>
  <hr class="divider">
  <table>
    <thead><tr>
      <th>#</th><th>Participante</th><th>Pronóstico</th><th>Pts</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Reporte completo en PDF adjunto · ${params.sentAt.toLocaleDateString('es-CO')}</div>
</div>
</body></html>`;

    return this.renderHtmlToImage(html, 520);
  }

  async buildPredictionsCard(params: PredictionsCardParams): Promise<Buffer> {
    const top8 = params.predictors.slice(0, 8);

    const rows = top8
      .map(
        (p) => `
        <tr>
          <td class="name">${esc(p.name)}${p.isAdmin ? ' <span class="badge">Admin</span>' : ''}</td>
          <td class="pred">${p.homeScore}–${p.awayScore}</td>
        </tr>`,
      )
      .join('');

    const matchDate = new Date(params.match.matchDate).toLocaleDateString('es-CO', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #fff; width: 520px; }
  .card { padding: 24px; }
  .header { text-align: center; margin-bottom: 16px; }
  .badge-closed { background: #6366f1; color: #fff; font-size: 10px; font-weight: 900;
    letter-spacing: .12em; text-transform: uppercase; padding: 3px 10px;
    border-radius: 20px; display: inline-block; margin-bottom: 10px; }
  .vs { font-size: 22px; font-weight: 900; color: #f8fafc; margin: 8px 0; }
  .date { font-size: 12px; color: #64748b; }
  .league { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: #64748b; margin-top: 6px; }
  .divider { border: none; border-top: 1px solid #1e293b; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: #475569; padding-bottom: 6px; text-align: left; }
  td { padding: 5px 4px; border-bottom: 1px solid #1e293b; }
  td.name { font-weight: 600; }
  td.pred { color: #fbbf24; font-weight: 700; font-size: 14px; text-align: right; }
  .badge { background: #1e293b; color: #64748b; font-size: 9px; padding: 1px 5px;
    border-radius: 8px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .footer { text-align: center; font-size: 10px; color: #334155; margin-top: 14px; }
  .count { font-size: 11px; color: #475569; text-align: right; margin-bottom: 8px; }
</style>
</head><body>
<div class="card">
  <div class="header">
    <div class="badge-closed">Predicciones Cerradas</div>
    <div class="vs">${esc(params.match.homeTeam)} vs ${esc(params.match.awayTeam)}</div>
    <div class="date">${matchDate}</div>
    <div class="league">${esc(params.leagueName)} · ${esc(params.leagueCode)}</div>
  </div>
  <hr class="divider">
  <div class="count">${params.predictors.length} pronóstico${params.predictors.length !== 1 ? 's' : ''}</div>
  <table>
    <thead><tr><th>Participante</th><th style="text-align:right">Pronóstico</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Reporte completo en PDF adjunto · ${params.sentAt.toLocaleDateString('es-CO')}</div>
</div>
</body></html>`;

    return this.renderHtmlToImage(html, 520);
  }

  /** Sticker estilo álbum coleccionable (referencia Panini WC). */
  async buildGoalSticker(params: GoalStickerParams): Promise<Buffer> {
    const statsLine = formatStickerStats(params);
    const countryLabel = resolveCountryVerticalLabel(params);
    const jerseyDigits = resolveJerseyGraphic(params);
    const digit1 = jerseyDigits[0] ?? '1';
    const digit2 = jerseyDigits[1] ?? '0';
    const bgPrimary = params.themePrimary ?? '#3ebdb4';
    const bgSecondary = params.themeSecondary ?? '#f5c518';
    const bgAccent = params.themeAccent ?? '#009e60';
    const pillFrom = params.themePillFrom ?? '#e31b23';
    const pillTo = params.themePillTo ?? '#b91c1c';
    const clubLine = params.assistName
      ? `Asist. ${params.assistName}`
      : `${params.teamName} · ${params.leagueName}`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: transparent; width: 300px; }
  .sticker {
    --bg: ${esc(bgPrimary)};
    --pill: ${esc(pillFrom)};
    --pill-dark: ${esc(pillTo)};
    position: relative;
    width: 300px;
    height: 420px;
    overflow: hidden;
    border-radius: 16px;
    background: linear-gradient(168deg, var(--bg) 0%, var(--bg) 55%, color-mix(in srgb, var(--bg) 75%, #0f172a) 100%);
    box-shadow: 0 10px 28px rgba(0,0,0,0.35);
  }
  .sticker::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 55% at 50% 18%, rgba(255,255,255,0.14) 0%, transparent 70%);
    pointer-events: none;
    z-index: 1;
  }
  .num-back {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 14px;
    font-size: 172px;
    font-weight: 900;
    line-height: 0.78;
    letter-spacing: -10px;
    pointer-events: none;
    user-select: none;
    z-index: 2;
  }
  .num-back .d1 {
    color: ${esc(bgSecondary)};
    text-shadow: 4px 4px 0 rgba(0,0,0,0.12), 2px 2px 0 ${esc(pillFrom)};
  }
  .num-back .d2 {
    color: ${esc(bgAccent)};
    text-shadow: 4px 4px 0 rgba(0,0,0,0.12), 2px 2px 0 ${esc(pillTo)};
    margin-left: -8px;
  }
  .wc-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 6;
    background: rgba(255,255,255,0.94);
    border-radius: 8px;
    padding: 5px 8px;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: .06em;
    color: #1e3a8a;
    text-align: center;
    line-height: 1.25;
    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
  }
  .country-side {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-40%);
    z-index: 6;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .flag-img {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #fff;
    object-fit: cover;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }
  .flag-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #fff;
    background: linear-gradient(180deg, #f77f00 33%, #fff 33% 66%, #009e60 66%);
  }
  .country-code {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    font-size: 30px;
    font-weight: 900;
    letter-spacing: .08em;
    color: #fff;
    font-family: 'Arial Black', 'Segoe UI', sans-serif;
    text-shadow:
      0 0 0 #1e40af,
      1px 1px 0 rgba(0,0,0,0.35),
      0 2px 8px rgba(0,0,0,0.2);
    -webkit-text-stroke: 1px rgba(30,64,175,0.45);
  }
  .photo-stage {
    position: absolute;
    left: 50%;
    top: 118px;
    transform: translateX(-50%);
    z-index: 4;
    width: 252px;
    height: 210px;
    overflow: hidden;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 8%;
    transform: scale(1.08);
    filter: drop-shadow(0 10px 18px rgba(0,0,0,0.38));
  }
  .photo.placeholder {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background: rgba(255,255,255,0.22);
    border: 3px solid rgba(255,255,255,0.55);
    margin-bottom: 28px;
    object-fit: unset;
    transform: none;
  }
  .photo-fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 56px;
    background: linear-gradient(to bottom, transparent, var(--bg));
    z-index: 5;
    pointer-events: none;
  }
  .info-stack {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 28px;
    z-index: 7;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .info-box {
    background: linear-gradient(180deg, var(--pill) 0%, var(--pill-dark) 100%);
    border-radius: 10px;
    padding: 8px 11px;
    box-shadow: 0 3px 10px rgba(0,0,0,0.28);
  }
  .info-box.secondary {
    padding: 6px 11px;
  }
  .name {
    font-size: 14px;
    font-weight: 900;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: #fff;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stats {
    margin-top: 3px;
    font-size: 9px;
    font-weight: 600;
    color: rgba(255,255,255,0.96);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .club {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.92);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .brand {
    position: absolute;
    right: 10px;
    bottom: 7px;
    z-index: 8;
    background: linear-gradient(180deg, #fde047 0%, #facc15 100%);
    color: #b91c1c;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: .14em;
    padding: 4px 9px;
    border-radius: 5px;
    border: 1px solid #ca8a04;
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
  }
</style>
</head><body>
<div class="sticker">
  <div class="num-back" aria-hidden="true"><span class="d1">${esc(digit1)}</span><span class="d2">${esc(digit2)}</span></div>
  <div class="wc-badge">⚽<br/>MUNDIAL</div>
  <div class="country-side">
    ${params.teamFlagUrl
      ? `<img class="flag-img" src="${esc(params.teamFlagUrl)}" alt="" crossorigin="anonymous" />`
      : `<span class="flag-dot"></span>`}
    <span class="country-code">${esc(countryLabel)}</span>
  </div>
  <div class="photo-stage">${
    params.photoUrl
      ? `<img class="photo" src="${esc(params.photoUrl)}" alt="" crossorigin="anonymous" />`
      : `<div class="photo placeholder"></div>`
  }</div>
  <div class="photo-fade"></div>
  <div class="info-stack">
    <div class="info-box primary">
      <p class="name">${esc(params.playerName)}</p>
      <p class="stats">${esc(statsLine)}</p>
    </div>
    <div class="info-box secondary">
      <p class="club">${esc(clubLine)}</p>
    </div>
  </div>
  <div class="brand">POLLA</div>
</div>
</body></html>`;

    return this.renderHtmlToImage(html, 300, '.sticker');
  }

  private async renderHtmlToImage(
    html: string,
    width: number,
    clipSelector?: string,
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer-core');

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: this.executablePath ?? undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 600, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      if (clipSelector) {
        const element = await page.$(clipSelector);
        if (element) {
          const buffer = await element.screenshot({ type: 'png' });
          return Buffer.from(buffer);
        }
      }

      const bodyHeight: number = await page.evaluate(
        () => document.body.scrollHeight,
      );
      await page.setViewport({ width, height: bodyHeight, deviceScaleFactor: 2 });

      const buffer = await page.screenshot({ type: 'png', fullPage: true });
      return Buffer.from(buffer);
    } finally {
      await browser.close();
    }
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
