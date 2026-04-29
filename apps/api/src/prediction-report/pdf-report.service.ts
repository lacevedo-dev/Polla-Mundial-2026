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

const OUTCOME_CFG: Record<ResultOutcome, { label: string; bg: string; color: string }> = {
  EXACT_UNIQUE: { label: 'Exacto unico',    bg: '#78350f', color: '#fcd34d' },
  EXACT:        { label: 'Exacto',           bg: '#14532d', color: '#4ade80' },
  WINNER_GOAL:  { label: 'Ganador + Gol',    bg: '#1e3a5f', color: '#60a5fa' },
  WINNER:       { label: 'Ganador',          bg: '#3b2f00', color: '#fbbf24' },
  GOAL:         { label: 'Gol acertado',     bg: '#2e1065', color: '#a78bfa' },
  WRONG:        { label: 'Incorrecto',       bg: '#1e1e1e', color: '#6b7280' },
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

    const sorted = [...params.results].sort((a, b) => b.pointsEarned - a.pointsEarned || a.prevPosition - b.prevPosition);

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

      const sorted = [...league.results].sort((a, b) => b.pointsEarned - a.pointsEarned || a.prevPosition - b.prevPosition);

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
    rect(doc, 0, y, PW, HEADER_H, C.bg);

    // Badge
    const badgeText = 'PARTIDO FINALIZADO';
    const bW = 160; const bH = 17; const bX = (PW - bW) / 2;
    rect(doc, bX, y + 12, bW, bH, C.green);
    cell(doc, badgeText, bX, y + 12, bW, bH, { size: 7, bold: true, color: '#052e16', align: 'center', pad: 0 });

    // Score
    const score = `${match.homeScore}  -  ${match.awayScore}`;
    doc.font('Helvetica-Bold').fontSize(32).fillColor(C.lime)
       .text(score, M, y + 35, { width: CW, align: 'center', lineBreak: false });

    // Teams below score
    const teamsLine = `${match.homeTeam}   vs   ${match.awayTeam}`;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.text)
       .text(teamsLine, M, y + 72, { width: CW, align: 'center', lineBreak: false });

    // Date
    doc.font('Helvetica').fontSize(9).fillColor(C.muted)
       .text(formatDateTime(match.matchDate), M, y + 90, { width: CW, align: 'center', lineBreak: false });

    // Separator
    const homeWon = match.homeScore > match.awayScore;
    const isDraw  = match.homeScore === match.awayScore;
    rect(doc, 0, y + HEADER_H - 2, PW, 2, isDraw ? C.blue : homeWon ? C.green : C.orange);

    return y + HEADER_H;
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

    const stats = [
      { label: 'EXACTO',      value: String(exact),      color: C.green  },
      { label: 'GANAD.+GOL',  value: String(winnerGoal), color: C.blue   },
      { label: 'GANADOR',     value: String(winner),     color: C.amber  },
      { label: 'GOL',         value: String(goal),       color: C.purple },
      { label: 'INCORRECTO',  value: String(wrong),      color: C.muted  },
    ];

    const colW = CW / 5;
    stats.forEach((s, i) => {
      const x = M + i * colW;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(C.subtle)
         .text(s.label, x, y + 8, { width: colW, align: 'center', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(15).fillColor(s.color)
         .text(s.value, x, y + 20, { width: colW, align: 'center', lineBreak: false });
    });

    return y + STATS_H;
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
    { label: 'POS.',        w: 55,  align: 'center' as const },
    { label: 'PARTICIPANTE',w: 160, align: 'left'   as const },
    { label: 'PRONOSTICO',  w: 80,  align: 'center' as const },
    { label: 'RESULTADO',   w: 130, align: 'center' as const },
    { label: 'PTS.',        w: 106, align: 'center' as const },
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

    const movArrow =
      r.newPosition < r.prevPosition ? `#${r.newPosition} +${r.prevPosition - r.newPosition}`
      : r.newPosition > r.prevPosition ? `#${r.newPosition} -${r.newPosition - r.prevPosition}`
      : `#${r.newPosition}`;

    const movColor =
      r.newPosition < r.prevPosition ? '#4ade80'
      : r.newPosition > r.prevPosition ? '#f87171'
      : C.subtle;

    const [w0, w1, w2, w3, w4] = this.RESULT_COLS.map(c => c.w);
    let x = M;

    cell(doc, movArrow, x, y, w0, ROW_H, { color: movColor, bold: true, align: 'center', size: 8 });
    x += w0;

    const nameText = r.isAdmin ? `${r.name} [A]` : r.name;
    cell(doc, nameText, x, y, w1, ROW_H, { bold: true });
    x += w1;

    // Prediction chip
    const chipW = 60; const chipH = ROW_H - 8; const chipX = x + (w2 - chipW) / 2; const chipY = y + 4;
    rect(doc, chipX, chipY, chipW, chipH, C.bgMid);
    cell(doc, `${r.homeScore}-${r.awayScore}`, chipX, chipY, chipW, chipH, {
      size: 9, bold: true, color: C.muted, align: 'center', pad: 2,
    });
    x += w2;

    // Outcome badge
    const bdgW = 120; const bdgH = ROW_H - 8; const bdgX = x + (w3 - bdgW) / 2; const bdgY = y + 4;
    rect(doc, bdgX, bdgY, bdgW, bdgH, cfg.bg);
    cell(doc, cfg.label, bdgX, bdgY, bdgW, bdgH, {
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
