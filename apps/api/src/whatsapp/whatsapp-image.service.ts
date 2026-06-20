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
    const bgAccent = params.themeAccent ?? '#ef4444';
    const pillFrom = params.themePillFrom ?? '#ea580c';
    const pillTo = params.themePillTo ?? '#dc2626';
    const clubLine = params.assistName
      ? `<p class="club">Asist. ${esc(params.assistName)}</p>`
      : `<p class="club">${esc(params.teamName)} · ${esc(params.leagueName)}</p>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; width: 300px; }
  .sticker {
    position: relative;
    width: 300px;
    height: 420px;
    overflow: hidden;
    border-radius: 14px;
    background: linear-gradient(165deg, ${esc(bgPrimary)} 0%, ${esc(bgPrimary)}dd 45%, ${esc(bgPrimary)}bb 100%);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  .num-back {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 18px;
    font-size: 168px;
    font-weight: 900;
    line-height: 0.82;
    letter-spacing: -8px;
    pointer-events: none;
    user-select: none;
  }
  .num-back .d1 { color: ${esc(bgSecondary)}; text-shadow: 3px 3px 0 ${esc(pillFrom)}; }
  .num-back .d2 { color: ${esc(bgAccent)}; text-shadow: 3px 3px 0 ${esc(pillTo)}; margin-left: -6px; }
  .wc-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 4;
    background: rgba(255,255,255,0.92);
    border-radius: 8px;
    padding: 4px 7px;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: .08em;
    color: #1e3a8a;
    text-align: center;
    line-height: 1.2;
  }
  .country-side {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-42%);
    z-index: 4;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .flag-img, .flag-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid #fff;
    object-fit: cover;
    background: #fff;
  }
  .flag-dot { background: linear-gradient(180deg, #fde047, #2563eb 50%, #dc2626); }
  .country-code {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    font-size: 28px;
    font-weight: 900;
    letter-spacing: .06em;
    color: #fff;
    text-shadow: 0 2px 0 rgba(0,0,0,0.25), 0 0 8px rgba(0,0,0,0.15);
  }
  .photo-wrap {
    position: absolute;
    left: 50%;
    top: 52%;
    transform: translate(-50%, -50%);
    z-index: 3;
    width: 220px;
    height: 250px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .photo {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    object-position: bottom center;
    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.35));
  }
  .photo.placeholder {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: rgba(255,255,255,0.25);
    border: 3px solid rgba(255,255,255,0.5);
    margin-bottom: 20px;
  }
  .info-pill {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 36px;
    z-index: 5;
    background: linear-gradient(90deg, ${esc(pillFrom)} 0%, ${esc(pillTo)} 100%);
    border-radius: 12px;
    padding: 10px 12px 9px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  }
  .name {
    font-size: 15px;
    font-weight: 900;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: #fff;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stats {
    margin-top: 4px;
    font-size: 9px;
    font-weight: 600;
    color: rgba(255,255,255,0.95);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .club {
    margin-top: 3px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .brand {
    position: absolute;
    right: 10px;
    bottom: 8px;
    z-index: 6;
    background: #facc15;
    color: #b91c1c;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: .12em;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid #ca8a04;
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
  <div class="photo-wrap">${
    params.photoUrl
      ? `<img class="photo" src="${esc(params.photoUrl)}" alt="" crossorigin="anonymous" />`
      : `<div class="photo placeholder"></div>`
  }</div>
  <div class="info-pill">
    <p class="name">${esc(params.playerName)}</p>
    <p class="stats">${esc(statsLine)}</p>
    ${clubLine}
  </div>
  <div class="brand">POLLA</div>
</div>
</body></html>`;

    return this.renderHtmlToImage(html, 300);
  }

  private async renderHtmlToImage(html: string, width: number): Promise<Buffer> {
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

      // Shrink viewport to actual content height
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
