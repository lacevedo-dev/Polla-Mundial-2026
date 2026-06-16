/** Zona horaria operativa de partidos y mensajes al participante. */
export const BOGOTA_TIMEZONE = 'America/Bogota';

export const BOGOTA_LOCALE = 'es-CO';

export const BOGOTA_TIME_LABEL = 'hora Bogotá';

export function formatMatchDateTimeBogota(value: Date): string {
  return value.toLocaleString(BOGOTA_LOCALE, {
    timeZone: BOGOTA_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatMatchTimeBogota(value: Date): string {
  return value.toLocaleTimeString(BOGOTA_LOCALE, {
    timeZone: BOGOTA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function getPredictionCloseDate(
  matchDate: Date,
  closeMinutes: number,
): Date {
  return new Date(matchDate.getTime() - closeMinutes * 60_000);
}

export function formatPredictionCloseDateTimeBogota(
  matchDate: Date,
  closeMinutes: number,
): string {
  return formatMatchDateTimeBogota(getPredictionCloseDate(matchDate, closeMinutes));
}

export function formatKickoffLineBogota(matchDate: Date): string {
  return `Inicio: ${formatMatchDateTimeBogota(matchDate)} (${BOGOTA_TIME_LABEL})`;
}

export function formatCloseLineBogota(
  matchDate: Date,
  closeMinutes: number,
): string {
  return `Cierre de predicciones: ${formatPredictionCloseDateTimeBogota(matchDate, closeMinutes)} (${BOGOTA_TIME_LABEL})`;
}

export function formatModifyUntilLineBogota(
  matchDate: Date,
  closeMinutes: number,
): string {
  return `Puedes modificar hasta ${formatPredictionCloseDateTimeBogota(matchDate, closeMinutes)} (${BOGOTA_TIME_LABEL}).`;
}
