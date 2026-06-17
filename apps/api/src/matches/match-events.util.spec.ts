import {
  buildMatchEventDedupeKey,
  computeAnnulledGoalKeysFromTimeline,
  computeScoreExcessAnnulments,
  dedupeMatchEvents,
  formatAnnulledReason,
  normalizeEventPlayerKey,
  resolveGoalBeneficiaryIsHome,
} from './match-events.util';

describe('match-events.util', () => {
  it('normaliza apellidos para comparar variantes del nombre', () => {
    expect(normalizeEventPlayerKey('Marco Schmid')).toBe('schmid');
    expect(normalizeEventPlayerKey('Schmid')).toBe('schmid');
  });

  it('detecta anulaciones VAR en la línea temporal', () => {
    const annulled = computeAnnulledGoalKeysFromTimeline(
      [
        {
          type: 'Goal',
          detail: 'Normal Goal',
          time: { elapsed: 20 },
          team: { id: 10 },
          player: { name: 'Marco Schmid' },
        },
        {
          type: 'Var',
          detail: 'Goal cancelled - offside',
          time: { elapsed: 22 },
          team: { id: 10 },
          player: { name: 'Marco Schmid' },
        },
      ],
      (apiTeamId) => (apiTeamId === 10 ? 'home-team' : null),
    );

    expect(annulled.size).toBe(1);
    expect(annulled.get(
      buildMatchEventDedupeKey({
        type: 'GOAL',
        minute: 20,
        extraMin: null,
        teamId: 'home-team',
        playerName: 'Marco Schmid',
      }),
    )).toBe('offside');
  });

  it('anula goles sobrantes cuando el marcador baja', () => {
    const goals = [
      {
        type: 'GOAL',
        minute: 20,
        extraMin: null,
        teamId: 'home',
        playerName: 'Schmid',
      },
      {
        type: 'GOAL',
        minute: 55,
        extraMin: null,
        teamId: 'home',
        playerName: 'Baumgartner',
      },
    ];

    const excess = computeScoreExcessAnnulments(goals, 'home', 'away', 1, 0, new Set());
    expect(excess.size).toBe(1);
    expect(excess.has(
      buildMatchEventDedupeKey({
        type: 'GOAL',
        minute: 55,
        extraMin: null,
        teamId: 'home',
        playerName: 'Baumgartner',
      }),
    )).toBe(true);
  });

  it('asigna autogol al equipo que suma en el marcador', () => {
    expect(
      resolveGoalBeneficiaryIsHome(
        {
          type: 'Goal',
          detail: 'Own Goal',
          team: { id: 20 },
          player: { name: 'Y. Al Arab' },
        },
        10,
        20,
      ),
    ).toBe(true);

    expect(
      resolveGoalBeneficiaryIsHome(
        {
          type: 'Goal',
          detail: 'Own Goal',
          team: { id: 10 },
          player: { name: 'Defensa local' },
        },
        10,
        20,
      ),
    ).toBe(false);
  });

  it('deduplica goles con el mismo minuto, equipo y apellido', () => {
    const events = dedupeMatchEvents([
      {
        id: '1',
        type: 'GOAL',
        minute: 20,
        extraMin: null,
        teamId: 'home',
        playerName: 'Marco Schmid',
      },
      {
        id: '2',
        type: 'GOAL',
        minute: 20,
        extraMin: null,
        teamId: 'home',
        playerName: 'Schmid',
      },
      {
        id: '3',
        type: 'GOAL',
        minute: 50,
        extraMin: null,
        teamId: 'away',
        playerName: 'Olwan',
      },
    ]);

    expect(events).toHaveLength(2);
    expect(events.map((event) => buildMatchEventDedupeKey(event))).toEqual([
      buildMatchEventDedupeKey({
        type: 'GOAL',
        minute: 20,
        extraMin: null,
        teamId: 'home',
        playerName: 'Schmid',
      }),
      buildMatchEventDedupeKey({
        type: 'GOAL',
        minute: 50,
        extraMin: null,
        teamId: 'away',
        playerName: 'Olwan',
      }),
    ]);
  });
});
