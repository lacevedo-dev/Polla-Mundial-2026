import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface PredictorEntry {
  userId:      string;
  name:        string;
  isAdmin:     boolean;
  homeScore:   number;
  awayScore:   number;
  submittedAt: Date;
}

export interface ReportMatchInfo {
  homeTeam:  string;
  awayTeam:  string;
  matchDate: Date;
  venue?:    string;
  round?:    string;
}

export interface SendReportParams {
  recipients:  string[];
  leagueName:  string;
  leagueCode:  string;
  match:       ReportMatchInfo;
  predictors:  PredictorEntry[];
  standings:   Map<string, { points: number; position: number }>;
  sentAt:      Date;
}

@Injectable()
export class PredictionReportEmailService {
  private readonly logger = new Logger(PredictionReportEmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor() {
    const host  = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'localhost';
    const port  = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10);
    const user  = process.env.EMAIL_USER || process.env.SMTP_USER;
    const pass  = process.env.EMAIL_PASS || process.env.SMTP_PASS;
    this.from   = process.env.EMAIL_FROM || 'noreply@polla2026.com';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    } as any);
  }

  async sendPredictionsReport(params: SendReportParams): Promise<void> {
    const html = this.buildHtml(params);
    const { match, leagueName } = params;

    const subject =
      `🔒 Pronósticos cerrados — ${match.homeTeam} vs ${match.awayTeam} | ${leagueName}`;

    // Enviar en lotes de 10 para no saturar el servidor
    const BATCH = 10;
    for (let i = 0; i < params.recipients.length; i += BATCH) {
      const batch = params.recipients.slice(i, i + BATCH);
      try {
        await this.transporter.sendMail({
          from:    this.from,
          bcc:     batch,
          subject,
          html,
          text:    this.buildPlainText(params),
        });
        this.logger.log(`Reporte enviado a batch ${Math.floor(i / BATCH) + 1}: ${batch.join(', ')}`);
      } catch (err: any) {
        this.logger.error(`Error enviando batch de reporte: ${err.message}`);
      }
    }
  }

  buildHtml(params: Omit<SendReportParams, 'recipients'>): string {
    const { leagueName, leagueCode, match, predictors, standings, sentAt } = params;

    const matchDateStr = match.matchDate.toLocaleString('es-CO', {
      timeZone:    'America/Bogota',
      weekday:     'long',
      day:         '2-digit',
      month:       'long',
      year:        'numeric',
      hour:        '2-digit',
      minute:      '2-digit',
    });

    const closedAtStr = sentAt.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      day:      '2-digit',
      month:    '2-digit',
      year:     'numeric',
    });

    // Sort predictors: admins first, then by submission time
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

  <!-- ── HEADER ─────────────────────────────────────────────────────── -->
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

  <!-- ── MATCH CARD ─────────────────────────────────────────────────── -->
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

  <!-- ── STATS BAR ──────────────────────────────────────────────────── -->
  <div style="background:#1e293b;padding:16px 28px;display:table;width:100%;box-sizing:border-box">
    ${statCell('🟢 Local gana', homeWinVotes, pct(homeWinVotes))}
    ${statCell('🟡 Empate', drawVotes, pct(drawVotes))}
    ${statCell('🔵 Visitante gana', awayWinVotes, pct(awayWinVotes))}
    ${statCell('⚽ Promedio', `${avgHome}–${avgAway}`, null)}
  </div>

  <!-- ── PREDICTIONS TABLE ──────────────────────────────────────────── -->
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

  <!-- ── FOOTER ─────────────────────────────────────────────────────── -->
  <div style="background:#0f172a;padding:20px 28px;text-align:center">
    <p style="margin:0 0 6px;font-size:11px;color:#475569;letter-spacing:.05em">
      🔐 Reporte generado automáticamente · ${closedAtStr} (hora Colombia)
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

  buildPlainText(params: Omit<SendReportParams, 'recipients'>): string {
    const { leagueName, match, predictors, sentAt } = params;
    const sorted = [...predictors].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
    const lines = [
      `PRONÓSTICOS CERRADOS — ${match.homeTeam} vs ${match.awayTeam}`,
      `Liga: ${leagueName}`,
      `Fecha del partido: ${match.matchDate.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`,
      '',
      'PRONÓSTICOS:',
      ...sorted.map(p =>
        `  ${p.isAdmin ? '[ADMIN] ' : ''}${p.name}: ${p.homeScore} - ${p.awayScore}`,
      ),
      '',
      `Reporte generado: ${sentAt.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`,
      'Este correo garantiza transparencia para todos los participantes.',
    ];
    return lines.join('\n');
  }
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function statCell(label: string, value: string | number, pct: number | null): string {
  return `
    <div style="display:table-cell;text-align:center;padding:8px 4px">
      <div style="font-size:11px;color:#64748b;margin-bottom:4px">${label}</div>
      <div style="font-size:18px;font-weight:900;color:#f8fafc">${value}${pct !== null ? `<span style="font-size:11px;color:#475569;margin-left:2px">%</span>` : ''}</div>
    </div>`;
}
