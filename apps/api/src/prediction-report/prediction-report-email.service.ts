import { Injectable, Logger } from '@nestjs/common';
import { EmailJobPriority, EmailJobType } from '@prisma/client';
import { EmailQueueService } from '../email/email-queue.service';

export interface PredictorEntry {
  userId: string;
  name: string;
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

  constructor(private readonly emailQueue?: EmailQueueService) {}

  async sendPredictionsReport(params: SendReportParams): Promise<void> {
    if (!this.emailQueue) {
      this.logger.warn('Prediction report email queue is not available; skipping queued delivery.');
      return;
    }

    const html = this.buildHtml(params);
    const text = this.buildPlainText(params);
    const subject = `🔒 Predicciones cerradas: ${params.match.homeTeam} vs ${params.match.awayTeam} | ${params.leagueName}`;

    for (const recipient of params.recipients) {
      await this.emailQueue.enqueueEmail({
        type: EmailJobType.PREDICTIONS_REPORT,
        priority: EmailJobPriority.MEDIUM,
        required: false,
        recipientEmail: recipient,
        subject,
        html,
        text,
        matchId: params.matchId,
        leagueId: params.leagueId,
        dedupeKey: [
          'predictions-report',
          params.matchId ?? `${params.match.homeTeam}-${params.match.awayTeam}-${params.match.matchDate.toISOString()}`,
          params.leagueId ?? params.leagueCode,
          recipient.toLowerCase(),
        ].join(':'),
      });
    }

    this.logger.log(`Queued predictions report emails: ${params.recipients.length} recipients`);
  }

  async sendResultsReport(params: SendResultParams): Promise<void> {
    if (!this.emailQueue) {
      this.logger.warn('Results report email queue is not available; skipping queued delivery.');
      return;
    }

    const html = this.buildResultHtml(params);
    const text = this.buildResultPlainText(params);
    const subject = `✅ Resultado final: ${params.match.homeTeam} ${params.match.homeScore}-${params.match.awayScore} ${params.match.awayTeam} | ${params.leagueName}`;

    for (const recipient of params.recipients) {
      await this.emailQueue.enqueueEmail({
        type: EmailJobType.MATCH_RESULTS_REPORT,
        priority: EmailJobPriority.LOW,
        required: false,
        recipientEmail: recipient,
        subject,
        html,
        text,
        matchId: params.matchId,
        leagueId: params.leagueId,
        dedupeKey: [
          'match-results-report',
          params.matchId ?? `${params.match.homeTeam}-${params.match.awayTeam}-${params.match.matchDate.toISOString()}`,
          params.leagueId ?? params.leagueCode,
          recipient.toLowerCase(),
        ].join(':'),
      });
    }

    this.logger.log(`Queued results report emails: ${params.recipients.length} recipients`);
  }

  buildHtml(params: Omit<SendReportParams, 'recipients'>): string {
    const sortedPredictors = [...params.predictors].sort((left, right) => {
      if (left.isAdmin !== right.isAdmin) return left.isAdmin ? -1 : 1;
      return left.submittedAt.getTime() - right.submittedAt.getTime();
    });

    const rows = sortedPredictors
      .map((predictor) => {
        const standing = params.standings.get(predictor.userId);
        return `<tr>
          <td>${escapeHtml(predictor.name)}${predictor.isAdmin ? ' <strong>(Admin)</strong>' : ''}</td>
          <td style="text-align:center;">${predictor.homeScore} - ${predictor.awayScore}</td>
          <td style="text-align:center;">${standing ? `#${standing.position}` : '—'}</td>
          <td style="text-align:center;">${standing ? `${standing.points} pts` : '—'}</td>
        </tr>`;
      })
      .join('');

    return this.wrapHtml({
      eyebrow: 'Predicciones cerradas',
      heading: `${params.match.homeTeam} vs ${params.match.awayTeam}`,
      summary: 'La ventana de predicciones se cerró. Este es el resumen oficial enviado a la liga.',
      details: [
        `Liga: ${params.leagueName} (${params.leagueCode})`,
        `Partido: ${formatDateTime(params.match.matchDate)}`,
        params.match.round ? `Fase: ${params.match.round}` : null,
        params.match.venue ? `Sede: ${params.match.venue}` : null,
      ],
      tableHeader: ['Participante', 'Pronóstico', 'Posición', 'Pts. acumulados'],
      tableRows: rows,
      footer: `Generado el ${formatShortDateTime(params.sentAt)} · hora Colombia`,
    });
  }

  buildResultHtml(params: Omit<SendResultParams, 'recipients'>): string {
    const sortedResults = [...params.results].sort((left, right) => {
      return right.pointsEarned - left.pointsEarned || left.newPosition - right.newPosition;
    });

    const rows = sortedResults
      .map((result) => `<tr>
        <td>${escapeHtml(result.name)}${result.isAdmin ? ' <strong>(Admin)</strong>' : ''}</td>
        <td style="text-align:center;">${result.homeScore} - ${result.awayScore}</td>
        <td style="text-align:center;">${result.pointsEarned} pts</td>
        <td style="text-align:center;">#${result.prevPosition} → #${result.newPosition}</td>
        <td style="text-align:center;">${describeOutcome(result.outcome)}</td>
      </tr>`)
      .join('');

    return this.wrapHtml({
      eyebrow: 'Resultado final',
      heading: `${params.match.homeTeam} ${params.match.homeScore}-${params.match.awayScore} ${params.match.awayTeam}`,
      summary: 'Ya se calcularon los puntos y este es el resumen oficial de la liga.',
      details: [
        `Liga: ${params.leagueName} (${params.leagueCode})`,
        `Partido: ${formatDateTime(params.match.matchDate)}`,
        params.match.round ? `Fase: ${params.match.round}` : null,
        params.match.venue ? `Sede: ${params.match.venue}` : null,
      ],
      tableHeader: ['Participante', 'Pronóstico', 'Puntos', 'Movimiento', 'Resultado'],
      tableRows: rows,
      footer: `Generado el ${formatShortDateTime(params.sentAt)} · hora Colombia`,
    });
  }

  private buildPlainText(params: Omit<SendReportParams, 'recipients'>): string {
    return [
      `Predicciones cerradas · ${params.match.homeTeam} vs ${params.match.awayTeam}`,
      `Liga: ${params.leagueName} (${params.leagueCode})`,
      `Partido: ${formatDateTime(params.match.matchDate)}`,
      '',
      ...params.predictors.map((predictor) => {
        const standing = params.standings.get(predictor.userId);
        return `${predictor.name}: ${predictor.homeScore}-${predictor.awayScore} | ${standing ? `#${standing.position} · ${standing.points} pts` : 'sin posición'}`;
      }),
    ].join('\n');
  }

  private buildResultPlainText(params: Omit<SendResultParams, 'recipients'>): string {
    return [
      `Resultado final · ${params.match.homeTeam} ${params.match.homeScore}-${params.match.awayScore} ${params.match.awayTeam}`,
      `Liga: ${params.leagueName} (${params.leagueCode})`,
      `Partido: ${formatDateTime(params.match.matchDate)}`,
      '',
      ...params.results.map((result) => `${result.name}: ${result.homeScore}-${result.awayScore} | ${result.pointsEarned} pts | ${describeOutcome(result.outcome)} | #${result.prevPosition} → #${result.newPosition}`),
    ].join('\n');
  }

  private wrapHtml(options: {
    eyebrow: string;
    heading: string;
    summary: string;
    details: Array<string | null>;
    tableHeader: string[];
    tableRows: string;
    footer: string;
  }): string {
    const details = options.details.filter(Boolean).map((detail) => `<li>${escapeHtml(detail!)}</li>`).join('');
    const headers = options.tableHeader.map((header) => `<th>${escapeHtml(header)}</th>`).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.heading)}</title>
</head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,.12)">
    <div style="padding:28px 32px;background:#0f172a;color:#ffffff;">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;">${escapeHtml(options.eyebrow)}</div>
      <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">${escapeHtml(options.heading)}</h1>
      <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#cbd5e1;">${escapeHtml(options.summary)}</p>
    </div>
    <div style="padding:28px 32px;">
      <ul style="margin:0 0 24px;padding-left:20px;color:#334155;line-height:1.8;">${details}</ul>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#eff6ff;">${headers}</tr>
        </thead>
        <tbody>${options.tableRows}</tbody>
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:#64748b;">${escapeHtml(options.footer)}</p>
    </div>
  </div>
</body>
</html>`;
  }
}

function describeOutcome(outcome: ResultOutcome): string {
  switch (outcome) {
    case 'EXACT_UNIQUE':
      return 'Marcador exacto único';
    case 'EXACT':
      return 'Marcador exacto';
    case 'WINNER_GOAL':
      return 'Ganador y goles';
    case 'WINNER':
      return 'Ganador correcto';
    case 'GOAL':
      return 'Goles acertados';
    default:
      return 'Sin acierto';
  }
}

function formatDateTime(value: Date): string {
  return value.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDateTime(value: Date): string {
  return value.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
