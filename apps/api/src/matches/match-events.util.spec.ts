import {
  buildMatchEventDedupeKey,
  computeAnnulledGoalKeysFromTimeline,
  computeScoreExcessAnnulments,
  dedupeMatchEvents,
  filterActiveGoalEventsFromTimeline,
  formatAnnulledReason,
  formatRedCardReason,
  goalIndexFromScore,
  isRedCardDetail,
  isYellowCardDetail,
  normalizeEventPlayerKey,
  parseGoalScoredJobDedupeKey,
  resolveGoalBeneficiaryIsHome,
  resolveGoalPlayerTeamIdForSticker,
  findGoalEventIndexForScore,
} from './match-events.util';

describe('match-events.util', () => {
  it('detecta tarjetas rojas directas y por doble amarilla', () => {
    expect(isRedCardDetail('Red Card')).toBe(true);
    expect(isRedCardDetail('Second Yellow card')).toBe(true);
    expect(isRedCardDetail('Yellow Card')).toBe(false);
  });

  it('detecta tarjetas amarillas sin confundirlas con rojas', () => {
    expect(isYellowCardDetail('Yellow Card')).toBe(true);
    expect(isYellowCardDetail('Red Card')).toBe(false);
    expect(isYellowCardDetail('Second Yellow card')).toBe(false);
  });

  it('formatea motivo de expulsión', () => {
    expect(formatRedCardReason('Second Yellow card')).toBe('doble amarilla');
    expect(formatRedCardReason('Red Card')).toBeNull();
  });

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

  it('asigna autogol al equipo que suma en el marcador (team del evento = beneficiario)', () => {
    expect(
      resolveGoalBeneficiaryIsHome(
        {
          type: 'Goal',
          detail: 'Own Goal',
          team: { id: 10 },
          player: { name: 'A. Khusanov' },
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
          team: { id: 20 },
          player: { name: 'Defensa visitante' },
        },
        10,
        20,
      ),
    ).toBe(false);
  });

  it('resolveGoalPlayerTeamIdForSticker usa el club del jugador en autogol', () => {
    const match = { homeTeamId: 'home', awayTeamId: 'away' };
    const ownGoalHomeBenefits = { teamId: 'home', detail: 'Own Goal' };

    expect(
      resolveGoalPlayerTeamIdForSticker(ownGoalHomeBenefits, match, {
        allGoals: [ownGoalHomeBenefits],
        goalIndex: 0,
        scoreAfterGoal: { homeScore: 1, awayScore: 0 },
      }),
    ).toBe('away');

    expect(
      resolveGoalPlayerTeamIdForSticker(
        { teamId: 'away', detail: 'Own Goal' },
        match,
        {
          allGoals: [{ teamId: 'away', detail: 'Own Goal' }],
          goalIndex: 0,
          scoreAfterGoal: { homeScore: 0, awayScore: 1 },
        },
      ),
    ).toBe('home');
  });

  it('findGoalEventIndexForScore ubica autogol Portugal 3-0 → 4-0', () => {
    const match = { homeTeamId: 'home', awayTeamId: 'away' };
    const goals = [
      { teamId: 'home', detail: 'Normal Goal' },
      { teamId: 'home', detail: 'Normal Goal' },
      { teamId: 'home', detail: 'Normal Goal' },
      {
        teamId: 'home',
        detail: 'Own Goal',
        playerName: 'A. Khusanov',
      },
    ];

    expect(
      findGoalEventIndexForScore(goals, match, { homeScore: 4, awayScore: 0 }),
    ).toBe(3);
    expect(
      findGoalEventIndexForScore(goals, match, { homeScore: 4, awayScore: 0 }, 'A. Khusanov'),
    ).toBe(3);
  });

  it('findGoalEventIndexForScore ubica el gol correcto en la línea temporal', () => {
    const match = { homeTeamId: 'home', awayTeamId: 'away' };
    const goals = [
      { teamId: 'home', detail: 'Normal Goal' },
      { teamId: 'away', detail: 'Normal Goal' },
    ];

    expect(findGoalEventIndexForScore(goals, match, { homeScore: 1, awayScore: 0 })).toBe(0);
    expect(findGoalEventIndexForScore(goals, match, { homeScore: 1, awayScore: 1 })).toBe(1);
    expect(findGoalEventIndexForScore(goals, match, { homeScore: 2, awayScore: 1 })).toBeNull();
  });

  it('parseGoalScoredJobDedupeKey acepta GOAL_STICKER', () => {
    expect(parseGoalScoredJobDedupeKey('GOAL_STICKER:m:l:2-1')).toEqual({
      homeScore: 2,
      awayScore: 1,
    });
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

  it('deduplica goles con teamId faltante en un registro', () => {
    const events = dedupeMatchEvents([
      {
        id: '1',
        type: 'GOAL',
        minute: 33,
        extraMin: null,
        teamId: null,
        playerName: 'L. Messi',
      },
      {
        id: '2',
        type: 'GOAL',
        minute: 33,
        extraMin: null,
        teamId: 'home',
        playerName: 'Messi',
        assistName: 'Alvarez',
      },
    ]);

    expect(events).toHaveLength(1);
    expect(events[0].teamId).toBe('home');
    expect(events[0].assistName).toBe('Alvarez');
  });

  it('deduplica goles del mismo jugador en minutos consecutivos', () => {
    const events = dedupeMatchEvents([
      {
        id: '1',
        type: 'GOAL',
        minute: 40,
        extraMin: null,
        teamId: 'away',
        playerName: 'Munoz',
      },
      {
        id: '2',
        type: 'GOAL',
        minute: 41,
        extraMin: null,
        teamId: 'away',
        playerName: 'Munoz',
      },
      {
        id: '3',
        type: 'GOAL',
        minute: 65,
        extraMin: null,
        teamId: 'away',
        playerName: 'Diaz',
      },
    ]);

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.minute)).toEqual([40, 65]);
  });

  it('parseGoalScoredJobDedupeKey extrae marcador del job WA', () => {
    expect(parseGoalScoredJobDedupeKey('GOAL_SCORED:m1:l1:0-3')).toEqual({
      homeScore: 0,
      awayScore: 3,
    });
    expect(parseGoalScoredJobDedupeKey('GOAL_SCORED:m1:l1:2-1')).toEqual({
      homeScore: 2,
      awayScore: 1,
    });
    expect(parseGoalScoredJobDedupeKey('OTHER:m1:l1')).toBeNull();
  });

  it('goalIndexFromScore mapea gol N al marcador acumulado', () => {
    expect(goalIndexFromScore(0, 1)).toBe(1);
    expect(goalIndexFromScore(0, 3)).toBe(3);
    expect(goalIndexFromScore(2, 1)).toBe(3);
  });

  it('filterActiveGoalEventsFromTimeline respeta skip para no repetir goleador', () => {
    const resolveTeamId = (apiTeamId: number | undefined | null) =>
      apiTeamId === 10 ? 'home' : apiTeamId === 20 ? 'away' : null;

    const timeline = [
      {
        type: 'Goal',
        detail: 'Normal Goal',
        time: { elapsed: 4 },
        team: { id: 20 },
        player: { name: 'D. Kamada' },
      },
      {
        type: 'Goal',
        detail: 'Normal Goal',
        time: { elapsed: 31 },
        team: { id: 20 },
        player: { name: 'A. Ueda' },
      },
    ];

    expect(
      filterActiveGoalEventsFromTimeline(
        timeline,
        resolveTeamId,
        1,
        10,
        20,
        0,
      ),
    ).toEqual([
      expect.objectContaining({ playerName: 'D. Kamada', minute: 4 }),
    ]);

    expect(
      filterActiveGoalEventsFromTimeline(
        timeline,
        resolveTeamId,
        1,
        10,
        20,
        1,
      ),
    ).toEqual([
      expect.objectContaining({ playerName: 'A. Ueda', minute: 31 }),
    ]);
  });
});
