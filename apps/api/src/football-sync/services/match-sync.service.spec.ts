import { Test, TestingModule } from '@nestjs/testing';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionsService } from '../../predictions/predictions.service';
import { ApiFootballClient } from './api-football-client.service';
import { ConfigService as FootballConfigService } from './config.service';
import { RateLimiterService } from './rate-limiter.service';
import { SyncPlanService } from './sync-plan.service';
import { MatchSyncService } from './match-sync.service';
import { MonitoringService } from './monitoring.service';
import { PredictionReportService } from '../../prediction-report/prediction-report.service';
import { SyncEventsService } from './sync-events.service';
import { PushNotificationsService } from '../../push-notifications/push-notifications.service';
import { NotificationsService } from '../../notifications/notifications.service';

describe('MatchSyncService', () => {
  let service: MatchSyncService;

  const mockPrismaService = {
    match: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
    getFixtureEvents: jest.fn(),
  };

  const mockRateLimiterService = {
    canMakeRequest: jest.fn(),
    canMakeRequests: jest.fn(),
    logRequest: jest.fn(),
  };

  const mockFootballConfigService = {
    isEventSyncEnabled: jest.fn(),
  };

  const mockSyncPlanService = {
    getCarryOverMatches: jest.fn(),
    updateLastSyncTime: jest.fn(),
    incrementRequestsUsed: jest.fn(),
  };

  const mockPredictionsService = {
    calculateMatchPoints: jest.fn(),
    calculatePhaseBonuses: jest.fn(),
  };

  const mockMonitoringService = {
    createLog: jest.fn(),
    createAlert: jest.fn(),
  };

  const mockPredictionReportService = {
    sendMatchResultsReport: jest.fn(),
  };

  const mockSyncEventsService = {
    emit: jest.fn(),
  };

  const mockPushNotificationsService = {
    sendMulticast: jest.fn(),
    sendToUser: jest.fn(),
  };

  const mockNotificationsService = {
    createInAppNotification: jest.fn(),
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
        { provide: MonitoringService, useValue: mockMonitoringService },
        { provide: PredictionReportService, useValue: mockPredictionReportService },
        { provide: SyncEventsService, useValue: mockSyncEventsService },
        { provide: FootballConfigService, useValue: mockFootballConfigService },
        { provide: PushNotificationsService, useValue: mockPushNotificationsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<MatchSyncService>(MatchSyncService);
    mockFootballConfigService.isEventSyncEnabled.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a success monitoring log after syncing today matches', async () => {
    mockRateLimiterService.canMakeRequests.mockResolvedValue(true);
    mockSyncPlanService.getCarryOverMatches.mockResolvedValue([]);
    mockPrismaService.match.findMany.mockResolvedValue([]);
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

    await service.syncTodayMatchesForTrigger({
      logType: 'MANUAL_SYNC' as any,
      summaryLabel: 'Manual sync',
      triggeredBy: 'manual',
    });

    expect(mockMonitoringService.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MANUAL_SYNC',
        status: 'SUCCESS',
        matchesUpdated: 1,
        requestsUsed: 1,
      }),
    );
  });

  it('recovers a force-closed match: clears resultNotificationSentAt and recalculates points when the API reports a final score', async () => {
    mockRateLimiterService.canMakeRequests.mockResolvedValue(true);
    mockSyncPlanService.getCarryOverMatches.mockResolvedValue([
      { externalId: '777' },
    ]);
    mockPrismaService.match.findMany.mockResolvedValue([]);
    mockApiFootballClient.getFixturesByDate.mockResolvedValue({
      results: 1,
      response: [
        {
          fixture: { id: 777, status: { short: 'FT', elapsed: 90 } },
          teams: {
            home: { id: 10, name: 'England', logo: '', winner: true },
            away: { id: 2, name: 'France', logo: '', winner: false },
          },
          goals: { home: 2, away: 1 },
        },
      ],
    });
    mockPrismaService.match.findUnique.mockResolvedValue({
      id: 'match-stale',
      externalId: '777',
      homeTeamId: 'team-eng',
      awayTeamId: 'team-fra',
      homeScore: null,
      awayScore: null,
      status: MatchStatus.FINISHED,
      statusShort: null,
      eventsNoDataAt: null,
      // Force-closed earlier without a real score.
      resultNotificationSentAt: new Date('2026-06-11T20:00:00.000Z'),
      matchDate: new Date('2026-06-11T17:00:00.000Z'),
      phase: 'GROUP',
      homeTeam: {
        id: 'team-eng',
        name: 'Inglaterra',
        code: 'ENG',
        shortCode: 'ENG',
        apiFootballTeamId: 10,
        flagUrl: null,
        group: 'C',
      },
      awayTeam: {
        id: 'team-fra',
        name: 'Francia',
        code: 'FRA',
        shortCode: 'FRA',
        apiFootballTeamId: 2,
        flagUrl: null,
        group: 'C',
      },
    });
    mockPrismaService.team.findUnique
      .mockResolvedValueOnce({
        id: 'team-eng',
        name: 'Inglaterra',
        code: 'ENG',
        shortCode: 'ENG',
        apiFootballTeamId: 10,
        flagUrl: null,
        group: 'C',
      })
      .mockResolvedValueOnce({
        id: 'team-fra',
        name: 'Francia',
        code: 'FRA',
        shortCode: 'FRA',
        apiFootballTeamId: 2,
        flagUrl: null,
        group: 'C',
      });
    mockPrismaService.team.update.mockResolvedValue({});
    mockPrismaService.match.update.mockResolvedValue({
      id: 'match-stale',
      status: MatchStatus.FINISHED,
      homeTeamId: 'team-eng',
      awayTeamId: 'team-fra',
    });

    await service.syncTodayMatchesForTrigger({
      logType: 'CRON_SYNC' as any,
      summaryLabel: 'Cron sync',
      triggeredBy: 'scheduler',
    });

    expect(mockPrismaService.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'match-stale' },
        data: expect.objectContaining({
          resultNotificationSentAt: null,
          homeScore: 2,
          awayScore: 1,
          status: MatchStatus.FINISHED,
        }),
      }),
    );
    expect(mockPredictionsService.calculateMatchPoints).toHaveBeenCalledWith(
      'match-stale',
    );
  });

  it('marks a fixture as no-data when events return only non-useful payloads', async () => {
    mockRateLimiterService.canMakeRequests.mockResolvedValue(true);
    mockRateLimiterService.canMakeRequest.mockResolvedValue(true);
    mockFootballConfigService.isEventSyncEnabled.mockResolvedValue(true);
    mockSyncPlanService.getCarryOverMatches.mockResolvedValue([]);
    mockPrismaService.match.findMany.mockResolvedValue([]);
    mockApiFootballClient.getFixturesByDate.mockResolvedValue({
      results: 1,
      response: [
        {
          fixture: {
            id: 999,
            status: { short: 'HT' },
          },
          teams: {
            home: {
              id: 999,
              name: 'England',
              logo: 'https://media.api-sports.io/football/teams/999.png',
              winner: null,
            },
            away: {
              id: 888,
              name: 'France',
              logo: 'https://media.api-sports.io/football/teams/888.png',
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
    mockApiFootballClient.getFixtureEvents.mockResolvedValue({
      results: 1,
      response: [
        {
          type: 'Substitution',
          detail: 'Substitution',
          time: { elapsed: 48, extra: null },
          player: { name: 'John Doe' },
          assist: { name: null },
        },
      ],
    });
    mockPrismaService.match.findUnique.mockResolvedValue({
      id: 'match-1',
      externalId: '999',
      homeTeamId: 'team-eng',
      awayTeamId: 'team-fra',
      homeScore: null,
      awayScore: null,
      statusShort: 'LIVE',
      eventsNoDataAt: null,
      homeTeam: {
        id: 'team-eng',
        name: 'England',
        code: 'ENG',
        shortCode: 'ENG',
        apiFootballTeamId: 999,
        flagUrl: null,
        group: 'C',
      },
      awayTeam: {
        id: 'team-fra',
        name: 'France',
        code: 'FRA',
        shortCode: 'FRA',
        apiFootballTeamId: 888,
        flagUrl: null,
        group: 'B',
      },
    });
    mockPrismaService.team.findUnique.mockResolvedValue(null);
    mockPrismaService.match.update.mockResolvedValue({
      id: 'match-1',
      status: MatchStatus.LIVE,
    });

    await service.syncTodayMatchesForTrigger({
      logType: 'MANUAL_SYNC' as any,
      summaryLabel: 'Manual sync',
      triggeredBy: 'manual',
    });

    expect(mockPrismaService.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'match-1' },
        data: expect.objectContaining({
          eventsNoDataAt: expect.any(Date),
        }),
      }),
    );
  });

  it('skips fixture event queries when event sync is disabled in config', async () => {
    mockRateLimiterService.canMakeRequests.mockResolvedValue(true);
    mockFootballConfigService.isEventSyncEnabled.mockResolvedValue(false);
    mockSyncPlanService.getCarryOverMatches.mockResolvedValue([]);
    mockPrismaService.match.findMany.mockResolvedValue([]);
    mockApiFootballClient.getFixturesByDate.mockResolvedValue({
      results: 1,
      response: [
        {
          fixture: {
            id: 999,
            status: { short: 'HT' },
          },
          teams: {
            home: {
              id: 999,
              name: 'England',
              logo: 'https://media.api-sports.io/football/teams/999.png',
              winner: null,
            },
            away: {
              id: 888,
              name: 'France',
              logo: 'https://media.api-sports.io/football/teams/888.png',
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
      homeTeamId: 'team-eng',
      awayTeamId: 'team-fra',
      homeScore: null,
      awayScore: null,
      statusShort: 'LIVE',
      eventsNoDataAt: null,
      homeTeam: {
        id: 'team-eng',
        name: 'England',
        code: 'ENG',
        shortCode: 'ENG',
        apiFootballTeamId: 999,
        flagUrl: null,
        group: 'C',
      },
      awayTeam: {
        id: 'team-fra',
        name: 'France',
        code: 'FRA',
        shortCode: 'FRA',
        apiFootballTeamId: 888,
        flagUrl: null,
        group: 'B',
      },
    });
    mockPrismaService.team.findUnique.mockResolvedValue(null);
    mockPrismaService.match.update.mockResolvedValue({
      id: 'match-1',
      status: MatchStatus.LIVE,
    });

    await service.syncTodayMatchesForTrigger({
      logType: 'MANUAL_SYNC' as any,
      summaryLabel: 'Manual sync',
      triggeredBy: 'manual',
    });

    expect(mockApiFootballClient.getFixtureEvents).not.toHaveBeenCalled();
    expect(mockRateLimiterService.canMakeRequest).not.toHaveBeenCalled();
  });

  it('skips fixture event queries when the remaining request budget is exhausted', async () => {
    mockRateLimiterService.canMakeRequests.mockResolvedValue(true);
    mockRateLimiterService.canMakeRequest.mockResolvedValue(false);
    mockFootballConfigService.isEventSyncEnabled.mockResolvedValue(true);
    mockSyncPlanService.getCarryOverMatches.mockResolvedValue([]);
    mockPrismaService.match.findMany.mockResolvedValue([]);
    mockApiFootballClient.getFixturesByDate.mockResolvedValue({
      results: 1,
      response: [
        {
          fixture: {
            id: 999,
            status: { short: 'HT' },
          },
          teams: {
            home: {
              id: 999,
              name: 'England',
              logo: 'https://media.api-sports.io/football/teams/999.png',
              winner: null,
            },
            away: {
              id: 888,
              name: 'France',
              logo: 'https://media.api-sports.io/football/teams/888.png',
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
      homeTeamId: 'team-eng',
      awayTeamId: 'team-fra',
      homeScore: null,
      awayScore: null,
      statusShort: 'LIVE',
      eventsNoDataAt: null,
      homeTeam: {
        id: 'team-eng',
        name: 'England',
        code: 'ENG',
        shortCode: 'ENG',
        apiFootballTeamId: 999,
        flagUrl: null,
        group: 'C',
      },
      awayTeam: {
        id: 'team-fra',
        name: 'France',
        code: 'FRA',
        shortCode: 'FRA',
        apiFootballTeamId: 888,
        flagUrl: null,
        group: 'B',
      },
    });
    mockPrismaService.team.findUnique.mockResolvedValue(null);
    mockPrismaService.match.update.mockResolvedValue({
      id: 'match-1',
      status: MatchStatus.LIVE,
    });

    await service.syncTodayMatchesForTrigger({
      logType: 'MANUAL_SYNC' as any,
      summaryLabel: 'Manual sync',
      triggeredBy: 'manual',
    });

    expect(mockRateLimiterService.canMakeRequest).toHaveBeenCalledTimes(1);
    expect(mockApiFootballClient.getFixtureEvents).not.toHaveBeenCalled();
  });

  it('creates skip log and rate-limit alert when today sync cannot run', async () => {
    mockSyncPlanService.getCarryOverMatches.mockResolvedValue([]);
    mockRateLimiterService.canMakeRequests.mockResolvedValue(false);

    const result = await service.syncTodayMatchesForTrigger({
      logType: 'CRON_SYNC' as any,
      summaryLabel: 'Cron sync',
      triggeredBy: 'scheduler',
    });

    expect(result.success).toBe(false);
    expect(mockMonitoringService.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CRON_SYNC',
        status: 'SKIPPED',
      }),
    );
    expect(mockMonitoringService.createAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RATE_LIMIT_EXCEEDED',
      }),
    );
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
    mockRateLimiterService.canMakeRequests.mockResolvedValue(true);
    mockSyncPlanService.getCarryOverMatches.mockResolvedValue([]);
    mockPrismaService.match.findMany.mockResolvedValue([]);
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

  it('syncs a linked match even if canonical team metadata refresh conflicts with an existing local team', async () => {
    mockRateLimiterService.canMakeRequest.mockResolvedValue(true);
    mockApiFootballClient.getFixtureById.mockResolvedValue({
      results: 1,
      response: [
        {
          fixture: {
            id: 1538999,
            date: '2026-06-12T02:00:00.000Z',
            timestamp: 1781229600,
            venue: { name: 'Estadio Akron', city: 'Guadalajara', id: 1076 },
            status: { long: 'Not Started', short: 'NS', elapsed: null },
          },
          league: {
            id: 1,
            name: 'World Cup',
            country: 'World',
            logo: '',
            flag: null,
            season: 2026,
            round: 'Group Stage - 1',
          },
          teams: {
            home: {
              id: 17,
              name: 'South Korea',
              logo: 'https://media.api-sports.io/football/teams/17.png',
              winner: null,
            },
            away: {
              id: 770,
              name: 'Czech Republic',
              logo: 'https://media.api-sports.io/football/teams/770.png',
              winner: null,
            },
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
    mockPrismaService.match.findUnique
      .mockResolvedValueOnce({
        id: 'match-kor-cze',
        externalId: '1538999',
      })
      .mockResolvedValueOnce({
        id: 'match-kor-cze',
        externalId: '1538999',
        homeTeamId: 'team-kor-local',
        awayTeamId: 'team-cze-local',
        homeScore: null,
        awayScore: null,
        status: MatchStatus.SCHEDULED,
        statusShort: null,
        eventsNoDataAt: null,
        resultNotificationSentAt: null,
        matchDate: new Date('2026-06-12T07:00:00.000Z'),
        phase: 'GROUP',
        homeTeam: {
          id: 'team-kor-local',
          name: 'República de Corea',
          code: 'KOR',
          shortCode: 'KOR',
          apiFootballTeamId: null,
          flagUrl: 'https://flagcdn.com/w80/kr.png',
          group: 'A',
        },
        awayTeam: {
          id: 'team-cze-local',
          name: 'República Checa',
          code: 'CZE',
          shortCode: 'CZE',
          apiFootballTeamId: null,
          flagUrl: 'https://flagcdn.com/w80/cz.png',
          group: 'A',
        },
      });
    mockPrismaService.team.findUnique
      .mockResolvedValueOnce({
        id: 'team-kor-api',
        name: 'South Korea',
        code: 'SOU',
        shortCode: 'SOU',
        apiFootballTeamId: 17,
        flagUrl: 'https://media.api-sports.io/football/teams/17.png',
        group: null,
      })
      .mockResolvedValueOnce({
        id: 'team-cze-api',
        name: 'Czech Republic',
        code: 'CZ1',
        shortCode: 'CZE',
        apiFootballTeamId: 770,
        flagUrl: 'https://media.api-sports.io/football/teams/770.png',
        group: null,
      });
    mockPrismaService.team.update
      .mockRejectedValueOnce(new Error('Unique constraint failed on Team.code'))
      .mockResolvedValueOnce({});
    mockPrismaService.match.update.mockResolvedValue({
      id: 'match-kor-cze',
      status: MatchStatus.SCHEDULED,
      homeTeamId: 'team-kor-api',
      awayTeamId: 'team-cze-api',
    });

    await expect(service.syncMatchById('match-kor-cze')).resolves.toBe(true);

    expect(mockPrismaService.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'match-kor-cze' },
        data: expect.objectContaining({
          homeTeamId: 'team-kor-api',
          awayTeamId: 'team-cze-api',
          status: MatchStatus.SCHEDULED,
          statusShort: 'NS',
        }),
      }),
    );
    expect(mockMonitoringService.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MATCH_SYNC',
        status: 'SUCCESS',
        matchId: 'match-kor-cze',
        externalId: '1538999',
      }),
    );
  });
});
