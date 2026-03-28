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
      ? 'Tu pronóstico ya está guardado. Revisa el partido y prepárate para sumar puntos.'
      : 'Aún estás a tiempo de enviar tu pronóstico antes de que inicie el partido.';

    return this.buildMessage({
      subject: `${title}: ${input.homeTeam} vs ${input.awayTeam}`,
      eyebrow: 'Recordatorio de partido',
      heading: `${input.homeTeam} vs ${input.awayTeam}`,
      summary,
      details: [
        `Inicio: ${formatDateTime(input.matchDate)}`,
        input.venue ? `Sede: ${input.venue}` : null,
        input.hasPrediction ? 'Estado: pronóstico guardado ?' : 'Estado: pendiente de pronóstico',
      ],
      ctaLabel: input.hasPrediction ? 'Revisar mi pronóstico' : 'Enviar pronóstico',
      textLines: [title, `${input.homeTeam} vs ${input.awayTeam}`, summary],
    });
  }

  buildPredictionClosingEmail(input: ClosingEmailInput): EmailMessageContent {
    const title = '?? Las predicciones están por cerrar';
    const summary = input.hasPrediction
      ? `Tu pronóstico ya quedó guardado. La ventana cierra en ${input.closeMinutes} minutos.`
      : `Quedan ${input.closeMinutes} minutos para enviar tu pronóstico.`;

    return this.buildMessage({
      subject: `${title}: ${input.homeTeam} vs ${input.awayTeam}`,
      eyebrow: 'Cierre de predicciones',
      heading: `${input.homeTeam} vs ${input.awayTeam}`,
      summary,
      details: [
        `Partido: ${formatDateTime(input.matchDate)}`,
        `Cierre en: ${input.closeMinutes} minutos`,
        input.hasPrediction ? 'Estado: pronóstico confirmado ?' : 'Estado: pendiente de pronóstico',
      ],
      ctaLabel: input.hasPrediction ? 'Ver pronóstico' : 'Pronosticar ahora',
      accentColor: '#7c3aed',
      textLines: [title, `${input.homeTeam} vs ${input.awayTeam}`, summary],
    });
  }

  buildResultSummaryEmail(input: ResultEmailInput): EmailMessageContent {
    const score = `${input.homeScore ?? '-'}-${input.awayScore ?? '-'}`;
    const title = input.points >= 5 ? '?? Resultado final y puntaje' : '? Resultado final del partido';
    const summary = input.points >= 5
      ? `Acertaste el marcador y sumaste ${input.points} puntos.`
      : `Ya se publicó el resultado final. Sumaste ${input.points} puntos.`;

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
      ctaLabel: 'Ver clasificación',
      accentColor: '#16a34a',
      textLines: [title, `${input.homeTeam} ${score} ${input.awayTeam}`, summary],
    });
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
        ${escapeHtml(options.ctaLabel)} desde la app para revisar el detalle completo y la clasificación actualizada.
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
