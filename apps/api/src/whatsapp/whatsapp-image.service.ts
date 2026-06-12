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
