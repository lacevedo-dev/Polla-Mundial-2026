import {
  formatCloseLineBogota,
  formatKickoffLineBogota,
  formatMatchDateTimeBogota,
  formatModifyUntilLineBogota,
  getPredictionCloseDate,
} from './automation-datetime.util';

describe('automation-datetime.util', () => {
  it('formatea fechas en zona America/Bogota', () => {
    // 2026-06-16 23:00:00 UTC = 18:00 Bogotá (UTC-5)
    const utcKickoff = new Date('2026-06-16T23:00:00.000Z');
    const label = formatMatchDateTimeBogota(utcKickoff);
    expect(label).toMatch(/18:00/);
    expect(label).not.toMatch(/23:00/);
  });

  it('calcula cierre de predicciones 15 min antes del inicio en Bogotá', () => {
    const kickoff = new Date('2026-06-16T23:00:00.000Z');
    const closeAt = getPredictionCloseDate(kickoff, 15);
    expect(formatMatchDateTimeBogota(closeAt)).toMatch(/17:45/);
  });

  it('incluye etiqueta hora Bogotá en líneas legibles', () => {
    const kickoff = new Date('2026-06-16T23:00:00.000Z');
    expect(formatKickoffLineBogota(kickoff)).toContain('hora Bogotá');
    expect(formatCloseLineBogota(kickoff, 15)).toContain('hora Bogotá');
    expect(formatModifyUntilLineBogota(kickoff, 15)).toContain('hora Bogotá');
  });
});
