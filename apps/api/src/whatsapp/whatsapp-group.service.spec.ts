import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappGroupJobType, WhatsappJobStatus } from '@prisma/client';
import { WhatsappGroupService } from './whatsapp-group.service';
import { WhatsappWebService } from './whatsapp-web.service';
import { WhatsappImageService } from './whatsapp-image.service';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionReportService } from '../prediction-report/prediction-report.service';

const mockPrisma = {
  league: {
    findUnique: jest.fn(),
  },
  whatsappGroupJob: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockWaWeb = {
  isConnected: jest.fn().mockReturnValue(true),
  sendToGroup: jest.fn().mockResolvedValue(undefined),
};

const mockWaImage = {
  buildResultsCard: jest.fn().mockResolvedValue(Buffer.from('img')),
  buildPredictionsCard: jest.fn().mockResolvedValue(Buffer.from('img')),
};

const mockReportService = {
  getResultsDataForLeague: jest.fn(),
  getPredictionsDataForLeague: jest.fn(),
  getResultsPdfBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf')),
  getPredictionsPdfBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf')),
};

describe('WhatsappGroupService', () => {
  let service: WhatsappGroupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappGroupService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WhatsappWebService, useValue: mockWaWeb },
        { provide: WhatsappImageService, useValue: mockWaImage },
        { provide: PredictionReportService, useValue: mockReportService },
      ],
    }).compile();

    service = module.get<WhatsappGroupService>(WhatsappGroupService);

    jest.clearAllMocks();
  });

  describe('enqueueForLeague', () => {
    it('skips when league has no whatsappGroupId', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ whatsappGroupId: null, name: 'L', code: 'L1' });

      await service.enqueueForLeague(WhatsappGroupJobType.RESULT_REPORT, 'm1', 'l1');

      expect(mockPrisma.whatsappGroupJob.upsert).not.toHaveBeenCalled();
    });

    it('creates job with dedupeKey when league has groupId', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ whatsappGroupId: 'g@g.us', name: 'Liga', code: 'LIG' });
      mockPrisma.whatsappGroupJob.upsert.mockResolvedValue({});

      await service.enqueueForLeague(WhatsappGroupJobType.RESULT_REPORT, 'm1', 'l1');

      expect(mockPrisma.whatsappGroupJob.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dedupeKey: 'RESULT_REPORT:m1:l1' },
          create: expect.objectContaining({
            dedupeKey: 'RESULT_REPORT:m1:l1',
            groupId: 'g@g.us',
            status: WhatsappJobStatus.PENDING,
          }),
          update: {},
        }),
      );
    });

    it('is idempotent — calling twice does not create duplicate', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ whatsappGroupId: 'g@g.us', name: 'Liga', code: 'LIG' });
      mockPrisma.whatsappGroupJob.upsert.mockResolvedValue({});

      await service.enqueueForLeague(WhatsappGroupJobType.PREDICTION_REPORT, 'm2', 'l2');
      await service.enqueueForLeague(WhatsappGroupJobType.PREDICTION_REPORT, 'm2', 'l2');

      expect(mockPrisma.whatsappGroupJob.upsert).toHaveBeenCalledTimes(2);
      // Both calls use update: {} so DB constraint prevents duplicate
      expect(mockPrisma.whatsappGroupJob.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      );
    });
  });

  describe('processJob', () => {
    const baseJob = {
      id: 'job1',
      status: WhatsappJobStatus.PENDING,
      type: WhatsappGroupJobType.RESULT_REPORT,
      matchId: 'm1',
      leagueId: 'l1',
      groupId: 'g@g.us',
      league: { name: 'Liga', code: 'LIG', whatsappGroupId: 'g@g.us' },
    };

    it('marks job SENT on success', async () => {
      mockPrisma.whatsappGroupJob.findUnique.mockResolvedValue(baseJob);
      mockPrisma.whatsappGroupJob.update.mockResolvedValue({});
      mockReportService.getResultsDataForLeague.mockResolvedValue({
        match: { homeTeam: 'A', awayTeam: 'B', matchDate: new Date(), homeScore: 1, awayScore: 0 },
        results: [{ name: 'Alice', newPosition: 1, pointsEarned: 10, outcome: 'WINNER', homeScore: 1, awayScore: 0, userId: 'u1', isAdmin: false, totalPoints: 10, prevPosition: 2, submittedAt: new Date(), email: 'a@b.com' }],
      });

      await service.processJob('job1');

      expect(mockPrisma.whatsappGroupJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job1' },
          data: expect.objectContaining({ status: WhatsappJobStatus.SENT }),
        }),
      );
    });

    it('marks job FAILED when sendToGroup throws', async () => {
      mockPrisma.whatsappGroupJob.findUnique.mockResolvedValue(baseJob);
      mockPrisma.whatsappGroupJob.update.mockResolvedValue({});
      mockReportService.getResultsDataForLeague.mockResolvedValue({
        match: { homeTeam: 'A', awayTeam: 'B', matchDate: new Date(), homeScore: 1, awayScore: 0 },
        results: [],
      });
      mockWaWeb.sendToGroup.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.processJob('job1')).rejects.toThrow('Network error');

      expect(mockPrisma.whatsappGroupJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: WhatsappJobStatus.FAILED,
            lastError: 'Network error',
          }),
        }),
      );
    });

    it('skips already SENT jobs', async () => {
      mockPrisma.whatsappGroupJob.findUnique.mockResolvedValue({
        ...baseJob,
        status: WhatsappJobStatus.SENT,
      });

      await service.processJob('job1');

      expect(mockReportService.getResultsDataForLeague).not.toHaveBeenCalled();
    });
  });

  describe('resetFailedJob', () => {
    it('sets status back to PENDING', async () => {
      mockPrisma.whatsappGroupJob.update.mockResolvedValue({});
      await service.resetFailedJob('job1');

      expect(mockPrisma.whatsappGroupJob.update).toHaveBeenCalledWith({
        where: { id: 'job1' },
        data: { status: WhatsappJobStatus.PENDING, lastError: null },
      });
    });
  });
});
