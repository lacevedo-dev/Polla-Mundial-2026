import { Test, TestingModule } from '@nestjs/testing';
import { CardLiveNotificationService } from './card-live-notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappGroupService } from '../../whatsapp/whatsapp-group.service';

describe('CardLiveNotificationService', () => {
  let service: CardLiveNotificationService;
  const mockPrisma = {
    prediction: { findMany: jest.fn() },
    league: { findMany: jest.fn() },
  };
  const mockWaGroup = {
    enqueueRedCardNotification: jest.fn(),
    enqueueYellowCardNotification: jest.fn(),
    enqueueSubstitutionNotification: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardLiveNotificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WhatsappGroupService, useValue: mockWaGroup },
      ],
    }).compile();

    service = module.get(CardLiveNotificationService);
  });

  it('skips when there are no predictions', async () => {
    mockPrisma.prediction.findMany.mockResolvedValue([]);

    await service.dispatchRedCard({
      matchId: 'm1',
      homeTeamName: 'A',
      awayTeamName: 'B',
      homeScore: 0,
      awayScore: 0,
      elapsed: 55,
      card: {
        playerName: 'Player',
        teamName: 'A',
        detail: 'Red Card',
        minute: 55,
        extraMin: null,
      },
    });

    expect(mockWaGroup.enqueueRedCardNotification).not.toHaveBeenCalled();
  });

  it('enqueues RED_CARD for each league with predictions', async () => {
    mockPrisma.prediction.findMany.mockResolvedValue([
      { leagueId: 'l1' },
      { leagueId: 'l2' },
    ]);
    mockPrisma.league.findMany.mockResolvedValue([
      { id: 'l1', name: 'Liga 1' },
      { id: 'l2', name: 'Liga 2' },
    ]);
    mockWaGroup.enqueueRedCardNotification.mockResolvedValue(true);

    await service.dispatchRedCard({
      matchId: 'm1',
      homeTeamName: 'A',
      awayTeamName: 'B',
      homeScore: 1,
      awayScore: 0,
      elapsed: 67,
      card: {
        playerName: 'Messi',
        teamName: 'A',
        detail: 'Red Card',
        minute: 67,
        extraMin: null,
      },
    });

    expect(mockWaGroup.enqueueRedCardNotification).toHaveBeenCalledTimes(2);
    expect(mockWaGroup.enqueueRedCardNotification).toHaveBeenCalledWith(
      'm1',
      'l1',
      expect.objectContaining({ playerName: 'Messi', leagueName: 'Liga 1' }),
    );
  });

  it('enqueues YELLOW_CARD for each league with predictions', async () => {
    mockPrisma.prediction.findMany.mockResolvedValue([{ leagueId: 'l1' }]);
    mockPrisma.league.findMany.mockResolvedValue([{ id: 'l1', name: 'Liga 1' }]);
    mockWaGroup.enqueueYellowCardNotification.mockResolvedValue(true);

    await service.dispatchYellowCard({
      matchId: 'm1',
      homeTeamName: 'A',
      awayTeamName: 'B',
      homeScore: 0,
      awayScore: 0,
      elapsed: 30,
      card: {
        playerName: 'Pérez',
        teamName: 'A',
        detail: 'Yellow Card',
        minute: 30,
        extraMin: null,
      },
    });

    expect(mockWaGroup.enqueueYellowCardNotification).toHaveBeenCalledTimes(1);
  });

  it('enqueues SUBSTITUTION for each league with predictions', async () => {
    mockPrisma.prediction.findMany.mockResolvedValue([{ leagueId: 'l1' }]);
    mockPrisma.league.findMany.mockResolvedValue([{ id: 'l1', name: 'Liga 1' }]);
    mockWaGroup.enqueueSubstitutionNotification.mockResolvedValue(true);

    await service.dispatchSubstitution({
      matchId: 'm1',
      homeTeamName: 'A',
      awayTeamName: 'B',
      homeScore: 1,
      awayScore: 1,
      elapsed: 70,
      substitution: {
        playerInName: 'García',
        playerOutName: 'López',
        teamName: 'A',
        minute: 70,
        extraMin: null,
      },
    });

    expect(mockWaGroup.enqueueSubstitutionNotification).toHaveBeenCalledTimes(1);
  });
});
