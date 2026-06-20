import { describe, expect, it } from '@jest/globals';
import { parsePlayerProfileResponse, parseSquadPlayersResponse } from './player-profile.util';

describe('player-profile.util', () => {
  it('parses /players/profiles response', () => {
    const parsed = parsePlayerProfileResponse(123, {
      response: [
        {
          player: {
            id: 123,
            name: 'James Rodríguez',
            firstname: 'James',
            lastname: 'Rodríguez',
            nationality: 'Colombia',
            height: '180',
            weight: '77',
            photo: 'https://example.com/james.png',
            birth: { date: '1991-07-12' },
          },
        },
      ],
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        apiFootballPlayerId: 123,
        name: 'James Rodríguez',
        photoUrl: 'https://example.com/james.png',
        birthDate: '12-7-1991',
        height: '1,80 m',
        weight: '77 kg',
      }),
    );
  });

  it('parses squad players', () => {
    const players = parseSquadPlayersResponse({
      response: [
        {
          players: [
            { id: 10, name: 'Depay', number: 10, photo: 'https://x.png', nationality: 'Netherlands' },
          ],
        },
      ],
    });

    expect(players).toHaveLength(1);
    expect(players[0].apiFootballPlayerId).toBe(10);
    expect(players[0].jerseyNumber).toBe(10);
  });
});
