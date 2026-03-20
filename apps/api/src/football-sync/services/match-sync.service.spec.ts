import { Test, TestingModule } from '@nestjs/testing';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionsService } from '../../predictions/predictions.service';
import { ApiFootballClient } from './api-football-client.service';
import { RateLimiterService } from './rate-limiter.service';
import { SyncPlanService } from './sync-plan.service';
import { MatchSyncService } from './match-sync.service';

describe('MatchSyncService', () => {
  let service: MatchSyncService;

  const mockPrismaService = {
    match: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockApiFootballClient = {
    getFixturesByDate: jest.fn(),
    getLiveFixtures: jest.fn(),
    getFixtureById: jest.fn(),
  };

  const mockRateLimiterService = {
    canMakeRequest: jest.fn(),
    logRequest: jest.fn(),
  };

  const mockSyncPlanService = {
    updateLastSyncTime: jest.fn(),
    incrementRequestsUsed: jest.fn(),
  };

  const mockPredictionsService = {
    calculateMatchPoints: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchSyncService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ApiFootballClient, useValue: mockApiFootballClient },
        { provide: RateLimiterService, useValue: mockRateLimiterService },
        { provide: SyncPlanService, useValue: mockSyncPlanService },
        { provide: PredictionsService, useValue: mockPredictionsService },
      ],
    }).compile();

    service = module.get<MatchSyncService>(MatchSyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('backfills existing teams with canonical API-Football metadata', async () => {
    mockPrismaService.team.findMany.mockResolvedValue([
      {
        id: 'team-mex',
        name: 'Mexico',
        code: 'MEX',
        shortCode: null,
        apiFootballTeamId: null,
        flagUrl: null,
        group: null,
      },
    ]);
    mockPrismaService.team.update.mockResolvedValue({});
    mockPrismaService.team.create.mockResolvedValue({});

    const result = await service.backfillWorldCupTeams();

    expect(mockPrismaService.team.update).toHaveBeenCalledWith({
      where: { id: 'team-mex' },
      data: expect.objectContaining({
        name: 'México',
        code: 'MEX',
        shortCode: 'MEX',
        apiFootballTeamId: 16,
      }),
    });
    expect(result.updated).toBeGreaterThanOrEqual(1);
    expect(result.created).toBeGreaterThan(0);
  });

  it('remaps a fixture team using apiFootballTeamId during sync', async () => {
    mockRateLimiterService.canMakeRequest.mockResolvedValue(true);
    mockApiFootballClient.getFixturesByDate.mockResolvedValue({
      results: 1,
      response: [
        {
          fixture: {
            id: 999,
            status: { short: 'LIVE' },
          },
          teams: {
            home: {
              id: 10,
              name: 'England',
              logo: 'https://media.api-sports.io/football/teams/10.png',
              winner: null,
            },
            away: {
              id: 2,
              name: 'France',
              logo: 'https://media.api-sports.io/football/teams/2.png',
              winner: null,
            },
          },
          goals: {
            home: 1,
            away: 0,
          },
        },
      ],
    });
    mockPrismaService.match.findUnique.mockResolvedValue({
      id: 'match-1',
      externalId: '999',
      homeTeamId: 'legacy-home',
      awayTeamId: 'team-fra',
      homeScore: null,
      awayScore: null,
      homeTeam: {
        id: 'legacy-home',
        name: 'Gran Bretaña',
        code: 'GBR',
        shortCode: null,
        apiFootballTeamId: null,
        flagUrl: null,
        group: 'C',
      },
      awayTeam: {
        id: 'team-fra',
        name: 'Francia',
        code: 'FRA',
        shortCode: 'FRA',
        apiFootballTeamId: 2,
        flagUrl: 'https://media.api-sports.io/football/teams/2.png',
        group: 'B',
      },
    });
    mockPrismaService.team.findUnique
      .mockResolvedValueOnce({
        id: 'team-eng',
        name: 'Inglaterra',
        code: 'ENG',
        shortCode: 'ENG',
        apiFootballTeamId: 10,
        flagUrl: 'https://media.api-sports.io/football/teams/10.png',
        group: 'C',
      })
      .mockResolvedValueOnce({
        id: 'team-fra',
        name: 'Francia',
        code: 'FRA',
        shortCode: 'FRA',
        apiFootballTeamId: 2,
        flagUrl: 'https://media.api-sports.io/football/teams/2.png',
        group: 'B',
      });
    mockPrismaService.team.update.mockResolvedValue({});
    mockPrismaService.match.update.mockResolvedValue({
      id: 'match-1',
      status: MatchStatus.LIVE,
    });

    const result = await service.syncTodayMatches();

    expect(result.success).toBe(true);
    expect(mockPrismaService.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: expect.objectContaining({
        homeTeamId: 'team-eng',
        status: MatchStatus.LIVE,
        homeScore: 1,
        awayScore: 0,
      }),
    });
  });

  it('returns ranked fixture candidates for an unlinked match', async () => {
    mockRateLimiterService.canMakeRequest.mockResolvedValue(true);
    mockPrismaService.match.findUnique.mockResolvedValue({
      id: 'match-lookup',
      matchDate: new Date('2026-06-15T20:00:00.000Z'),
      homeTeam: {
        id: 'team-eng',
        name: 'Inglaterra',
        code: 'ENG',
        apiFootballTeamId: 10,
      },
      awayTeam: {
        id: 'team-fra',
        name: 'Francia',
        code: 'FRA',
        apiFootballTeamId: 2,
      },
    });
    mockApiFootballClient.getFixturesByDate.mockResolvedValue({
      results: 2,
      response: [
        {
          fixture: {
            id: 555,
            date: '2026-06-15T20:15:00.000Z',
            venue: { name: 'Metropolitano', city: 'Bogotá', id: 1 },
            status: { long: 'Not Started', short: 'NS', elapsed: null },
          },
          league: {
            id: 1,
            name: 'World Cup',
            country: 'World',
            logo: '',
            flag: null,
            season: 2026,
            round: 'Group Stage',
          },
          teams: {
            home: { id: 10, name: 'England', logo: '', winner: null },
            away: { id: 2, name: 'France', logo: '', winner: null },
          },
          goals: { home: null, away: null },
          score: {
            halftime: { home: null, away: null },
            fulltime: { home: null, away: null },
            extratime: { home: null, away: null },
            penalty: { home: null, away: null },
          },
        },
        {
          fixture: {
            id: 777,
            date: '2026-06-15T23:30:00.000Z',
            venue: { name: 'Otro estadio', city: 'Medellín', id: 2 },
            status: { long: 'Not Started', short: 'NS', elapsed: null },
          },
          league: {
            id: 1,
            name: 'World Cup',
            country: 'World',
            logo: '',
            flag: null,
            season: 2026,
            round: 'Group Stage',
          },
          teams: {
            home: { id: 999, name: 'Brazil', logo: '', winner: null },
            away: { id: 888, name: 'Argentina', logo: '', winner: null },
          },
          goals: { home: null, away: null },
          score: {
            halftime: { home: null, away: null },
            fulltime: { home: null, away: null },
            extratime: { home: null, away: null },
            penalty: { home: null, away: null },
          },
        },
      ],
    });

    const result = await service.findLinkCandidates('match-lookup');

    expect(result[0]).toEqual(
      expect.objectContaining({
        fixtureId: '555',
        confidence: 'high',
        homeTeam: 'England',
        awayTeam: 'France',
      }),
    );
    expect(result[0].reasons.length).toBeGreaterThan(0);
    expect(mockRateLimiterService.logRequest).toHaveBeenCalledWith(
      '/fixtures',
      expect.objectContaining({
        source: 'match-link-candidates',
        matchId: 'match-lookup',
      }),
      200,
      2,
    );
  });
});
