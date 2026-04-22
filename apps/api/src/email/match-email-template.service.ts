import { Injectable } from '@nestjs/common';

interface MatchContext {
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  venue?: string;
}

interface ReminderEmailInput extends MatchContext {
  hasPrediction: boolean;
}

interface ClosingEmailInput extends MatchContext {
  closeMinutes: number;
  hasPrediction: boolean;
}

interface ResultEmailInput extends MatchContext {
  homeScore: number | null;
  awayScore: number | null;
  points: number;
}

interface LeagueSection {
  leagueName: string;
  leagueId: string;
  hasPrediction: boolean;
  participants: Array<{
    name: string;
    hasPrediction: boolean;
  }>;
}

interface MultiLeagueReminderInput extends MatchContext {
  leagues: LeagueSection[];
}

interface MultiLeagueClosingInput extends MatchContext {
  closeMinutes: number;
  leagues: LeagueSection[];
}

export interface EmailMessageContent {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class MatchEmailTemplateService {
  buildReminderEmail(input: ReminderEmailInput): EmailMessageContent {
    const title = '? Falta 1 hora para tu partido';
    const summary = input.hasPrediction
      ? 'Tu pron�stico ya est� guardado. Revisa el partido y prep�rate para sumar puntos.'
      : 'A�n est�s a tiempo de enviar tu pron�stico antes de que inicie el partido.';

    return this.buildMessage({
      subject: `${title}: ${input.homeTeam} vs ${input.awayTeam}`,
      eyebrow: 'Recordatorio de partido',
      heading: `${input.homeTeam} vs ${input.awayTeam}`,
      summary,
      details: [
        `Inicio: ${formatDateTime(input.matchDate)}`,
        input.venue ? `Sede: ${input.venue}` : null,
        input.hasPrediction ? 'Estado: pron�stico guardado ?' : 'Estado: pendiente de pron�stico',
      ],
      ctaLabel: input.hasPrediction ? 'Revisar mi pron�stico' : 'Enviar pron�stico',
      textLines: [title, `${input.homeTeam} vs ${input.awayTeam}`, summary],
    });
  }

  buildPredictionClosingEmail(input: ClosingEmailInput): EmailMessageContent {
    const title = '?? Las predicciones est�n por cerrar';
    const summary = input.hasPrediction
      ? `Tu pron�stico ya qued� guardado. La ventana cierra en ${input.closeMinutes} minutos.`
      : `Quedan ${input.closeMinutes} minutos para enviar tu pron�stico.`;

    return this.buildMessage({
      subject: `${title}: ${input.homeTeam} vs ${input.awayTeam}`,
      eyebrow: 'Cierre de predicciones',
      heading: `${input.homeTeam} vs ${input.awayTeam}`,
      summary,
      details: [
        `Partido: ${formatDateTime(input.matchDate)}`,
        `Cierre en: ${input.closeMinutes} minutos`,
        input.hasPrediction ? 'Estado: pron�stico confirmado ?' : 'Estado: pendiente de pron�stico',
      ],
      ctaLabel: input.hasPrediction ? 'Ver pron�stico' : 'Pronosticar ahora',
      accentColor: '#7c3aed',
      textLines: [title, `${input.homeTeam} vs ${input.awayTeam}`, summary],
    });
  }

  buildMultiLeagueReminderEmail(input: MultiLeagueReminderInput): EmailMessageContent {
    const title = '⏰ Falta 1 hora para tu partido';
    const totalPollas = input.leagues.length;
    const pollasWithPrediction = input.leagues.filter(l => l.hasPrediction).length;
    const pollasPending = totalPollas - pollasWithPrediction;

    const summary = pollasPending === 0
      ? `Tienes pronósticos guardados en ${totalPollas} polla${totalPollas > 1 ? 's' : ''}.`
      : pollasPending === totalPollas
        ? `Tienes ${totalPollas} polla${totalPollas > 1 ? 's' : ''} pendiente${totalPollas > 1 ? 's' : ''} de pronóstico.`
        : `Tienes ${pollasPending} polla${pollasPending > 1 ? 's' : ''} pendiente${pollasPending > 1 ? 's' : ''} de ${totalPollas}.`;

    return this.buildMultiLeagueMessage({
      subject: `${title}: ${input.homeTeam} vs ${input.awayTeam}`,
      eyebrow: 'Recordatorio de partido',
      heading: `${input.homeTeam} vs ${input.awayTeam}`,
      summary,
      matchInfo: [
        `Inicio: ${formatDateTime(input.matchDate)}`,
        input.venue ? `Sede: ${input.venue}` : null,
        `Participas en ${totalPollas} polla${totalPollas > 1 ? 's' : ''}`,
      ],
      leagues: input.leagues,
      ctaLabel: pollasPending > 0 ? 'Enviar pronósticos' : 'Revisar pronósticos',
      textLines: [title, `${input.homeTeam} vs ${input.awayTeam}`, summary],
    });
  }

  buildMultiLeaguePredictionClosingEmail(input: MultiLeagueClosingInput): EmailMessageContent {
    const title = '⚠️ Las predicciones están por cerrar';
    const totalPollas = input.leagues.length;
    const pollasWithPrediction = input.leagues.filter(l => l.hasPrediction).length;
    const pollasPending = totalPollas - pollasWithPrediction;

    const summary = pollasPending === 0
      ? `Tus pronósticos están guardados en ${totalPollas} polla${totalPollas > 1 ? 's' : ''}. La ventana cierra en ${input.closeMinutes} minutos.`
      : `Quedan ${input.closeMinutes} minutos. Tienes ${pollasPending} polla${pollasPending > 1 ? 's' : ''} pendiente${pollasPending > 1 ? 's' : ''}.`;

    return this.buildMultiLeagueMessage({
      subject: `${title}: ${input.homeTeam} vs ${input.awayTeam}`,
      eyebrow: 'Cierre de predicciones',
      heading: `${input.homeTeam} vs ${input.awayTeam}`,
      summary,
      matchInfo: [
        `Partido: ${formatDateTime(input.matchDate)}`,
        `Cierre en: ${input.closeMinutes} minutos`,
        `Participas en ${totalPollas} polla${totalPollas > 1 ? 's' : ''}`,
      ],
      leagues: input.leagues,
      ctaLabel: pollasPending > 0 ? 'Pronosticar ahora' : 'Ver pronósticos',
      accentColor: '#7c3aed',
      textLines: [title, `${input.homeTeam} vs ${input.awayTeam}`, summary],
    });
  }

  buildResultSummaryEmail(input: ResultEmailInput): EmailMessageContent {
    const score = `${input.homeScore ?? '-'}-${input.awayScore ?? '-'}`;
    const title = input.points >= 5 ? '?? Resultado final y puntaje' : '? Resultado final del partido';
    const summary = input.points >= 5
      ? `Acertaste el marcador y sumaste ${input.points} puntos.`
      : `Ya se public� el resultado final. Sumaste ${input.points} puntos.`;

    return this.buildMessage({
      subject: `${title}: ${input.homeTeam} ${score} ${input.awayTeam}`,
      eyebrow: 'Resultado publicado',
      heading: `${input.homeTeam} ${score} ${input.awayTeam}`,
      summary,
      details: [
        `Partido: ${formatDateTime(input.matchDate)}`,
        input.venue ? `Sede: ${input.venue}` : null,
        `Puntaje obtenido: ${input.points} pts`,
      ],
      ctaLabel: 'Ver clasificaci�n',
      accentColor: '#16a34a',
      textLines: [title, `${input.homeTeam} ${score} ${input.awayTeam}`, summary],
    });
  }

  private buildMultiLeagueMessage(options: {
    subject: string;
    eyebrow: string;
    heading: string;
    summary: string;
    matchInfo: Array<string | null>;
    leagues: LeagueSection[];
    ctaLabel: string;
    accentColor?: string;
    textLines: string[];
  }): EmailMessageContent {
    const accentColor = options.accentColor ?? '#2563eb';
    const matchInfo = options.matchInfo.filter(Boolean) as string[];
    const matchInfoItems = matchInfo
      .map((info) => `<li style="margin:0 0 8px;color:#334155;font-size:14px">${escapeHtml(info)}</li>`)
      .join('');

    // Generar secciones HTML por cada polla
    const leagueSections = options.leagues
      .map((league) => {
        const participantsList = league.participants
          .map((p) => {
            const icon = p.hasPrediction ? '✅' : '⏳';
            const status = p.hasPrediction ? 'color:#059669' : 'color:#dc2626';
            return `<li style="margin:0 0 6px;font-size:13px;color:#475569"><span style="${status}">${icon}</span> ${escapeHtml(p.name)}</li>`;
          })
          .join('');

        const statusIcon = league.hasPrediction ? '✅' : '⏳';
        const statusText = league.hasPrediction ? 'Pronóstico guardado' : 'Pendiente';
        const statusColor = league.hasPrediction ? '#059669' : '#dc2626';

        return `
    <div style="margin-bottom:20px;padding:18px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h3 style="margin:0;font-size:16px;font-weight:600;color:#0f172a">${escapeHtml(league.leagueName)}</h3>
        <span style="font-size:12px;color:${statusColor};font-weight:600">${statusIcon} ${statusText}</span>
      </div>
      <div style="margin-top:10px">
        <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Participantes:</p>
        <ul style="padding-left:0;list-style:none;margin:0">${participantsList}</ul>
      </div>
    </div>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,.12)">
    <div style="padding:28px 32px;background:${accentColor};color:#ffffff;">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;margin-bottom:12px">${escapeHtml(options.eyebrow)}</div>
      <h1 style="margin:0;font-size:28px;line-height:1.2">${escapeHtml(options.heading)}</h1>
      <p style="margin:14px 0 0;font-size:15px;line-height:1.6;opacity:.95">${escapeHtml(options.summary)}</p>
    </div>
    <div style="padding:28px 32px;">
      <ul style="padding-left:20px;margin:0 0 24px;">${matchInfoItems}</ul>

      <div style="margin-bottom:24px">
        <h2 style="margin:0 0 16px;font-size:18px;color:#0f172a">Tus Pollas</h2>
        ${leagueSections}
      </div>

      <div style="margin-top:24px;padding:16px;border-radius:14px;background:#eff6ff;color:#1e3a8a;font-size:13px;line-height:1.6;">
        ${escapeHtml(options.ctaLabel)} desde la app para revisar el detalle completo y la clasificación actualizada.
      </div>
    </div>
  </div>
</body>
</html>`;

    const leagueTexts = options.leagues
      .map((league) => {
        const status = league.hasPrediction ? '✅ Pronóstico guardado' : '⏳ Pendiente';
        const participants = league.participants
          .map((p) => `  ${p.hasPrediction ? '✅' : '⏳'} ${p.name}`)
          .join('\n');
        return `\n${league.leagueName} (${status})\nParticipantes:\n${participants}`;
      })
      .join('\n');

    const text = [...options.textLines, '', ...matchInfo, leagueTexts].join('\n');

    return {
      subject: options.subject,
      html,
      text,
    };
  }

  private buildMessage(options: {
    subject: string;
    eyebrow: string;
    heading: string;
    summary: string;
    details: Array<string | null>;
    ctaLabel: string;
    accentColor?: string;
    textLines: string[];
  }): EmailMessageContent {
    const accentColor = options.accentColor ?? '#2563eb';
    const details = options.details.filter(Boolean) as string[];
    const detailItems = details
      .map((detail) => `<li style="margin:0 0 8px;color:#334155;font-size:14px">${escapeHtml(detail)}</li>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,.12)">
    <div style="padding:28px 32px;background:${accentColor};color:#ffffff;">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;margin-bottom:12px">${escapeHtml(options.eyebrow)}</div>
      <h1 style="margin:0;font-size:28px;line-height:1.2">${escapeHtml(options.heading)}</h1>
      <p style="margin:14px 0 0;font-size:15px;line-height:1.6;opacity:.95">${escapeHtml(options.summary)}</p>
    </div>
    <div style="padding:28px 32px;">
      <ul style="padding-left:20px;margin:0 0 24px;">${detailItems}</ul>
      <div style="margin-top:24px;padding:16px;border-radius:14px;background:#eff6ff;color:#1e3a8a;font-size:13px;line-height:1.6;">
        ${escapeHtml(options.ctaLabel)} desde la app para revisar el detalle completo y la clasificaci�n actualizada.
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = [...options.textLines, '', ...details].join('\n');

    return {
      subject: options.subject,
      html,
      text,
    };
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
