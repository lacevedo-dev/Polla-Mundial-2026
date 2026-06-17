import { buildT60WaGroupCaption } from './pre-match-message.builder';

describe('buildT60WaGroupCaption', () => {
  const matchDate = new Date('2026-06-17T00:00:00.000Z');
  const base = {
    leagueName: 'Polla Mundial',
    homeTeam: 'Argentina',
    awayTeam: 'Argelia',
    matchDate,
    closeMinutes: 15,
    predictedCount: 8,
    totalMembers: 10,
  };

  it('usa tono grupal cuando todos pronosticaron', () => {
    const caption = buildT60WaGroupCaption({
      ...base,
      missingMembers: [],
    });

    expect(caption).toMatch(/Recordatorio T-60/);
    expect(caption).toMatch(/Todos los miembros activos del grupo/);
    expect(caption).toMatch(/15 min antes del inicio/);
    expect(caption).not.toMatch(/Te falta/i);
  });

  it('lista personas pendientes en el grupo', () => {
    const caption = buildT60WaGroupCaption({
      ...base,
      missingMembers: [
        { userId: 'u1', displayName: 'Ana' },
        { userId: 'u2', displayName: 'Luis' },
      ],
    });

    expect(caption).toMatch(/En este grupo falta pronosticar/);
    expect(caption).toMatch(/Ana/);
    expect(caption).toMatch(/Luis/);
    expect(caption).toMatch(/Plazo para enviar o cambiar/);
  });

  it('incluye hora programada del aviso T-60', () => {
    const caption = buildT60WaGroupCaption({
      ...base,
      missingMembers: [],
    });

    expect(caption).toMatch(/Aviso programado:/);
  });
});
