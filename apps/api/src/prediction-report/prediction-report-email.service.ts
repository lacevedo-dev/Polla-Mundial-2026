import { Injectable, Logger } from '@nestjs/common';
import { EmailJobPriority, EmailJobType } from '@prisma/client';
import { EmailQueueService } from '../email/email-queue.service';
import { PdfReportService } from './pdf-report.service';

export interface PredictorEntry {
  userId: string;
  name: string;
  email?: string;
  isAdmin: boolean;
  homeScore: number;
  awayScore: number;
  submittedAt: Date;
}

export interface ReportMatchInfo {
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  venue?: string;
  round?: string;
}

export interface SendReportParams {
  recipients: string[];
  leagueName: string;
  leagueCode: string;
  leagueId?: string;
  matchId?: string;
  match: ReportMatchInfo;
  predictors: PredictorEntry[];
  standings: Map<string, { points: number; position: number }>;
  sentAt: Date;
}

export type ResultOutcome = 'EXACT_UNIQUE' | 'EXACT' | 'WINNER_GOAL' | 'WINNER' | 'GOAL' | 'WRONG';

export interface ResultEntry extends PredictorEntry {
  outcome: ResultOutcome;
  pointsEarned: number;
  totalPoints: number;
  newPosition: number;
  prevPosition: number;
}

export interface SendResultParams {
  recipients: string[];
  leagueName: string;
  leagueCode: string;
  leagueId?: string;
  matchId?: string;
  match: ReportMatchInfo & { homeScore: number; awayScore: number };
  results: ResultEntry[];
  sentAt: Date;
}

@Injectable()
export class PredictionReportEmailService {
  private readonly logger = new Logger(PredictionReportEmailService.name);

  constructor(
    private readonly emailQueue: EmailQueueService,
    private readonly pdfReport: PdfReportService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────
  //  MULTI-LEAGUE PREDICTIONS CLOSED REPORT
  // ──────────────────────────────────────────────────────────────────────
  async sendMultiLeaguePredictionsReport(params: {
    matchId: string;
    match: ReportMatchInfo;
    leaguesData: Array<{
      leagueId: string;
      leagueName: string;
      leagueCode: string;
      predictors: PredictorEntry[];
      standings: Map<string, { points: number; position: number }>;
    }>;
    sentAt: Date;
  }): Promise<void> {
    if (!this.emailQueue) return;

    // Build unique recipient list
    const uniqueRecipients = new Set<string>();
    for (const league of params.leaguesData) {
      for (const p of league.predictors) {
        if (p.email) uniqueRecipients.add(p.email.toLowerCase());
      }
    }

    // Generate PDF once (same for all recipients)
    const pdfBuffer = await this.pdfReport.buildPredictionsReportPdf({
      match:      params.match,
      leaguesData: params.leaguesData,
      sentAt:     params.sentAt,
    });

    const totalPredictors = params.leaguesData.reduce((s, l) => s + l.predictors.length, 0);
    const html = this.buildMultiLeaguePredictionsHtml(params.match, params.leaguesData, params.sentAt, totalPredictors);
    const text = this.buildMultiLeaguePredictionsText(params.match, params.leaguesData, params.sentAt);
    const subject = `🔒 Predicciones cerradas: ${params.match.homeTeam} vs ${params.match.awayTeam}`;
    const pdfFilename = `pronosticos_${slug(params.match.homeTeam)}_${slug(params.match.awayTeam)}.pdf`;

    const queued = await this.emailQueue.enqueueEmails(
      [...uniqueRecipients].map((recipient) => ({
        type:          EmailJobType.PREDICTIONS_REPORT,
        priority:      EmailJobPriority.MEDIUM,
        required:      false,
        recipientEmail: recipient,
        subject,
        html,
        text,
        matchId:       params.matchId,
        dedupeKey:     ['predictions-report-multi', params.matchId, recipient].join(':'),
        attachments: [{
          filename:      pdfFilename,
          contentBase64: pdfBuffer.toString('base64'),
          contentType:   'application/pdf',
        }],
      })),
    );

    this.logger.log(
      `Queued multi-league predictions report: ${queued.queued}/${uniqueRecipients.size} recipients (PDF: ${Math.round(pdfBuffer.length / 1024)} KB)`,
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  //  SINGLE-LEAGUE PREDICTIONS CLOSED REPORT
  // ──────────────────────────────────────────────────────────────────────
  async sendPredictionsReport(params: SendReportParams): Promise<void> {
    if (!this.emailQueue) return;

    const pdfBuffer = await this.pdfReport.buildPredictionsReportPdf({
      match:      params.match,
      leaguesData: [{
        leagueName: params.leagueName,
        leagueCode: params.leagueCode,
        predictors: params.predictors,
        standings:  params.standings,
      }],
      sentAt: params.sentAt,
    });

    const html = this.buildHtml(params);
    const text = this.buildPlainText(params);
    const subject = `🔒 Predicciones cerradas: ${params.match.homeTeam} vs ${params.match.awayTeam} | ${params.leagueName}`;
    const pdfFilename = `pronosticos_${slug(params.match.homeTeam)}_${slug(params.match.awayTeam)}.pdf`;

    const queued = await this.emailQueue.enqueueEmails(
      params.recipients.map((recipient) => ({
        type:          EmailJobType.PREDICTIONS_REPORT,
        priority:      EmailJobPriority.MEDIUM,
        required:      false,
        recipientEmail: recipient,
        subject,
        html,
        text,
        matchId:   params.matchId,
        leagueId:  params.leagueId,
        dedupeKey: [
          'predictions-report',
          params.matchId ?? `${params.match.homeTeam}-${params.match.awayTeam}-${params.match.matchDate.toISOString()}`,
          params.leagueId ?? params.leagueCode,
          recipient.toLowerCase(),
        ].join(':'),
        attachments: [{
          filename:      pdfFilename,
          contentBase64: pdfBuffer.toString('base64'),
          contentType:   'application/pdf',
        }],
      })),
    );

    this.logger.log(
      `Queued predictions report: ${queued.queued}/${params.recipients.length} recipients (PDF: ${Math.round(pdfBuffer.length / 1024)} KB)`,
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  //  MULTI-LEAGUE RESULTS REPORT (un solo correo agrupado por partido)
  // ──────────────────────────────────────────────────────────────────────
  async sendMultiLeagueResultsReport(params: {
    matchId: string;
    match: ReportMatchInfo & { homeScore: number; awayScore: number };
    leaguesData: Array<{
      leagueId: string;
      leagueName: string;
      leagueCode: string;
      results: ResultEntry[];
    }>;
    sentAt: Date;
  }): Promise<void> {
    // Recopilar destinatarios únicos a través de todas las ligas
    const recipientLeagueMap = new Map<string, { leagueId: string; leagueName: string }>();
    for (const league of params.leaguesData) {
      for (const r of league.results) {
        const pred = r as any;
        if (pred.email && !recipientLeagueMap.has(pred.email.toLowerCase())) {
          recipientLeagueMap.set(pred.email.toLowerCase(), {
            leagueId:   league.leagueId,
            leagueName: league.leagueName,
          });
        }
      }
    }

    // Construir destinatarios desde las ligas vía audience
    const uniqueRecipients = new Set<string>();
    for (const league of params.leaguesData) {
      for (const r of league.results) {
        const pred = r as any;
        if (pred.email) uniqueRecipients.add(pred.email.toLowerCase());
      }
    }

    // Generar PDF multi-liga una sola vez
    const pdfBuffer = await this.pdfReport.buildMultiLeagueResultsPdf({
      match:      params.match,
      leaguesData: params.leaguesData,
      sentAt:     params.sentAt,
    });

    const allResults = params.leaguesData.flatMap(l => l.results);
    const html = this.buildMultiLeagueResultsHtml(params.match, params.leaguesData, params.sentAt, allResults);
    const text = this.buildMultiLeagueResultsText(params.match, params.leaguesData, params.sentAt);
    const subject = `✅ Resultado final: ${params.match.homeTeam} ${params.match.homeScore}-${params.match.awayScore} ${params.match.awayTeam}`;
    const pdfFilename = `resultado_${slug(params.match.homeTeam)}_${slug(params.match.awayTeam)}.pdf`;

    const recipients = [...uniqueRecipients];
    const queued = await this.emailQueue.enqueueEmails(
      recipients.map((recipient) => ({
        type:           EmailJobType.MATCH_RESULTS_REPORT,
        priority:       EmailJobPriority.LOW,
        required:       false,
        recipientEmail: recipient,
        subject,
        html,
        text,
        matchId:   params.matchId,
        dedupeKey: ['match-results-report-multi', params.matchId, recipient].join(':'),
        attachments: [{
          filename:      pdfFilename,
          contentBase64: pdfBuffer.toString('base64'),
          contentType:   'application/pdf',
        }],
      })),
    );

    this.logger.log(
      `Queued multi-league results report: ${queued.queued}/${recipients.length} recipients (${params.leaguesData.length} polla(s), PDF: ${Math.round(pdfBuffer.length / 1024)} KB)`,
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  //  RESULTS REPORT (single league — kept for manual/preview use)
  // ──────────────────────────────────────────────────────────────────────
  async sendResultsReport(params: SendResultParams): Promise<void> {
    const pdfBuffer = await this.pdfReport.buildResultsReportPdf({
      match:       params.match,
      leagueName:  params.leagueName,
      leagueCode:  params.leagueCode,
      results:     params.results,
      sentAt:      params.sentAt,
    });

    const html = this.buildResultHtml(params);
    const text = this.buildResultPlainText(params);
    const subject = `✅ Resultado final: ${params.match.homeTeam} ${params.match.homeScore}-${params.match.awayScore} ${params.match.awayTeam} | ${params.leagueName}`;
    const pdfFilename = `resultado_${slug(params.match.homeTeam)}_${slug(params.match.awayTeam)}.pdf`;

    const queued = await this.emailQueue.enqueueEmails(
      params.recipients.map((recipient) => ({
        type:          EmailJobType.MATCH_RESULTS_REPORT,
        priority:      EmailJobPriority.LOW,
        required:      false,
        recipientEmail: recipient,
        subject,
        html,
        text,
        matchId:   params.matchId,
        leagueId:  params.leagueId,
        dedupeKey: [
          'match-results-report',
          params.matchId ?? `${params.match.homeTeam}-${params.match.awayTeam}-${params.match.matchDate.toISOString()}`,
          params.leagueId ?? params.leagueCode,
          recipient.toLowerCase(),
        ].join(':'),
        attachments: [{
          filename:      pdfFilename,
          contentBase64: pdfBuffer.toString('base64'),
          contentType:   'application/pdf',
        }],
      })),
    );

    this.logger.log(
      `Queued results report: ${queued.queued}/${params.recipients.length} recipients (PDF: ${Math.round(pdfBuffer.length / 1024)} KB)`,
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  //  HTML BUILDERS (compact — body is a summary; full data is in the PDF)
  // ──────────────────────────────────────────────────────────────────────

  buildHtml(params: Omit<SendReportParams, 'recipients'>): string {
    const { leagueName, leagueCode, match, predictors, standings, sentAt } = params;

    const totalPredictors = predictors.length;
    const homeWinVotes    = predictors.filter(p => p.homeScore > p.awayScore).length;
    const awayWinVotes    = predictors.filter(p => p.awayScore > p.homeScore).length;
    const drawVotes       = predictors.filter(p => p.homeScore === p.awayScore).length;
    const avgHome = totalPredictors ? (predictors.reduce((s, p) => s + p.homeScore, 0) / totalPredictors).toFixed(1) : '—';
    const avgAway = totalPredictors ? (predictors.reduce((s, p) => s + p.awayScore, 0) / totalPredictors).toFixed(1) : '—';
    const pct = (n: number) => totalPredictors ? Math.round((n / totalPredictors) * 100) : 0;

    const sorted = [...predictors].sort((a, b) => {
      const aPos = standings.get(a.userId)?.position ?? 9999;
      const bPos = standings.get(b.userId)?.position ?? 9999;
      return aPos !== bPos ? aPos - bPos : a.submittedAt.getTime() - b.submittedAt.getTime();
    });

    const top3  = sorted.slice(0, 3);
    const extra = Math.max(0, sorted.length - 3);

    const top3Rows = top3.map((p, i) => {
      const standing = standings.get(p.userId);
      return podiumRow(p.name, p.homeScore, p.awayScore, standing?.points, i);
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pronósticos cerrados — ${escHtml(match.homeTeam)} vs ${escHtml(match.awayTeam)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:620px;margin:32px auto;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.15)">

  ${headerBlock(match, leagueName, leagueCode, '🔒 Ventana de Pronósticos Cerrada', '#020617', '#0f172a', '#1e1b4b')}

  ${matchCard(match)}

  ${statsBar([
    { label: '🏠 Local gana',    value: `${pct(homeWinVotes)}%` },
    { label: '🤝 Empate',        value: `${pct(drawVotes)}%`    },
    { label: '✈️ Visitante gana', value: `${pct(awayWinVotes)}%` },
    { label: '⚽ Promedio',       value: `${avgHome}–${avgAway}` },
  ])}

  <!-- SUMMARY SECTION -->
  <div style="background:#fff;padding:0">
    <div style="padding:20px 24px 14px;border-bottom:1px solid #f1f5f9">
      <h2 style="margin:0;font-size:15px;font-weight:800;color:#0f172a">
        📋 Pronósticos registrados
        <span style="font-size:13px;font-weight:600;color:#64748b;margin-left:8px">(${totalPredictors})</span>
      </h2>
      <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">
        Todos los pronósticos son definitivos. La ventana de ingreso está cerrada.
      </p>
    </div>

    ${totalPredictors > 0 ? `
    <div style="padding:16px 24px 8px">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#64748b;letter-spacing:.08em;text-transform:uppercase">
        Top 3 actual
      </p>
      ${top3Rows}
      ${extra > 0 ? `<p style="margin:10px 0 0;font-size:12px;color:#94a3b8;text-align:center">
        + ${extra} participante${extra > 1 ? 's' : ''} más — ver reporte adjunto
      </p>` : ''}
    </div>` : `
    <div style="padding:40px;text-align:center;color:#94a3b8">
      <p style="font-size:32px;margin:0">📭</p>
      <p style="margin:8px 0 0;font-size:14px">Ningún participante ingresó pronóstico para este partido.</p>
    </div>`}

    ${pdfBanner(totalPredictors)}
  </div>

  ${footerBlock(sentAt, leagueName)}

</div>
</body>
</html>`;
  }

  private buildMultiLeaguePredictionsHtml(
    match: ReportMatchInfo,
    leaguesData: Array<{
      leagueId: string;
      leagueName: string;
      leagueCode: string;
      predictors: PredictorEntry[];
      standings: Map<string, { points: number; position: number }>;
    }>,
    sentAt: Date,
    totalPredictors: number,
  ): string {
    const allPredictors = leaguesData.flatMap(l => l.predictors);
    const homeWinVotes  = allPredictors.filter(p => p.homeScore > p.awayScore).length;
    const awayWinVotes  = allPredictors.filter(p => p.awayScore > p.homeScore).length;
    const drawVotes     = allPredictors.filter(p => p.homeScore === p.awayScore).length;
    const avgHome = totalPredictors ? (allPredictors.reduce((s, p) => s + p.homeScore, 0) / totalPredictors).toFixed(1) : '—';
    const avgAway = totalPredictors ? (allPredictors.reduce((s, p) => s + p.awayScore, 0) / totalPredictors).toFixed(1) : '—';
    const pct = (n: number) => totalPredictors ? Math.round((n / totalPredictors) * 100) : 0;

    const leagueSummaries = leaguesData.map(ld => {
      const sorted = [...ld.predictors].sort((a, b) => {
        const aPos = ld.standings.get(a.userId)?.position ?? 9999;
        const bPos = ld.standings.get(b.userId)?.position ?? 9999;
        return aPos !== bPos ? aPos - bPos : a.submittedAt.getTime() - b.submittedAt.getTime();
      });
      const top3  = sorted.slice(0, 3);
      const extra = Math.max(0, sorted.length - 3);

      return `
      <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #f1f5f9">
        <div style="display:table;width:100%;margin-bottom:10px">
          <div style="display:table-cell;vertical-align:middle">
            <h3 style="margin:0;font-size:13px;font-weight:800;color:#0f172a">${escHtml(ld.leagueName)}</h3>
            <span style="font-size:11px;color:#64748b">${escHtml(ld.leagueCode)}</span>
          </div>
          <div style="display:table-cell;vertical-align:middle;text-align:right">
            <span style="background:#1e293b;color:#94a3b8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">${ld.predictors.length} pronósticos</span>
          </div>
        </div>
        ${top3.map((p, i) => podiumRow(p.name, p.homeScore, p.awayScore, ld.standings.get(p.userId)?.points, i)).join('')}
        ${extra > 0 ? `<p style="margin:8px 0 0;font-size:11px;color:#94a3b8;text-align:center">+ ${extra} más en el PDF adjunto</p>` : ''}
      </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Predicciones cerradas — ${escHtml(match.homeTeam)} vs ${escHtml(match.awayTeam)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:620px;margin:32px auto;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.15)">

  ${headerBlock(match, undefined, undefined, '🔒 Ventana de Pronósticos Cerrada', '#020617', '#0f172a', '#1e1b4b')}

  ${matchCard(match)}

  ${statsBar([
    { label: '🏠 Local gana',    value: `${pct(homeWinVotes)}%` },
    { label: '🤝 Empate',        value: `${pct(drawVotes)}%`    },
    { label: '✈️ Visitante gana', value: `${pct(awayWinVotes)}%` },
    { label: '⚽ Promedio',       value: `${avgHome}–${avgAway}` },
  ])}

  <!-- SUMMARY SECTION -->
  <div style="background:#fff;padding:0">
    <div style="padding:20px 24px 14px;border-bottom:1px solid #f1f5f9">
      <h2 style="margin:0;font-size:15px;font-weight:800;color:#0f172a">
        📋 Pronósticos registrados
        <span style="font-size:13px;font-weight:600;color:#64748b;margin-left:8px">(${totalPredictors})</span>
      </h2>
      <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">
        Participás en ${leaguesData.length} polla${leaguesData.length > 1 ? 's' : ''}. Todos los pronósticos son definitivos.
      </p>
    </div>
    <div style="padding:16px 24px 8px">
      ${leagueSummaries}
    </div>
    ${pdfBanner(totalPredictors)}
  </div>

  ${footerBlock(sentAt, undefined)}

</div>
</body>
</html>`;
  }

  buildResultHtml(params: Omit<SendResultParams, 'recipients'>): string {
    const { leagueName, leagueCode, match, results, sentAt } = params;

    const OUTCOME_ICON: Record<ResultOutcome, string> = {
      EXACT_UNIQUE: '👑',
      EXACT:        '🎯',
      WINNER_GOAL:  '✅',
      WINNER:       '👍',
      GOAL:         '⚽',
      WRONG:        '❌',
    };

    const exactCount      = results.filter(r => r.outcome === 'EXACT' || r.outcome === 'EXACT_UNIQUE').length;
    const winnerGoalCount = results.filter(r => r.outcome === 'WINNER_GOAL').length;
    const winnerCount     = results.filter(r => r.outcome === 'WINNER').length;
    const goalCount       = results.filter(r => r.outcome === 'GOAL').length;
    const wrongCount      = results.filter(r => r.outcome === 'WRONG').length;

    const sorted   = [...results].sort((a, b) => b.pointsEarned - a.pointsEarned || a.prevPosition - b.prevPosition);
    const top3     = sorted.slice(0, 3);
    const extra    = Math.max(0, sorted.length - 3);
    const topScorer = sorted[0];

    const homeWon  = match.homeScore > match.awayScore;
    const awayWon  = match.awayScore > match.homeScore;
    const isDraw   = match.homeScore === match.awayScore;
    const resultLabel = homeWon ? `Ganó ${escHtml(match.homeTeam)}`
                      : awayWon ? `Ganó ${escHtml(match.awayTeam)}`
                      : 'Empate';

    const top3Rows = top3.map((r, i) => {
      const cfg = OUTCOME_ICON[r.outcome];
      const pts = r.pointsEarned > 0 ? `+${r.pointsEarned} pts` : '0 pts';
      const medal = ['🥇', '🥈', '🥉'][i];
      return `
      <div style="display:table;width:100%;margin-bottom:6px;background:${i % 2 === 0 ? '#f8fafc' : '#fff'};border-radius:10px;padding:2px 0">
        <div style="display:table-cell;width:28px;vertical-align:middle;text-align:center;font-size:16px">${medal}</div>
        <div style="display:table-cell;vertical-align:middle;font-size:13px;font-weight:600;color:#0f172a;padding-left:4px">${escHtml(r.name)}</div>
        <div style="display:table-cell;width:38px;text-align:center;vertical-align:middle;font-size:13px">${cfg}</div>
        <div style="display:table-cell;width:70px;text-align:right;vertical-align:middle">
          <span style="font-size:13px;font-weight:800;color:#a3e635">${pts}</span>
        </div>
      </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Resultados — ${escHtml(match.homeTeam)} ${match.homeScore}-${match.awayScore} ${escHtml(match.awayTeam)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:640px;margin:32px auto;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.15)">

  ${headerBlock(match, leagueName, leagueCode, '⚽ Partido Finalizado', '#020617', '#0f172a', '#14532d', '#4ade80', '#052e16')}

  <!-- SCORE CARD -->
  <div style="background:#0f172a;padding:32px 28px 24px">
    ${match.round ? `<p style="margin:0 0 12px;text-align:center;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">${escHtml(match.round)}</p>` : ''}
    <div style="display:table;width:100%;table-layout:fixed">
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:35%">
        <div style="font-size:26px;font-weight:900;color:#f8fafc;line-height:1.1">${escHtml(match.homeTeam)}</div>
        <div style="font-size:10px;color:#475569;margin-top:4px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Local</div>
      </div>
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:30%">
        <div style="font-size:50px;font-weight:900;color:#a3e635;font-family:monospace;letter-spacing:-.02em;line-height:1">
          ${match.homeScore}<span style="color:#334155;font-size:30px;margin:0 4px">–</span>${match.awayScore}
        </div>
        <div style="margin-top:8px;display:inline-block;background:#1e293b;color:#94a3b8;font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;letter-spacing:.06em">FINAL</div>
      </div>
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:35%">
        <div style="font-size:26px;font-weight:900;color:#f8fafc;line-height:1.1">${escHtml(match.awayTeam)}</div>
        <div style="font-size:10px;color:#475569;margin-top:4px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Visitante</div>
      </div>
    </div>
    <div style="margin-top:16px;text-align:center;border-top:1px solid #1e293b;padding-top:14px">
      <span style="color:#64748b;font-size:13px">📅 ${formatDateTime(match.matchDate)}</span>
    </div>
  </div>

  <!-- RESULT BANNER -->
  <div style="background:${isDraw ? '#1e3a5f' : homeWon ? '#14532d' : '#3b1f00'};padding:12px 28px;text-align:center">
    <span style="color:${isDraw ? '#60a5fa' : homeWon ? '#4ade80' : '#fb923c'};font-size:15px;font-weight:800;letter-spacing:.04em">
      ${isDraw ? '🤝' : '🏆'} ${resultLabel}
    </span>
  </div>

  <!-- STATS STRIP -->
  <div style="background:#1e293b;padding:14px 28px;display:table;width:100%;box-sizing:border-box">
    ${resultStatCell('🎯 Exacto',      exactCount,      '#4ade80')}
    ${resultStatCell('✅ Gan+Gol',     winnerGoalCount, '#60a5fa')}
    ${resultStatCell('👍 Ganador',     winnerCount,     '#fbbf24')}
    ${resultStatCell('⚽ Gol',          goalCount,       '#a78bfa')}
    ${resultStatCell('❌ Incorrecto',  wrongCount,      '#6b7280')}
  </div>

  ${topScorer && topScorer.pointsEarned > 0 ? `
  <div style="background:#0f172a;border-top:2px solid #a3e635;padding:14px 28px;text-align:center">
    <span style="color:#94a3b8;font-size:12px">⭐ Mejor de este partido · </span>
    <strong style="color:#a3e635;font-size:15px">${escHtml(topScorer.name)}</strong>
    <span style="color:#64748b;font-size:12px"> · +${topScorer.pointsEarned} pts</span>
  </div>` : ''}

  <!-- SUMMARY SECTION -->
  <div style="background:#fff;padding:0">
    <div style="padding:20px 24px 14px;border-bottom:1px solid #f1f5f9">
      <h2 style="margin:0;font-size:15px;font-weight:800;color:#0f172a">
        📊 Mejores de este partido
        <span style="font-size:13px;font-weight:600;color:#64748b;margin-left:8px">(${results.length} participantes)</span>
      </h2>
      <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">
        Los puntos ya fueron acreditados en el ranking de ${escHtml(leagueName)}.
      </p>
    </div>
    <div style="padding:16px 24px 8px">
      ${top3Rows}
      ${extra > 0 ? `<p style="margin:10px 0 0;font-size:12px;color:#94a3b8;text-align:center">
        + ${extra} participante${extra > 1 ? 's' : ''} más — ver reporte adjunto
      </p>` : ''}
    </div>
    ${pdfBanner(results.length, true)}
  </div>

  <!-- FOOTER -->
  <div style="background:#0f172a;padding:20px 28px;text-align:center">
    <p style="margin:0 0 6px;font-size:11px;color:#475569">
      📬 Reporte automático de resultados · ${formatShortDateTime(sentAt)} (hora Colombia)
    </p>
    <p style="margin:0;font-size:11px;color:#334155">
      Los puntos ya fueron acreditados en el ranking de <strong style="color:#64748b">${escHtml(leagueName)}</strong>.
    </p>
    <div style="margin-top:14px">
      <span style="font-size:10px;color:#1e293b;letter-spacing:.1em;font-weight:700;text-transform:uppercase">Polla Mundial 2026</span>
    </div>
  </div>

</div>
</body>
</html>`;
  }

  // ──────────────────────────────────────────────────────────────────────
  //  MULTI-LEAGUE RESULTS HTML
  // ──────────────────────────────────────────────────────────────────────
  private buildMultiLeagueResultsHtml(
    match: ReportMatchInfo & { homeScore: number; awayScore: number },
    leaguesData: Array<{
      leagueId: string;
      leagueName: string;
      leagueCode: string;
      results: ResultEntry[];
    }>,
    sentAt: Date,
    allResults: ResultEntry[],
  ): string {
    const OUTCOME_ICON: Record<ResultOutcome, string> = {
      EXACT_UNIQUE: '👑',
      EXACT:        '🎯',
      WINNER_GOAL:  '✅',
      WINNER:       '👍',
      GOAL:         '⚽',
      WRONG:        '❌',
    };
    const OUTCOME_COLOR: Record<ResultOutcome, string> = {
      EXACT_UNIQUE: '#fcd34d',
      EXACT:        '#4ade80',
      WINNER_GOAL:  '#60a5fa',
      WINNER:       '#fbbf24',
      GOAL:         '#a78bfa',
      WRONG:        '#6b7280',
    };
    const OUTCOME_BG: Record<ResultOutcome, string> = {
      EXACT_UNIQUE: '#78350f',
      EXACT:        '#14532d',
      WINNER_GOAL:  '#1e3a5f',
      WINNER:       '#3b2f00',
      GOAL:         '#2e1065',
      WRONG:        '#1e1e2e',
    };

    const homeWon  = match.homeScore > match.awayScore;
    const awayWon  = match.awayScore > match.homeScore;
    const isDraw   = match.homeScore === match.awayScore;
    const resultLabel = homeWon ? `Ganó ${escHtml(match.homeTeam)}`
                      : awayWon ? `Ganó ${escHtml(match.awayTeam)}`
                      : 'Empate';

    const exactCount      = allResults.filter(r => r.outcome === 'EXACT' || r.outcome === 'EXACT_UNIQUE').length;
    const winnerGoalCount = allResults.filter(r => r.outcome === 'WINNER_GOAL').length;
    const winnerCount     = allResults.filter(r => r.outcome === 'WINNER').length;
    const goalCount       = allResults.filter(r => r.outcome === 'GOAL').length;
    const wrongCount      = allResults.filter(r => r.outcome === 'WRONG').length;
    const topScorer       = [...allResults].sort((a, b) => b.pointsEarned - a.pointsEarned)[0];
    const totalParticipants = allResults.length;

    const leagueSummaries = leaguesData.map(ld => {
      const sorted = [...ld.results].sort((a, b) => b.pointsEarned - a.pointsEarned || a.prevPosition - b.prevPosition);
      const top3   = sorted.slice(0, 3);
      const extra  = Math.max(0, sorted.length - 3);

      const rows = top3.map((r, i) => {
        const medal   = ['🥇', '🥈', '🥉'][i];
        const icon    = OUTCOME_ICON[r.outcome];
        const color   = OUTCOME_COLOR[r.outcome];
        const bg      = OUTCOME_BG[r.outcome];
        const pts     = r.pointsEarned > 0 ? `+${r.pointsEarned} pts` : '0 pts';
        const arrow   = r.newPosition < r.prevPosition ? `↑${r.prevPosition - r.newPosition}`
                      : r.newPosition > r.prevPosition ? `↓${r.newPosition - r.prevPosition}` : '';
        return `
        <div style="display:table;width:100%;margin-bottom:6px;background:${i % 2 === 0 ? '#f8fafc' : '#fff'};border-radius:10px;padding:4px 0">
          <div style="display:table-cell;width:28px;vertical-align:middle;text-align:center;font-size:16px">${medal}</div>
          <div style="display:table-cell;vertical-align:middle;padding-left:4px">
            <div style="font-size:13px;font-weight:700;color:#0f172a">${escHtml(r.name)}</div>
            ${arrow ? `<div style="font-size:10px;color:${r.newPosition < r.prevPosition ? '#16a34a' : '#dc2626'};font-weight:700">#${r.newPosition} ${arrow}</div>` : `<div style="font-size:10px;color:#94a3b8">#${r.newPosition}</div>`}
          </div>
          <div style="display:table-cell;width:52px;vertical-align:middle;text-align:center">
            <span style="display:inline-block;background:#0f172a;color:#94a3b8;font-size:12px;font-weight:800;padding:2px 8px;border-radius:6px;font-family:monospace">${r.homeScore}-${r.awayScore}</span>
          </div>
          <div style="display:table-cell;width:46px;vertical-align:middle;text-align:center">
            <span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:700;padding:2px 6px;border-radius:6px">${icon}</span>
          </div>
          <div style="display:table-cell;width:58px;text-align:right;vertical-align:middle;padding-right:4px">
            <span style="font-size:13px;font-weight:800;color:#a3e635">${pts}</span>
          </div>
        </div>`;
      }).join('');

      return `
      <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #f1f5f9">
        <div style="display:table;width:100%;margin-bottom:12px">
          <div style="display:table-cell;vertical-align:middle">
            <h3 style="margin:0;font-size:13px;font-weight:800;color:#0f172a">${escHtml(ld.leagueName)}</h3>
            <span style="font-size:11px;color:#64748b">${escHtml(ld.leagueCode)}</span>
          </div>
          <div style="display:table-cell;vertical-align:middle;text-align:right">
            <span style="background:#1e293b;color:#94a3b8;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">${ld.results.length} participantes</span>
          </div>
        </div>
        ${rows}
        ${extra > 0 ? `<p style="margin:8px 0 0;font-size:11px;color:#94a3b8;text-align:center">+ ${extra} más en el PDF adjunto</p>` : ''}
      </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Resultado final — ${escHtml(match.homeTeam)} ${match.homeScore}-${match.awayScore} ${escHtml(match.awayTeam)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:640px;margin:32px auto;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.15)">

  ${headerBlock(match, undefined, undefined, '⚽ Partido Finalizado', '#020617', '#0f172a', '#14532d', '#4ade80', '#052e16')}

  <!-- SCORE CARD -->
  <div style="background:#0f172a;padding:32px 28px 24px">
    ${match.round ? `<p style="margin:0 0 12px;text-align:center;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">${escHtml(match.round)}</p>` : ''}
    <div style="display:table;width:100%;table-layout:fixed">
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:35%">
        <div style="font-size:22px;font-weight:900;color:#f8fafc;line-height:1.1">${escHtml(match.homeTeam)}</div>
        <div style="font-size:10px;color:#475569;margin-top:4px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Local</div>
      </div>
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:30%">
        <div style="font-size:50px;font-weight:900;color:#a3e635;font-family:monospace;letter-spacing:-.02em;line-height:1">
          ${match.homeScore}<span style="color:#334155;font-size:30px;margin:0 4px">–</span>${match.awayScore}
        </div>
        <div style="margin-top:8px;display:inline-block;background:#1e293b;color:#94a3b8;font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;letter-spacing:.06em">FINAL</div>
      </div>
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:35%">
        <div style="font-size:22px;font-weight:900;color:#f8fafc;line-height:1.1">${escHtml(match.awayTeam)}</div>
        <div style="font-size:10px;color:#475569;margin-top:4px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Visitante</div>
      </div>
    </div>
    <div style="margin-top:16px;text-align:center;border-top:1px solid #1e293b;padding-top:14px">
      <span style="color:#64748b;font-size:13px">📅 ${formatDateTime(match.matchDate)}</span>
    </div>
  </div>

  <!-- RESULT BANNER -->
  <div style="background:${isDraw ? '#1e3a5f' : homeWon ? '#14532d' : '#3b1f00'};padding:12px 28px;text-align:center">
    <span style="color:${isDraw ? '#60a5fa' : homeWon ? '#4ade80' : '#fb923c'};font-size:15px;font-weight:800;letter-spacing:.04em">
      ${isDraw ? '🤝' : '🏆'} ${resultLabel}
    </span>
  </div>

  <!-- STATS STRIP -->
  <div style="background:#1e293b;padding:14px 28px;display:table;width:100%;box-sizing:border-box">
    ${resultStatCell('🎯 Exacto',     exactCount,      '#4ade80')}
    ${resultStatCell('✅ Gan+Gol',    winnerGoalCount, '#60a5fa')}
    ${resultStatCell('👍 Ganador',    winnerCount,     '#fbbf24')}
    ${resultStatCell('⚽ Gol',         goalCount,       '#a78bfa')}
    ${resultStatCell('❌ Incorrecto', wrongCount,      '#6b7280')}
  </div>

  ${topScorer && topScorer.pointsEarned > 0 ? `
  <div style="background:#0f172a;border-top:2px solid #a3e635;padding:14px 28px;text-align:center">
    <span style="color:#94a3b8;font-size:12px">⭐ Mejor de este partido · </span>
    <strong style="color:#a3e635;font-size:15px">${escHtml(topScorer.name)}</strong>
    <span style="color:#64748b;font-size:12px"> · +${topScorer.pointsEarned} pts</span>
  </div>` : ''}

  <!-- SUMMARY POR POLLA -->
  <div style="background:#fff;padding:0">
    <div style="padding:20px 24px 14px;border-bottom:1px solid #f1f5f9">
      <h2 style="margin:0;font-size:15px;font-weight:800;color:#0f172a">
        📊 Resultado final
        <span style="font-size:13px;font-weight:600;color:#64748b;margin-left:8px">(${totalParticipants} participantes)</span>
      </h2>
      <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">
        Participás en ${leaguesData.length} polla${leaguesData.length > 1 ? 's' : ''}. Los puntos ya fueron acreditados.
      </p>
    </div>
    <div style="padding:16px 24px 8px">
      ${leagueSummaries}
    </div>
    ${pdfBanner(totalParticipants, true)}
  </div>

  <div style="background:#0f172a;padding:20px 28px;text-align:center">
    <p style="margin:0 0 6px;font-size:11px;color:#475569">
      📬 Reporte automático de resultados · ${formatShortDateTime(sentAt)} (hora Colombia)
    </p>
    <p style="margin:0;font-size:11px;color:#334155">
      Los puntos ya fueron acreditados en el ranking de tus pollas.
    </p>
    <div style="margin-top:14px">
      <span style="font-size:10px;color:#1e293b;letter-spacing:.1em;font-weight:700;text-transform:uppercase">Polla Mundial 2026</span>
    </div>
  </div>

</div>
</body>
</html>`;
  }

  private buildMultiLeagueResultsText(
    match: ReportMatchInfo & { homeScore: number; awayScore: number },
    leaguesData: Array<{
      leagueId: string;
      leagueName: string;
      leagueCode: string;
      results: ResultEntry[];
    }>,
    sentAt: Date,
  ): string {
    const lines = [
      `Resultado final: ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`,
      formatDateTime(match.matchDate),
      '',
    ];
    for (const ld of leaguesData) {
      lines.push(`=== ${ld.leagueName} (${ld.leagueCode}) ===`);
      const sorted = [...ld.results].sort((a, b) => b.pointsEarned - a.pointsEarned);
      const top3   = sorted.slice(0, 3);
      for (const r of top3) {
        lines.push(`#${r.newPosition} ${r.name}: ${r.homeScore}-${r.awayScore} | +${r.pointsEarned} pts | ${describeOutcome(r.outcome)}`);
      }
      if (sorted.length > 3) lines.push(`... y ${sorted.length - 3} participantes más (ver PDF adjunto)`);
      lines.push('');
    }
    lines.push(`Reporte generado: ${formatShortDateTime(sentAt)}`);
    return lines.join('\n');
  }

  private buildMultiLeaguePredictionsText(
    match: ReportMatchInfo,
    leaguesData: Array<{
      leagueName: string;
      leagueCode: string;
      predictors: PredictorEntry[];
      standings: Map<string, { points: number; position: number }>;
    }>,
    sentAt: Date,
  ): string {
    const lines = [
      `Predicciones cerradas: ${match.homeTeam} vs ${match.awayTeam}`,
      formatDateTime(match.matchDate),
      '',
    ];

    for (const ld of leaguesData) {
      lines.push(`=== ${ld.leagueName} (${ld.leagueCode}) ===`);
      const sorted = [...ld.predictors].sort((a, b) => {
        const aPos = ld.standings.get(a.userId)?.position ?? 9999;
        const bPos = ld.standings.get(b.userId)?.position ?? 9999;
        return aPos - bPos;
      });
      const top3 = sorted.slice(0, 3);
      for (const p of top3) {
        const st = ld.standings.get(p.userId);
        lines.push(`#${st?.position ?? '-'} ${p.name}: ${p.homeScore}-${p.awayScore} (${st?.points ?? 0} pts)`);
      }
      if (sorted.length > 3) lines.push(`... y ${sorted.length - 3} participantes más (ver PDF adjunto)`);
      lines.push('');
    }

    lines.push(`Reporte generado: ${formatShortDateTime(sentAt)}`);
    return lines.join('\n');
  }

  private buildPlainText(params: Omit<SendReportParams, 'recipients'>): string {
    const sorted = [...params.predictors].sort((a, b) => {
      const aPos = params.standings.get(a.userId)?.position ?? 9999;
      const bPos = params.standings.get(b.userId)?.position ?? 9999;
      return aPos - bPos;
    });
    const top3 = sorted.slice(0, 3);

    return [
      `Predicciones cerradas: ${params.match.homeTeam} vs ${params.match.awayTeam}`,
      `Liga: ${params.leagueName} (${params.leagueCode})`,
      `Partido: ${formatDateTime(params.match.matchDate)}`,
      '',
      'Top 3:',
      ...top3.map((p, i) => {
        const st = params.standings.get(p.userId);
        return `${i + 1}. ${p.name}: ${p.homeScore}-${p.awayScore} | ${st ? `#${st.position} · ${st.points} pts` : 'sin posición'}`;
      }),
      params.predictors.length > 3 ? `... y ${params.predictors.length - 3} participantes más (ver PDF adjunto)` : '',
      '',
      `Reporte generado: ${formatShortDateTime(params.sentAt)}`,
    ].filter(l => l !== undefined).join('\n');
  }

  private buildResultPlainText(params: Omit<SendResultParams, 'recipients'>): string {
    const sorted = [...params.results].sort((a, b) => b.pointsEarned - a.pointsEarned);
    const top3   = sorted.slice(0, 3);

    return [
      `Resultado final: ${params.match.homeTeam} ${params.match.homeScore}-${params.match.awayScore} ${params.match.awayTeam}`,
      `Liga: ${params.leagueName} (${params.leagueCode})`,
      `Partido: ${formatDateTime(params.match.matchDate)}`,
      '',
      'Mejores del partido:',
      ...top3.map((r, i) => `${i + 1}. ${r.name}: +${r.pointsEarned} pts | ${describeOutcome(r.outcome)} | #${r.prevPosition} → #${r.newPosition}`),
      params.results.length > 3 ? `... y ${params.results.length - 3} participantes más (ver PDF adjunto)` : '',
      '',
      `Reporte generado: ${formatShortDateTime(params.sentAt)}`,
    ].filter(l => l !== undefined).join('\n');
  }
}

// ──────────────────────────────────────────────────────────────────────
//  SHARED HTML HELPERS
// ──────────────────────────────────────────────────────────────────────

function headerBlock(
  match: ReportMatchInfo,
  leagueName: string | undefined,
  leagueCode: string | undefined,
  eyebrow: string,
  c1: string,
  c2: string,
  c3: string,
  badgeBg = '#a3e635',
  badgeColor = '#0f172a',
): string {
  return `
  <div style="background:linear-gradient(135deg,${c1} 0%,${c2} 60%,${c3} 100%);padding:32px 28px 24px;text-align:center">
    <div style="display:inline-block;background:${badgeBg};color:${badgeColor};font-size:10px;font-weight:900;letter-spacing:.18em;padding:4px 14px;border-radius:20px;text-transform:uppercase;margin-bottom:16px">
      ${eyebrow}
    </div>
    <h1 style="margin:0 0 4px;color:#f8fafc;font-size:22px;font-weight:800;letter-spacing:-.02em">Polla Mundial 2026</h1>
    ${leagueName ? `<p style="margin:0;color:#94a3b8;font-size:13px;font-weight:500">
      ${escHtml(leagueName)}
      ${leagueCode ? `<span style="background:#1e293b;color:#64748b;font-size:11px;padding:2px 8px;border-radius:8px;margin-left:8px">${escHtml(leagueCode)}</span>` : ''}
    </p>` : ''}
  </div>`;
}

function matchCard(match: ReportMatchInfo): string {
  return `
  <div style="background:#0f172a;padding:28px 28px 20px">
    ${match.round ? `<p style="margin:0 0 12px;text-align:center;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">${escHtml(match.round)}</p>` : ''}
    <div style="display:table;width:100%;table-layout:fixed">
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:40%">
        <div style="font-size:32px;font-weight:900;color:#f8fafc;letter-spacing:-.03em;line-height:1">${escHtml(match.homeTeam)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Local</div>
      </div>
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:20%">
        <div style="font-size:22px;font-weight:900;color:#475569">VS</div>
      </div>
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:40%">
        <div style="font-size:32px;font-weight:900;color:#f8fafc;letter-spacing:-.03em;line-height:1">${escHtml(match.awayTeam)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Visitante</div>
      </div>
    </div>
    <div style="margin-top:20px;text-align:center;padding-top:16px;border-top:1px solid #1e293b">
      <span style="color:#64748b;font-size:13px">📅 ${formatDateTime(match.matchDate)}</span>
      ${match.venue ? `<span style="color:#475569;font-size:13px;margin-left:16px">🏟 ${escHtml(match.venue)}</span>` : ''}
    </div>
  </div>`;
}

function statsBar(items: Array<{ label: string; value: string }>): string {
  const cells = items.map(({ label, value }) => `
    <div style="display:table-cell;text-align:center;padding:8px 4px">
      <div style="font-size:11px;color:#64748b;margin-bottom:4px">${label}</div>
      <div style="font-size:18px;font-weight:900;color:#f8fafc">${value}</div>
    </div>`).join('');
  return `<div style="background:#1e293b;padding:16px 28px;display:table;width:100%;box-sizing:border-box">${cells}</div>`;
}

function podiumRow(name: string, homeScore: number, awayScore: number, pts: number | undefined, idx: number): string {
  const medals = ['🥇', '🥈', '🥉'];
  const medal  = medals[idx] ?? `${idx + 1}.`;
  return `
  <div style="display:table;width:100%;margin-bottom:6px;background:${idx % 2 === 0 ? '#f8fafc' : '#fff'};border-radius:10px;padding:2px 0">
    <div style="display:table-cell;width:28px;vertical-align:middle;text-align:center;font-size:18px">${medal}</div>
    <div style="display:table-cell;vertical-align:middle;font-size:13px;font-weight:600;color:#0f172a;padding-left:4px">${escHtml(name)}</div>
    <div style="display:table-cell;width:72px;text-align:center;vertical-align:middle">
      <span style="display:inline-block;background:#0f172a;color:#a3e635;font-size:15px;font-weight:900;padding:3px 10px;border-radius:8px;font-family:monospace">${homeScore}–${awayScore}</span>
    </div>
    ${pts !== undefined ? `<div style="display:table-cell;width:52px;text-align:right;vertical-align:middle;font-size:12px;color:#94a3b8;padding-right:4px">${pts} pts</div>` : ''}
  </div>`;
}

function pdfBanner(count: number, isResults = false): string {
  const label = isResults ? 'resultados' : 'pronósticos';
  return `
  <div style="margin:12px 24px 16px;padding:14px 16px;background:#f0fdf4;border:1px solid #86efac;border-radius:12px;text-align:center">
    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#14532d">
      📎 Reporte completo adjunto en PDF
    </p>
    <p style="margin:0;font-size:12px;color:#16a34a">
      El listado de los ${count} ${label} está disponible en el archivo adjunto para mejor visualización.
    </p>
  </div>`;
}

function footerBlock(sentAt: Date, leagueName?: string): string {
  return `
  <div style="background:#0f172a;padding:20px 28px;text-align:center">
    <p style="margin:0 0 6px;font-size:11px;color:#475569">
      🔔 Reporte generado automáticamente · ${formatShortDateTime(sentAt)} (hora Colombia)
    </p>
    ${leagueName ? `<p style="margin:0;font-size:11px;color:#334155">
      Este correo fue enviado a todos los miembros activos de la polla <strong style="color:#64748b">${escHtml(leagueName)}</strong>.
    </p>` : ''}
    <div style="margin-top:16px">
      <span style="font-size:10px;color:#1e293b;letter-spacing:.1em;font-weight:700;text-transform:uppercase">Polla Mundial 2026</span>
    </div>
  </div>`;
}

function resultStatCell(label: string, value: number, color: string): string {
  return `<div style="display:table-cell;text-align:center;padding:6px 4px">
    <div style="font-size:11px;color:#64748b;margin-bottom:3px">${label}</div>
    <div style="font-size:20px;font-weight:900;color:${color}">${value}</div>
  </div>`;
}

function describeOutcome(outcome: ResultOutcome): string {
  const map: Record<ResultOutcome, string> = {
    EXACT_UNIQUE: 'Exacto único',
    EXACT:        'Exacto',
    WINNER_GOAL:  'Ganador + Gol',
    WINNER:       'Ganador',
    GOAL:         'Gol',
    WRONG:        'Incorrecto',
  };
  return map[outcome] ?? outcome;
}

function formatDateTime(value: Date): string {
  return value.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday:  'long',
    day:      '2-digit',
    month:    'long',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
  });
}

function formatShortDateTime(value: Date): string {
  return value.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 20);
}
