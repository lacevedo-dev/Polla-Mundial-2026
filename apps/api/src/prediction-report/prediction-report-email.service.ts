import { Injectable, Logger } from '@nestjs/common';
import { EmailJobPriority, EmailJobType } from '@prisma/client';
import { EmailQueueService } from '../email/email-queue.service';

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

  constructor(private readonly emailQueue: EmailQueueService) {}

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
    if (!this.emailQueue) {
      this.logger.warn('Prediction report email queue is not available; skipping queued delivery.');
      return;
    }

    const userLeaguesMap = new Map<string, Array<{
      leagueId: string;
      leagueName: string;
      leagueCode: string;
      predictor?: PredictorEntry;
      standing?: { points: number; position: number };
    }>>();

    for (const leagueData of params.leaguesData) {
      for (const predictor of leagueData.predictors) {
        const email = predictor.email?.toLowerCase();
        if (!email) continue;

        if (!userLeaguesMap.has(email)) {
          userLeaguesMap.set(email, []);
        }
        userLeaguesMap.get(email)!.push({
          leagueId: leagueData.leagueId,
          leagueName: leagueData.leagueName,
          leagueCode: leagueData.leagueCode,
          predictor,
          standing: leagueData.standings.get(predictor.userId),
        });
      }
    }

    const uniqueRecipients = [...userLeaguesMap.keys()];
    const html = this.buildMultiLeaguePredictionsHtml(params.match, params.leaguesData, params.sentAt);
    const text = this.buildMultiLeaguePredictionsText(params.match, params.leaguesData, params.sentAt);
    const subject = `🔒 Predicciones cerradas: ${params.match.homeTeam} vs ${params.match.awayTeam}`;

    const queued = await this.emailQueue.enqueueEmails(
      uniqueRecipients.map((recipient) => ({
        type: EmailJobType.PREDICTIONS_REPORT,
        priority: EmailJobPriority.MEDIUM,
        required: false,
        recipientEmail: recipient,
        subject,
        html,
        text,
        matchId: params.matchId,
        dedupeKey: [
          'predictions-report-multi',
          params.matchId,
          recipient,
        ].join(':'),
      })),
    );

    this.logger.log(
      `Queued multi-league predictions report emails: ${queued.queued}/${uniqueRecipients.length} recipients`,
    );
  }

  async sendPredictionsReport(params: SendReportParams): Promise<void> {
    if (!this.emailQueue) {
      this.logger.warn('Prediction report email queue is not available; skipping queued delivery.');
      return;
    }

    const html = this.buildHtml(params);
    const text = this.buildPlainText(params);
    const subject = `🔒 Predicciones cerradas: ${params.match.homeTeam} vs ${params.match.awayTeam} | ${params.leagueName}`;

    const queued = await this.emailQueue.enqueueEmails(
      params.recipients.map((recipient) => ({
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
      })),
    );

    this.logger.log(
      `Queued predictions report emails: ${queued.queued}/${params.recipients.length} recipients`,
    );
  }

  async sendResultsReport(params: SendResultParams): Promise<void> {
    const html = this.buildResultHtml(params);
    const text = this.buildResultPlainText(params);
    const subject = `✅ Resultado final: ${params.match.homeTeam} ${params.match.homeScore}-${params.match.awayScore} ${params.match.awayTeam} | ${params.leagueName}`;

    const queued = await this.emailQueue.enqueueEmails(
      params.recipients.map((recipient) => ({
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
      })),
    );

    this.logger.log(
      `Queued results report emails: ${queued.queued}/${params.recipients.length} recipients`,
    );
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
  ): string {
    const matchDateStr = formatDateTime(match.matchDate);
    const closedAtStr = formatShortDateTime(sentAt);
    const totalPredictors = leaguesData.reduce((sum, l) => sum + l.predictors.length, 0);

    let leagueTables = '';
    for (const leagueData of leaguesData) {
      const sorted = [...leagueData.predictors].sort((a, b) => {
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return a.submittedAt.getTime() - b.submittedAt.getTime();
      });

      const rows = sorted.map((p, idx) => {
        const standing = leagueData.standings.get(p.userId);
        const posLabel = standing ? `#${standing.position}` : '—';
        const ptsLabel = standing ? `${standing.points} pts` : '—';
        const adminBadge = p.isAdmin
          ? `<span style="display:inline-block;background:#f59e0b;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:20px;letter-spacing:.05em;margin-left:6px;vertical-align:middle;text-transform:uppercase">Admin</span>`
          : '';
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
          <tr style="background:${rowBg}">
            <td style="padding:12px 16px;font-size:13px;color:#64748b;font-weight:700;text-align:center;white-space:nowrap">${posLabel}</td>
            <td style="padding:12px 16px;font-size:14px;color:#0f172a;font-weight:600">${escHtml(p.name)}${adminBadge}</td>
            <td style="padding:12px 16px;text-align:center">
              <span style="display:inline-flex;align-items:center;gap:8px;background:#0f172a;color:#a3e635;font-size:22px;font-weight:900;padding:6px 18px;border-radius:12px;letter-spacing:.05em;font-family:monospace">
                ${p.homeScore} <span style="color:#475569;font-size:14px">–</span> ${p.awayScore}
              </span>
            </td>
            <td style="padding:12px 16px;font-size:12px;color:#94a3b8;text-align:center;white-space:nowrap">${ptsLabel}</td>
            <td style="padding:12px 16px;font-size:11px;color:#94a3b8;text-align:right">${formatShortDateTime(p.submittedAt)}</td>
          </tr>`;
      }).join('');

      leagueTables += `
        <div style="margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e2e8f0">
          <div style="padding:20px 24px;background:#f1f5f9;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between">
            <div>
              <h2 style="margin:0;font-size:18px;font-weight:800;color:#0f172a">${escHtml(leagueData.leagueName)}</h2>
              <p style="margin:4px 0 0;font-size:12px;color:#64748b;letter-spacing:.08em;text-transform:uppercase">${escHtml(leagueData.leagueCode)}</p>
            </div>
            <span style="background:#0f172a;color:#fff;font-size:12px;font-weight:700;padding:6px 12px;border-radius:20px">${leagueData.predictors.length} pronósticos</span>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:12px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-align:center;letter-spacing:.08em;text-transform:uppercase">Pos.</th>
                <th style="padding:12px 16px;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.08em;text-transform:uppercase">Participante</th>
                <th style="padding:12px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-align:center;letter-spacing:.08em;text-transform:uppercase">Pronóstico</th>
                <th style="padding:12px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-align:center;letter-spacing:.08em;text-transform:uppercase">Pts.</th>
                <th style="padding:12px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-align:right;letter-spacing:.08em;text-transform:uppercase">Hora</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Predicciones cerradas</title>
</head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:700px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,.12)">
    <div style="padding:28px 32px;background:#1e293b;color:#ffffff;">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;margin-bottom:12px">🔒 Predicciones cerradas</div>
      <h1 style="margin:0;font-size:28px;line-height:1.2">${escHtml(match.homeTeam)} vs ${escHtml(match.awayTeam)}</h1>
      <p style="margin:14px 0 0;font-size:15px;line-height:1.6;opacity:.95">📅 ${matchDateStr}${match.venue ? ` · 🏟 ${escHtml(match.venue)}` : ''}</p>
    </div>
    <div style="padding:24px 32px;">
      <div style="margin-bottom:20px;padding:16px;background:#eff6ff;border-radius:12px">
        <p style="margin:0;font-size:14px;color:#1e3a8a">📊 <strong>${totalPredictors}</strong> pronósticos en <strong>${leaguesData.length}</strong> polla${leaguesData.length > 1 ? 's' : ''}</p>
      </div>
      ${leagueTables}
    </div>
    <div style="padding:20px 28px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:11px;color:#94a3b8">Reporte generado · ${closedAtStr} (hora Colombia)</p>
    </div>
  </div>
</body>
</html>`;
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
      `🔒 Predicciones cerradas: ${match.homeTeam} vs ${match.awayTeam}`,
      formatDateTime(match.matchDate),
      '',
    ];

    for (const leagueData of leaguesData) {
      lines.push(`=== ${leagueData.leagueName} (${leagueData.leagueCode}) ===`);
      const sorted = [...leagueData.predictors].sort((a, b) => {
        const aPos = leagueData.standings.get(a.userId)?.position ?? 99;
        const bPos = leagueData.standings.get(b.userId)?.position ?? 99;
        return aPos - bPos;
      });

      for (const p of sorted) {
        const standing = leagueData.standings.get(p.userId);
        lines.push(`#${standing?.position ?? '—'} ${p.name}${p.isAdmin ? ' [Admin]' : ''}: ${p.homeScore}-${p.awayScore} (${standing?.points ?? 0} pts)`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  buildHtml(params: Omit<SendReportParams, 'recipients'>): string {
    const { leagueName, leagueCode, match, predictors, standings, sentAt } = params;

    const matchDateStr = formatDateTime(match.matchDate);
    const closedAtStr = formatShortDateTime(sentAt);

    const sorted = [...predictors].sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    });

    const rows = sorted.map((p, idx) => {
      const standing   = standings.get(p.userId);
      const posLabel   = standing ? `#${standing.position}` : '—';
      const ptsLabel   = standing ? `${standing.points} pts` : '—';
      const adminBadge = p.isAdmin
        ? `<span style="display:inline-block;background:#f59e0b;color:#fff;font-size:9px;font-weight:800;
                        padding:2px 6px;border-radius:20px;letter-spacing:.05em;margin-left:6px;
                        vertical-align:middle;text-transform:uppercase">Admin</span>`
        : '';
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      return `
        <tr style="background:${rowBg}">
          <td style="padding:12px 16px;font-size:13px;color:#64748b;font-weight:700;text-align:center;white-space:nowrap">
            ${posLabel}
          </td>
          <td style="padding:12px 16px;font-size:14px;color:#0f172a;font-weight:600">
            ${escHtml(p.name)}${adminBadge}
          </td>
          <td style="padding:12px 16px;text-align:center">
            <span style="display:inline-flex;align-items:center;gap:8px;background:#0f172a;
                         color:#a3e635;font-size:22px;font-weight:900;padding:6px 18px;
                         border-radius:12px;letter-spacing:.05em;font-family:monospace">
              ${p.homeScore} <span style="color:#475569;font-size:14px">–</span> ${p.awayScore}
            </span>
          </td>
          <td style="padding:12px 16px;font-size:12px;color:#94a3b8;text-align:center;white-space:nowrap">
            ${ptsLabel}
          </td>
          <td style="padding:12px 16px;font-size:11px;color:#94a3b8;text-align:right;white-space:nowrap">
            ${p.submittedAt.toLocaleTimeString('es-CO', { timeZone:'America/Bogota', hour:'2-digit', minute:'2-digit' })}
          </td>
        </tr>`;
    }).join('');

    const totalPredictors   = predictors.length;
    const homeWinVotes      = predictors.filter(p => p.homeScore > p.awayScore).length;
    const awayWinVotes      = predictors.filter(p => p.awayScore > p.homeScore).length;
    const drawVotes         = predictors.filter(p => p.homeScore === p.awayScore).length;
    const avgHome = totalPredictors ? (predictors.reduce((s, p) => s + p.homeScore, 0) / totalPredictors).toFixed(1) : '—';
    const avgAway = totalPredictors ? (predictors.reduce((s, p) => s + p.awayScore, 0) / totalPredictors).toFixed(1) : '—';

    const pct = (n: number) => totalPredictors ? Math.round((n / totalPredictors) * 100) : 0;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pronósticos cerrados — ${escHtml(match.homeTeam)} vs ${escHtml(match.awayTeam)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">

<div style="max-width:620px;margin:32px auto;border-radius:20px;overflow:hidden;
            box-shadow:0 20px 60px rgba(0,0,0,.15)">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#020617 0%,#0f172a 60%,#1e1b4b 100%);
              padding:32px 28px 24px;text-align:center">
    <div style="display:inline-block;background:#a3e635;color:#0f172a;
                font-size:10px;font-weight:900;letter-spacing:.18em;
                padding:4px 14px;border-radius:20px;text-transform:uppercase;margin-bottom:16px">
      🔒 Ventana de Pronósticos Cerrada
    </div>
    <h1 style="margin:0 0 4px;color:#f8fafc;font-size:22px;font-weight:800;letter-spacing:-.02em">
      Polla Mundial 2026
    </h1>
    <p style="margin:0;color:#94a3b8;font-size:13px;font-weight:500">
      ${escHtml(leagueName)}
      <span style="background:#1e293b;color:#64748b;font-size:11px;
                   padding:2px 8px;border-radius:8px;margin-left:8px">${escHtml(leagueCode)}</span>
    </p>
  </div>

  <!-- MATCH CARD -->
  <div style="background:#0f172a;padding:28px 28px 20px">
    ${match.round ? `<p style="margin:0 0 12px;text-align:center;color:#64748b;font-size:11px;
                                font-weight:700;letter-spacing:.12em;text-transform:uppercase">
      ${escHtml(match.round)}</p>` : ''}
    <div style="display:table;width:100%;table-layout:fixed">
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:40%">
        <div style="font-size:36px;font-weight:900;color:#f8fafc;letter-spacing:-.03em;line-height:1">
          ${escHtml(match.homeTeam)}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:600;letter-spacing:.06em;
                    text-transform:uppercase">Local</div>
      </div>
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:20%">
        <div style="font-size:24px;font-weight:900;color:#475569">VS</div>
      </div>
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:40%">
        <div style="font-size:36px;font-weight:900;color:#f8fafc;letter-spacing:-.03em;line-height:1">
          ${escHtml(match.awayTeam)}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;font-weight:600;letter-spacing:.06em;
                    text-transform:uppercase">Visitante</div>
      </div>
    </div>
    <div style="margin-top:20px;text-align:center;padding-top:16px;border-top:1px solid #1e293b">
      <span style="color:#64748b;font-size:13px">📅 ${matchDateStr}</span>
      ${match.venue ? `<span style="color:#475569;font-size:13px;margin-left:16px">🏟 ${escHtml(match.venue)}</span>` : ''}
    </div>
  </div>

  <!-- STATS BAR -->
  <div style="background:#1e293b;padding:16px 28px;display:table;width:100%;box-sizing:border-box">
    ${statCell('🏠 Local gana', homeWinVotes, pct(homeWinVotes))}
    ${statCell('🤝 Empate', drawVotes, pct(drawVotes))}
    ${statCell('✈️ Visitante gana', awayWinVotes, pct(awayWinVotes))}
    ${statCell('⚽ Promedio', `${avgHome}–${avgAway}`, null)}
  </div>

  <!-- PREDICTIONS TABLE -->
  <div style="background:#ffffff;padding:0">
    <div style="padding:20px 24px 12px;border-bottom:1px solid #f1f5f9">
      <h2 style="margin:0;font-size:15px;font-weight:800;color:#0f172a">
        📋 Pronósticos registrados
        <span style="font-size:13px;font-weight:600;color:#64748b;margin-left:8px">(${totalPredictors})</span>
      </h2>
      <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">
        Todos los pronósticos son definitivos. La ventana de ingreso está cerrada.
      </p>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#94a3b8;
                     text-align:center;letter-spacing:.08em;text-transform:uppercase">Pos.</th>
          <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#94a3b8;
                     letter-spacing:.08em;text-transform:uppercase">Participante</th>
          <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#94a3b8;
                     text-align:center;letter-spacing:.08em;text-transform:uppercase">Pronóstico</th>
          <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#94a3b8;
                     text-align:center;letter-spacing:.08em;text-transform:uppercase">Pts. acum.</th>
          <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#94a3b8;
                     text-align:right;letter-spacing:.08em;text-transform:uppercase">Hora</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${predictors.length === 0 ? `
    <div style="padding:40px;text-align:center;color:#94a3b8">
      <p style="font-size:32px;margin:0">📭</p>
      <p style="margin:8px 0 0;font-size:14px">Ningún participante ingresó pronóstico para este partido.</p>
    </div>` : ''}
  </div>

  <!-- FOOTER -->
  <div style="background:#0f172a;padding:20px 28px;text-align:center">
    <p style="margin:0 0 6px;font-size:11px;color:#475569;letter-spacing:.05em">
      🔔 Reporte generado automáticamente · ${closedAtStr} (hora Colombia)
    </p>
    <p style="margin:0;font-size:11px;color:#334155">
      Este correo fue enviado a todos los miembros activos de la polla <strong style="color:#64748b">${escHtml(leagueName)}</strong>
      para garantizar transparencia en el proceso.
    </p>
    <div style="margin-top:16px">
      <span style="font-size:10px;color:#1e293b;letter-spacing:.1em;font-weight:700;
                   text-transform:uppercase">Polla Mundial 2026</span>
    </div>
  </div>

</div>

</body>
</html>`;
  }

  buildResultHtml(params: Omit<SendResultParams, 'recipients'>): string {
    const { leagueName, leagueCode, match, results, sentAt } = params;

    const matchDateStr = formatDateTime(match.matchDate);
    const sentAtStr = formatShortDateTime(sentAt);

    const OUTCOME_CONFIG: Record<ResultOutcome, { label: string; bg: string; color: string; icon: string }> = {
      EXACT_UNIQUE: { label: 'Exacto · único ⭐',  bg: '#78350f', color: '#fcd34d', icon: '👑' },
      EXACT:        { label: 'Marcador exacto',     bg: '#14532d', color: '#4ade80', icon: '🎯' },
      WINNER_GOAL:  { label: 'Ganador + gol',       bg: '#1e3a5f', color: '#60a5fa', icon: '✅' },
      WINNER:       { label: 'Ganador correcto',    bg: '#3b2f00', color: '#fbbf24', icon: '👍' },
      GOAL:         { label: 'Gol acertado',        bg: '#2e1065', color: '#a78bfa', icon: '⚽' },
      WRONG:        { label: 'Incorrecto',           bg: '#1e1e1e', color: '#6b7280', icon: '❌' },
    };

    const sorted = [...results].sort((a, b) => b.pointsEarned - a.pointsEarned || a.prevPosition - b.prevPosition);

    const rows = sorted.map((r, idx) => {
      const cfg      = OUTCOME_CONFIG[r.outcome];
      const rowBg    = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const adminBadge = r.isAdmin
        ? `<span style="background:#f59e0b;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:20px;letter-spacing:.05em;margin-left:6px;vertical-align:middle;text-transform:uppercase">Admin</span>`
        : '';
      const movArrow = r.newPosition < r.prevPosition
        ? `<span style="color:#4ade80;font-size:11px">▲${r.prevPosition - r.newPosition}</span>`
        : r.newPosition > r.prevPosition
          ? `<span style="color:#f87171;font-size:11px">▼${r.newPosition - r.prevPosition}</span>`
          : `<span style="color:#64748b;font-size:11px">—</span>`;

      return `
        <tr style="background:${rowBg}">
          <td style="padding:12px 14px;text-align:center;font-size:13px;font-weight:700;color:#64748b;white-space:nowrap">
            #${r.newPosition} ${movArrow}
          </td>
          <td style="padding:12px 14px;font-size:14px;color:#0f172a;font-weight:600">
            ${escHtml(r.name)}${adminBadge}
          </td>
          <td style="padding:12px 14px;text-align:center">
            <span style="display:inline-flex;align-items:center;gap:6px;background:#0f172a;color:#94a3b8;
                         font-size:18px;font-weight:900;padding:4px 14px;border-radius:10px;font-family:monospace">
              ${r.homeScore} – ${r.awayScore}
            </span>
          </td>
          <td style="padding:12px 14px;text-align:center">
            <span style="display:inline-block;background:${cfg.bg};color:${cfg.color};
                         font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;
                         letter-spacing:.04em;white-space:nowrap">
              ${cfg.icon} ${cfg.label}
            </span>
          </td>
          <td style="padding:12px 14px;text-align:center">
            ${r.pointsEarned > 0
              ? `<span style="font-size:18px;font-weight:900;color:#a3e635">+${r.pointsEarned}</span>`
              : `<span style="font-size:16px;font-weight:700;color:#475569">0</span>`}
          </td>
        </tr>`;
    }).join('');

    const exactCount      = results.filter(r => r.outcome === 'EXACT' || r.outcome === 'EXACT_UNIQUE').length;
    const winnerGoalCount = results.filter(r => r.outcome === 'WINNER_GOAL').length;
    const winnerCount     = results.filter(r => r.outcome === 'WINNER').length;
    const goalCount       = results.filter(r => r.outcome === 'GOAL').length;
    const wrongCount      = results.filter(r => r.outcome === 'WRONG').length;
    const topScorer       = sorted[0];

    const homeWon = match.homeScore > match.awayScore;
    const awayWon = match.awayScore > match.homeScore;
    const isDraw  = match.homeScore === match.awayScore;
    const resultLabel = homeWon ? `Ganó ${escHtml(match.homeTeam)}`
                      : awayWon ? `Ganó ${escHtml(match.awayTeam)}`
                      : 'Empate';

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Resultados — ${escHtml(match.homeTeam)} ${match.homeScore}-${match.awayScore} ${escHtml(match.awayTeam)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:640px;margin:32px auto;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.15)">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#020617 0%,#0f172a 60%,#14532d 100%);padding:32px 28px 20px;text-align:center">
    <div style="display:inline-block;background:#4ade80;color:#052e16;font-size:10px;font-weight:900;
                letter-spacing:.18em;padding:4px 14px;border-radius:20px;text-transform:uppercase;margin-bottom:16px">
      ⚽ Partido Finalizado
    </div>
    <h1 style="margin:0 0 4px;color:#f8fafc;font-size:22px;font-weight:800;letter-spacing:-.02em">
      Polla Mundial 2026
    </h1>
    <p style="margin:0;color:#94a3b8;font-size:13px">
      ${escHtml(leagueName)}
      <span style="background:#1e293b;color:#64748b;font-size:11px;padding:2px 8px;border-radius:8px;margin-left:8px">${escHtml(leagueCode)}</span>
    </p>
  </div>

  <!-- SCORE CARD -->
  <div style="background:#0f172a;padding:32px 28px 24px">
    ${match.round ? `<p style="margin:0 0 12px;text-align:center;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">${escHtml(match.round)}</p>` : ''}
    <div style="display:table;width:100%;table-layout:fixed">
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:35%">
        <div style="font-size:28px;font-weight:900;color:#f8fafc;line-height:1.1">${escHtml(match.homeTeam)}</div>
        <div style="font-size:10px;color:#475569;margin-top:4px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Local</div>
      </div>
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:30%">
        <div style="font-size:52px;font-weight:900;color:#a3e635;font-family:monospace;letter-spacing:-.02em;line-height:1">
          ${match.homeScore}<span style="color:#334155;font-size:32px;margin:0 4px">–</span>${match.awayScore}
        </div>
        <div style="margin-top:8px;display:inline-block;background:#1e293b;color:#94a3b8;
                    font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;letter-spacing:.06em">
          FINAL
        </div>
      </div>
      <div style="display:table-cell;text-align:center;vertical-align:middle;width:35%">
        <div style="font-size:28px;font-weight:900;color:#f8fafc;line-height:1.1">${escHtml(match.awayTeam)}</div>
        <div style="font-size:10px;color:#475569;margin-top:4px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Visitante</div>
      </div>
    </div>
    <div style="margin-top:16px;text-align:center;border-top:1px solid #1e293b;padding-top:14px">
      <span style="color:#64748b;font-size:13px">📅 ${matchDateStr}</span>
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
    ${resultStatCell('🎯 Exacto', exactCount, '#4ade80')}
    ${resultStatCell('✅ Gan+Gol', winnerGoalCount, '#60a5fa')}
    ${resultStatCell('👍 Ganador', winnerCount, '#fbbf24')}
    ${resultStatCell('⚽ Gol', goalCount, '#a78bfa')}
    ${resultStatCell('❌ Incorrecto', wrongCount, '#6b7280')}
  </div>

  <!-- TOP SCORER BANNER -->
  ${topScorer && topScorer.pointsEarned > 0 ? `
  <div style="background:#0f172a;border-top:2px solid #a3e635;padding:14px 28px;text-align:center">
    <span style="color:#94a3b8;font-size:12px">⭐ Mejor de este partido · </span>
    <strong style="color:#a3e635;font-size:15px">${escHtml(topScorer.name)}</strong>
    <span style="color:#64748b;font-size:12px"> · +${topScorer.pointsEarned} pts</span>
  </div>` : ''}

  <!-- RESULTS TABLE -->
  <div style="background:#fff;padding:0">
    <div style="padding:20px 24px 12px;border-bottom:1px solid #f1f5f9">
      <h2 style="margin:0;font-size:15px;font-weight:800;color:#0f172a">
        📊 Resultados por participante
        <span style="font-size:13px;font-weight:600;color:#64748b;margin-left:8px">(${results.length})</span>
      </h2>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#94a3b8;text-align:center;letter-spacing:.08em;text-transform:uppercase">Pos.</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.08em;text-transform:uppercase">Participante</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#94a3b8;text-align:center;letter-spacing:.08em;text-transform:uppercase">Pronosticó</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#94a3b8;text-align:center;letter-spacing:.08em;text-transform:uppercase">Resultado</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#94a3b8;text-align:center;letter-spacing:.08em;text-transform:uppercase">Pts.</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <!-- FOOTER -->
  <div style="background:#0f172a;padding:20px 28px;text-align:center">
    <p style="margin:0 0 6px;font-size:11px;color:#475569">
      📬 Reporte automático de resultados · ${sentAtStr} (hora Colombia)
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

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function resultStatCell(label: string, value: number, color: string): string {
  return `<div style="display:table-cell;text-align:center;padding:6px 4px">
    <div style="font-size:11px;color:#64748b;margin-bottom:3px">${label}</div>
    <div style="font-size:20px;font-weight:900;color:${color}">${value}</div>
  </div>`;
}

function statCell(label: string, value: string | number, pct: number | null): string {
  return `
    <div style="display:table-cell;text-align:center;padding:8px 4px">
      <div style="font-size:11px;color:#64748b;margin-bottom:4px">${label}</div>
      <div style="font-size:18px;font-weight:900;color:#f8fafc">${value}${pct !== null ? `<span style="font-size:11px;color:#475569;margin-left:2px">%</span>` : ''}</div>
    </div>`;
}
