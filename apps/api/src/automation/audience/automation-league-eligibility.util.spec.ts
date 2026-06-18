import { LeagueStatus } from '@prisma/client';
import {
  findLeaguesExcludedFromAutomation,
  formatAutomationExcludedLeaguesMessage,
} from './automation-league-eligibility.util';

describe('automation-league-eligibility.util', () => {
  it('detecta pollas SETUP vinculadas por torneo', async () => {
    const prisma = {
      leagueMatch: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      league: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'league-1' }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'league-1',
              code: 'POLLA26',
              name: 'Polla Mundialista 2026',
              status: LeagueStatus.SETUP,
            },
          ]),
      },
    };

    const excluded = await findLeaguesExcludedFromAutomation(prisma as any, {
      matchId: 'match-1',
      tournamentId: 'tournament-wc',
      predictionLeagueIds: [],
    });

    expect(excluded).toEqual([
      {
        id: 'league-1',
        code: 'POLLA26',
        name: 'Polla Mundialista 2026',
        status: LeagueStatus.SETUP,
      },
    ]);
  });

  it('formatea mensaje operativo para admin', () => {
    expect(
      formatAutomationExcludedLeaguesMessage([
        {
          id: '1',
          code: 'POLLA26',
          name: 'Polla',
          status: LeagueStatus.SETUP,
        },
      ]),
    ).toContain('solo corre en pollas ACTIVE');
  });
});
