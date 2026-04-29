import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PredictorEntry, ReportMatchInfo, ResultEntry, ResultOutcome } from './prediction-report-email.service';

// Portal color palette
const C = {
  bgDark:   '#020617',
  bg:       '#0f172a',
  bgMid:    '#1e293b',
  bgLight:  '#f8fafc',
  bgRow:    '#f1f5f9',
  bgWhite:  '#ffffff',
  lime:     '#a3e635',
  green:    '#4ade80',
  amber:    '#fbbf24',
  blue:     '#60a5fa',
  purple:   '#a78bfa',
  orange:   '#fb923c',
  text:     '#f8fafc',
  textBody: '#0f172a',
  muted:    '#94a3b8',
  subtle:   '#64748b',
  border:   '#e2e8f0',
};

const OUTCOME_CFG: Record<ResultOutcome, { label: string; icon: string; bg: string; color: string }> = {
  EXACT_UNIQUE: { label: 'Exacto unico',  icon: 'EXACTO UNICO',   bg: '#78350f', color: '#fcd34d' },
  EXACT:        { label: 'Exacto',        icon: 'Exacto',         bg: '#14532d', color: '#4ade80' },
  WINNER_GOAL:  { label: 'Ganador + Gol', icon: 'Ganador + Gol',  bg: '#1e3a5f', color: '#60a5fa' },
  WINNER:       { label: 'Ganador',       icon: 'Ganador',        bg: '#3b2f00', color: '#fbbf24' },
  GOAL:         { label: 'Gol acertado',  icon: 'Gol acertado',   bg: '#2e1065', color: '#a78bfa' },
  WRONG:        { label: 'Incorrecto',    icon: 'Incorrecto',     bg: '#1e1e2e', color: '#6b7280' },
};

// A4 dimensions in points
const PW = 595.28;
const PH = 841.89;
const M  = 32;          // margin
const CW = PW - M * 2; // content width

// Row heights
const HEADER_H     = 115;
const STATS_H      = 50;
const LEAGUE_HDR_H = 32;
const TBL_HDR_H    = 22;
const ROW_H        = 24;
const FOOTER_H     = 24;

type Doc = PDFKit.PDFDocument;

function formatDateTime(value: Date): string {
  return value.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day:     '2-digit',
    month:   'long',
    year:    'numeric',
    hour:    '2-digit',
    minute:  '2-digit',
  });
}

function formatShort(value: Date): string {
  return value.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function rect(doc: Doc, x: number, y: number, w: number, h: number, color: string) {
  doc.rect(x, y, w, h).fill(color);
}

function dot(doc: Doc, cx: number, cy: number, r: number, color: string) {
  doc.circle(cx, cy, r).fill(color);
}

function triangle(doc: Doc, cx: number, cy: number, size: number, color: string) {
  const h = size * 0.87;
  doc
    .moveTo(cx, cy - h / 2)
    .lineTo(cx + size / 2, cy + h / 2)
    .lineTo(cx - size / 2, cy + h / 2)
    .closePath()
    .fill(color);
}

function star(doc: Doc, cx: number, cy: number, r: number, color: string) {
  const pts = 5;
  const inner = r * 0.42;
  doc.save();
  for (let i = 0; i < pts * 2; i++) {
    const ang = (Math.PI / pts) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : inner;
    const px  = cx + Math.cos(ang) * rad;
    const py  = cy + Math.sin(ang) * rad;
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  }
  doc.closePath().fill(color);
  doc.restore();
}

function cross(doc: Doc, cx: number, cy: number, size: number, color: string, lineWidth = 1.5) {
  doc.save().strokeColor(color).lineWidth(lineWidth)
    .moveTo(cx - size / 2, cy - size / 2).lineTo(cx + size / 2, cy + size / 2).stroke()
    .moveTo(cx + size / 2, cy - size / 2).lineTo(cx - size / 2, cy + size / 2).stroke();
  doc.restore();
}

function check(doc: Doc, cx: number, cy: number, size: number, color: string, lineWidth = 1.8) {
  doc.save().strokeColor(color).lineWidth(lineWidth)
    .moveTo(cx - size / 2, cy)
    .lineTo(cx - size * 0.1, cy + size * 0.4)
    .lineTo(cx + size / 2, cy - size * 0.4)
    .stroke();
  doc.restore();
}

function outcomeShape(
  doc: Doc,
  outcome: ResultOutcome,
  cx: number,
  cy: number,
  color: string,
) {
  switch (outcome) {
    case 'EXACT_UNIQUE': star(doc, cx, cy, 5.5, color); break;
    case 'EXACT':        dot(doc, cx, cy, 4.5, color);  break;
    case 'WINNER_GOAL':  check(doc, cx, cy, 7, color);  break;
    case 'WINNER':       triangle(doc, cx, cy, 8, color); break;
    case 'GOAL':         dot(doc, cx, cy, 4.5, color);  break;
    case 'WRONG':        cross(doc, cx, cy, 6, color);  break;
  }
}

function cell(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  options: { size?: number; bold?: boolean; color?: string; align?: 'left' | 'center' | 'right'; pad?: number } = {},
) {
  const {
    size  = 9,
    bold  = false,
    color = C.textBody,
    align = 'left',
    pad   = 6,
  } = options;

  doc
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(size)
    .fillColor(color)
    .text(String(text), x + pad, y + (h - size * 1.2) / 2, {
      width:     w - pad * 2,
      align,
      lineBreak: false,
      ellipsis:  true,
    });
}

@Injectable()
export class PdfReportService {

  // ──────────────────────────────────────────────────────────────────────
  //  PREDICTIONS CLOSED REPORT
  // ──────────────────────────────────────────────────────────────────────
  async buildPredictionsReportPdf(params: {
    match: ReportMatchInfo;
    leaguesData: Array<{
      leagueName: string;
      leagueCode: string;
      predictors: PredictorEntry[];
      standings: Map<string, { points: number; position: number }>;
    }>;
    sentAt: Date;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    const done = toBuffer(doc);

    let y = M;

    y = this.drawPredictionsHeader(doc, params.match, y);
    y = this.drawPredictionsStats(doc, params.leaguesData.flatMap(l => l.predictors), y);
    y += 10;

    for (const league of params.leaguesData) {
      y = this.drawLeagueHeader(doc, league.leagueName, league.leagueCode, league.predictors.length, y);
      y = this.drawPredictionCols(doc, y);

      const sorted = [...league.predictors].sort((a, b) => {
        const aPos = league.standings.get(a.userId)?.position ?? 9999;
        const bPos = league.standings.get(b.userId)?.position ?? 9999;
        return aPos !== bPos ? aPos - bPos : a.submittedAt.getTime() - b.submittedAt.getTime();
      });

      for (let i = 0; i < sorted.length; i++) {
        if (y + ROW_H > PH - FOOTER_H - M) {
          doc.addPage();
          y = M;
          y = this.drawPredictionCols(doc, y);
        }
        y = this.drawPredictionRow(doc, sorted[i], i, league.standings, y);
      }

      y += 14;
    }

    this.addFooters(doc, `Pronosticos cerrados · Reporte generado: ${formatShort(params.sentAt)}`);
    doc.end();
    return done;
  }

  // ──────────────────────────────────────────────────────────────────────
  //  RESULTS REPORT
  // ──────────────────────────────────────────────────────────────────────
  async buildResultsReportPdf(params: {
    match: ReportMatchInfo & { homeScore: number; awayScore: number };
    leagueName: string;
    leagueCode: string;
    results: ResultEntry[];
    sentAt: Date;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    const done = toBuffer(doc);

    let y = M;

    y = this.drawResultsHeader(doc, params.match, y);
    y = this.drawResultsStats(doc, params.results, y);
    y += 10;

    y = this.drawLeagueHeader(doc, params.leagueName, params.leagueCode, params.results.length, y);
    y = this.drawResultCols(doc, y);

    const sorted = [...params.results].sort((a, b) => a.newPosition - b.newPosition);

    for (let i = 0; i < sorted.length; i++) {
      if (y + ROW_H > PH - FOOTER_H - M) {
        doc.addPage();
        y = M;
        y = this.drawResultCols(doc, y);
      }
      y = this.drawResultRow(doc, sorted[i], i, y);
    }

    this.addFooters(doc, `Resultado final · Reporte generado: ${formatShort(params.sentAt)}`);
    doc.end();
    return done;
  }

  // ──────────────────────────────────────────────────────────────────────
  //  MULTI-LEAGUE RESULTS REPORT (one PDF for all leagues)
  // ──────────────────────────────────────────────────────────────────────
  async buildMultiLeagueResultsPdf(params: {
    match: ReportMatchInfo & { homeScore: number; awayScore: number };
    leaguesData: Array<{
      leagueName: string;
      leagueCode: string;
      results: ResultEntry[];
    }>;
    sentAt: Date;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    const done = toBuffer(doc);

    let y = M;

    y = this.drawResultsHeader(doc, params.match, y);
    const allResults = params.leaguesData.flatMap(l => l.results);
    y = this.drawResultsStats(doc, allResults, y);
    y += 10;

    for (const league of params.leaguesData) {
      y = this.drawLeagueHeader(doc, league.leagueName, league.leagueCode, league.results.length, y);
      y = this.drawResultCols(doc, y);

      const sorted = [...league.results].sort((a, b) => a.newPosition - b.newPosition);

      for (let i = 0; i < sorted.length; i++) {
        if (y + ROW_H > PH - FOOTER_H - M) {
          doc.addPage();
          y = M;
          y = this.drawResultCols(doc, y);
        }
        y = this.drawResultRow(doc, sorted[i], i, y);
      }

      y += 14;
    }

    this.addFooters(doc, `Resultado final · Reporte generado: ${formatShort(params.sentAt)}`);
    doc.end();
    return done;
  }

  // ──────────────────────────────────────────────────────────────────────
  //  PRIVATE DRAWING HELPERS
  // ──────────────────────────────────────────────────────────────────────

  private drawPredictionsHeader(doc: Doc, match: ReportMatchInfo, y: number): number {
    rect(doc, 0, y, PW, HEADER_H, C.bg);

    // Badge
    const badgeText = 'VENTANA DE PRONOSTICOS CERRADA';
    const bW = 230; const bH = 17; const bX = (PW - bW) / 2;
    rect(doc, bX, y + 12, bW, bH, C.lime);
    cell(doc, badgeText, bX, y + 12, bW, bH, { size: 7, bold: true, color: C.bg, align: 'center', pad: 0 });

    // Match title
    const title = `${match.homeTeam}  vs  ${match.awayTeam}`;
    doc.font('Helvetica-Bold').fontSize(18).fillColor(C.text)
       .text(title, M, y + 37, { width: CW, align: 'center', lineBreak: false });

    // Round
    if (match.round) {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(C.subtle)
         .text(match.round.toUpperCase(), M, y + 62, { width: CW, align: 'center', lineBreak: false });
    }

    // Date + venue
    const dateStr = formatDateTime(match.matchDate);
    const venueStr = match.venue ? `   |   ${match.venue}` : '';
    doc.font('Helvetica').fontSize(9).fillColor(C.muted)
       .text(dateStr + venueStr, M, y + 75, { width: CW, align: 'center', lineBreak: false });

    // Separator line at bottom
    rect(doc, 0, y + HEADER_H - 2, PW, 2, C.lime);

    return y + HEADER_H;
  }

  private drawResultsHeader(
    doc: Doc,
    match: ReportMatchInfo & { homeScore: number; awayScore: number },
    y: number,
  ): number {
    const homeWon = match.homeScore > match.awayScore;
    const isDraw  = match.homeScore === match.awayScore;
    const awayWon = match.awayScore > match.homeScore;

    const FULL_H = HEADER_H + 22; // extra strip for result banner
    rect(doc, 0, y, PW, FULL_H, C.bg);

    // "PARTIDO FINALIZADO" badge
    const bW = 160; const bH = 17; const bX = (PW - bW) / 2;
    rect(doc, bX, y + 10, bW, bH, C.green);
    cell(doc, 'PARTIDO FINALIZADO', bX, y + 10, bW, bH, { size: 7, bold: true, color: '#052e16', align: 'center', pad: 0 });

    // Teams layout: Home | Score | Away
    const colW = CW / 3;
    // Home team
    doc.font('Helvetica-Bold').fontSize(11).fillColor(homeWon ? C.green : C.text)
       .text(match.homeTeam, M, y + 35, { width: colW, align: 'center', lineBreak: false, ellipsis: true });
    doc.font('Helvetica').fontSize(7).fillColor(C.subtle)
       .text('LOCAL', M, y + 51, { width: colW, align: 'center', lineBreak: false });

    // Score (center column)
    const score = `${match.homeScore}  –  ${match.awayScore}`;
    doc.font('Helvetica-Bold').fontSize(28).fillColor(C.lime)
       .text(score, M + colW, y + 32, { width: colW, align: 'center', lineBreak: false });
    const finalBadgeW = 50; const finalBadgeH = 13; const finalBadgeX = M + colW + (colW - finalBadgeW) / 2;
    rect(doc, finalBadgeX, y + 62, finalBadgeW, finalBadgeH, C.bgMid);
    cell(doc, 'FINAL', finalBadgeX, y + 62, finalBadgeW, finalBadgeH, { size: 7, bold: true, color: C.muted, align: 'center', pad: 0 });

    // Away team
    doc.font('Helvetica-Bold').fontSize(11).fillColor(awayWon ? C.orange : C.text)
       .text(match.awayTeam, M + colW * 2, y + 35, { width: colW, align: 'center', lineBreak: false, ellipsis: true });
    doc.font('Helvetica').fontSize(7).fillColor(C.subtle)
       .text('VISITANTE', M + colW * 2, y + 51, { width: colW, align: 'center', lineBreak: false });

    // Date
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text(formatDateTime(match.matchDate), M, y + 84, { width: CW, align: 'center', lineBreak: false });

    // Result banner strip
    const bannerY = y + HEADER_H;
    const bannerColor = isDraw ? '#1e3a5f' : homeWon ? '#14532d' : '#3b1f00';
    const bannerTextColor = isDraw ? C.blue : homeWon ? C.green : C.orange;
    const resultLabel = isDraw ? 'Empate'
      : homeWon ? `Gano ${match.homeTeam}`
      : `Gano ${match.awayTeam}`;
    rect(doc, 0, bannerY, PW, 22, bannerColor);
    cell(doc, resultLabel, 0, bannerY, PW, 22, { size: 9, bold: true, color: bannerTextColor, align: 'center', pad: 0 });

    // Bottom separator line
    const sepColor = isDraw ? C.blue : homeWon ? C.green : C.orange;
    rect(doc, 0, y + FULL_H - 2, PW, 2, sepColor);

    return y + FULL_H;
  }

  private drawPredictionsStats(doc: Doc, predictors: PredictorEntry[], y: number): number {
    rect(doc, 0, y, PW, STATS_H, C.bgMid);

    const total   = predictors.length;
    const homeWin = predictors.filter(p => p.homeScore > p.awayScore).length;
    const draw    = predictors.filter(p => p.homeScore === p.awayScore).length;
    const awayWin = predictors.filter(p => p.awayScore > p.homeScore).length;
    const avgH    = total ? (predictors.reduce((s, p) => s + p.homeScore, 0) / total).toFixed(1) : '-';
    const avgA    = total ? (predictors.reduce((s, p) => s + p.awayScore, 0) / total).toFixed(1) : '-';
    const pct     = (n: number) => total ? `${Math.round((n / total) * 100)}%` : '-';

    const stats = [
      { label: 'LOCAL GANA',  value: pct(homeWin) },
      { label: 'EMPATE',      value: pct(draw)    },
      { label: 'VISITANTE',   value: pct(awayWin) },
      { label: 'PROMEDIO',    value: `${avgH}-${avgA}` },
    ];

    const colW = CW / 4;
    stats.forEach((s, i) => {
      const x = M + i * colW;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(C.subtle)
         .text(s.label, x, y + 8, { width: colW, align: 'center', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(15).fillColor(C.text)
         .text(s.value, x, y + 20, { width: colW, align: 'center', lineBreak: false });
    });

    return y + STATS_H;
  }

  private drawResultsStats(doc: Doc, results: ResultEntry[], y: number): number {
    rect(doc, 0, y, PW, STATS_H, C.bgMid);

    const exact      = results.filter(r => r.outcome === 'EXACT' || r.outcome === 'EXACT_UNIQUE').length;
    const winnerGoal = results.filter(r => r.outcome === 'WINNER_GOAL').length;
    const winner     = results.filter(r => r.outcome === 'WINNER').length;
    const goal       = results.filter(r => r.outcome === 'GOAL').length;
    const wrong      = results.filter(r => r.outcome === 'WRONG').length;

    const stats: Array<{ label: string; value: string; color: string; outcome: ResultOutcome }> = [
      { label: 'EXACTO',      value: String(exact),      color: C.green,  outcome: 'EXACT'       },
      { label: 'GANAD.+GOL',  value: String(winnerGoal), color: C.blue,   outcome: 'WINNER_GOAL' },
      { label: 'GANADOR',     value: String(winner),     color: C.amber,  outcome: 'WINNER'      },
      { label: 'GOL',         value: String(goal),       color: C.purple, outcome: 'GOAL'        },
      { label: 'INCORRECTO',  value: String(wrong),      color: C.muted,  outcome: 'WRONG'       },
    ];

    const colW = CW / 5;
    stats.forEach((s, i) => {
      const x  = M + i * colW;
      const cx = x + colW / 2;
      // Shape icon above label
      outcomeShape(doc, s.outcome, cx, y + 10, s.color);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(C.subtle)
         .text(s.label, x, y + 18, { width: colW, align: 'center', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(15).fillColor(s.color)
         .text(s.value, x, y + 29, { width: colW, align: 'center', lineBreak: false });
    });

    return y + STATS_H + 6;
  }

  private drawLeagueHeader(
    doc: Doc,
    leagueName: string,
    leagueCode: string,
    count: number,
    y: number,
  ): number {
    rect(doc, M, y, CW, LEAGUE_HDR_H, C.bgMid);

    // League name
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.text)
       .text(leagueName, M + 10, y + (LEAGUE_HDR_H - 11) / 2, {
         width: CW * 0.6,
         lineBreak: false,
         ellipsis: true,
       });

    // Code + count badge
    const badge = `${leagueCode}  ·  ${count} registros`;
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text(badge, M + CW * 0.55, y + (LEAGUE_HDR_H - 8) / 2, {
         width: CW * 0.43,
         align: 'right',
         lineBreak: false,
       });

    return y + LEAGUE_HDR_H;
  }

  // Table column definitions for predictions
  private readonly PRED_COLS = [
    { label: 'POS.',          w: 44,  align: 'center' as const },
    { label: 'PARTICIPANTE',  w: 190, align: 'left'   as const },
    { label: 'PRONOSTICO',    w: 100, align: 'center' as const },
    { label: 'PTS. ACUM.',    w: 80,  align: 'center' as const },
    { label: 'HORA',          w: 117, align: 'right'  as const },
  ];

  private drawPredictionCols(doc: Doc, y: number): number {
    rect(doc, M, y, CW, TBL_HDR_H, C.bgLight);
    let x = M;
    for (const col of this.PRED_COLS) {
      cell(doc, col.label, x, y, col.w, TBL_HDR_H, {
        size: 7, bold: true, color: C.muted, align: col.align,
      });
      x += col.w;
    }
    return y + TBL_HDR_H;
  }

  private drawPredictionRow(
    doc: Doc,
    p: PredictorEntry,
    idx: number,
    standings: Map<string, { points: number; position: number }>,
    y: number,
  ): number {
    const standing = standings.get(p.userId);
    const posLabel = standing ? `#${standing.position}` : '-';
    const ptsLabel = standing ? `${standing.points}` : '-';
    const hora     = p.submittedAt.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit',
    });

    rect(doc, M, y, CW, ROW_H, idx % 2 === 0 ? C.bgWhite : C.bgLight);

    const [w0, w1, w2, w3, w4] = this.PRED_COLS.map(c => c.w);
    let x = M;

    cell(doc, posLabel, x, y, w0, ROW_H, { color: C.subtle, bold: true, align: 'center' });
    x += w0;

    const nameText = p.isAdmin ? `${p.name} [A]` : p.name;
    cell(doc, nameText, x, y, w1, ROW_H, { bold: true });
    x += w1;

    // Prediction chip (dark bg)
    const chipW = 70; const chipH = ROW_H - 8; const chipX = x + (w2 - chipW) / 2; const chipY = y + 4;
    rect(doc, chipX, chipY, chipW, chipH, C.bg);
    cell(doc, `${p.homeScore}  -  ${p.awayScore}`, chipX, chipY, chipW, chipH, {
      size: 10, bold: true, color: C.lime, align: 'center', pad: 2,
    });
    x += w2;

    cell(doc, ptsLabel, x, y, w3, ROW_H, { color: C.muted, align: 'center' });
    x += w3;

    cell(doc, hora, x, y, w4, ROW_H, { color: C.muted, align: 'right' });

    return y + ROW_H;
  }

  // Table column definitions for results
  private readonly RESULT_COLS = [
    { label: 'POS.',           w: 60,  align: 'center' as const },
    { label: 'PARTICIPANTE',   w: 155, align: 'left'   as const },
    { label: 'PRONOSTICO',     w: 75,  align: 'center' as const },
    { label: 'RESULTADO',      w: 125, align: 'center' as const },
    { label: 'PTS. PARTIDO',   w: 116, align: 'center' as const },
  ];

  private drawResultCols(doc: Doc, y: number): number {
    rect(doc, M, y, CW, TBL_HDR_H, C.bgLight);
    let x = M;
    for (const col of this.RESULT_COLS) {
      cell(doc, col.label, x, y, col.w, TBL_HDR_H, {
        size: 7, bold: true, color: C.muted, align: col.align,
      });
      x += col.w;
    }
    return y + TBL_HDR_H;
  }

  private drawResultRow(doc: Doc, r: ResultEntry, idx: number, y: number): number {
    rect(doc, M, y, CW, ROW_H, idx % 2 === 0 ? C.bgWhite : C.bgLight);

    const cfg = OUTCOME_CFG[r.outcome];
    const cy  = y + ROW_H / 2;

    const posLabel = `#${r.newPosition}  +${r.totalPoints}`;
    const movColor =
      r.newPosition < r.prevPosition ? '#4ade80'
      : r.newPosition > r.prevPosition ? '#f87171'
      : C.subtle;

    const [w0, w1, w2, w3, w4] = this.RESULT_COLS.map(c => c.w);
    let x = M;

    // POS column: shape indicator on left edge + text
    outcomeShape(doc, r.outcome, x + 8, cy, movColor);
    cell(doc, posLabel, x + 12, y, w0 - 12, ROW_H, { color: movColor, bold: true, align: 'center', size: 8 });
    x += w0;

    const nameText = r.isAdmin ? `${r.name} [A]` : r.name;
    cell(doc, nameText, x, y, w1, ROW_H, { bold: true });
    x += w1;

    // Prediction chip (dark bg)
    const chipW = 58; const chipH = ROW_H - 8; const chipX = x + (w2 - chipW) / 2; const chipY = y + 4;
    rect(doc, chipX, chipY, chipW, chipH, C.bgMid);
    cell(doc, `${r.homeScore}-${r.awayScore}`, chipX, chipY, chipW, chipH, {
      size: 9, bold: true, color: C.lime, align: 'center', pad: 2,
    });
    x += w2;

    // Outcome badge: colored bg + small shape icon + label
    const bdgW = 118; const bdgH = ROW_H - 8; const bdgX = x + (w3 - bdgW) / 2; const bdgY = y + 4;
    rect(doc, bdgX, bdgY, bdgW, bdgH, cfg.bg);
    outcomeShape(doc, r.outcome, bdgX + 10, bdgY + bdgH / 2, cfg.color);
    cell(doc, cfg.label, bdgX + 14, bdgY, bdgW - 14, bdgH, {
      size: 8, bold: true, color: cfg.color, align: 'center', pad: 2,
    });
    x += w3;

    const ptsText = r.pointsEarned > 0 ? `+${r.pointsEarned} pts` : '0 pts';
    cell(doc, ptsText, x, y, w4, ROW_H, {
      size: 10, bold: true, color: r.pointsEarned > 0 ? C.lime : C.muted, align: 'center',
    });

    return y + ROW_H;
  }

  private addFooters(doc: PDFKit.PDFDocument, footerText: string) {
    const range = doc.bufferedPageRange();
    const total = range.count;

    for (let i = 0; i < total; i++) {
      doc.switchToPage(range.start + i);
      rect(doc, 0, PH - FOOTER_H, PW, FOOTER_H, C.bg);
      doc.font('Helvetica').fontSize(7).fillColor(C.subtle)
         .text(
           `${footerText}   ·   Pagina ${i + 1} de ${total}   ·   Polla Mundial 2026`,
           M,
           PH - FOOTER_H + (FOOTER_H - 7) / 2,
           { width: CW, align: 'center', lineBreak: false },
         );
    }
  }
}
