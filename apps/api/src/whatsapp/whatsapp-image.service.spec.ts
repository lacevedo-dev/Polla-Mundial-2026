import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsappImageService } from './whatsapp-image.service';

// Mock puppeteer-core so tests don't need Chromium installed
const mockPage = {
  setViewport: jest.fn().mockResolvedValue(undefined),
  setContent: jest.fn().mockResolvedValue(undefined),
  evaluate: jest.fn().mockResolvedValue(600),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-png')),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('puppeteer-core', () => ({
  launch: jest.fn().mockResolvedValue(mockBrowser),
}));

describe('WhatsappImageService', () => {
  let service: WhatsappImageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappImageService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<WhatsappImageService>(WhatsappImageService);
    jest.clearAllMocks();
  });

  const matchResult = {
    homeTeam: 'Colombia',
    awayTeam: 'Brasil',
    matchDate: new Date('2026-06-15T20:00:00Z'),
    homeScore: 2,
    awayScore: 1,
  };

  it('buildResultsCard returns a Buffer', async () => {
    const buf = await service.buildResultsCard({
      match: matchResult,
      leagueName: 'Polla Mundial',
      leagueCode: 'PW26',
      results: [
        {
          userId: 'u1',
          name: 'Alice',
          email: 'a@b.com',
          isAdmin: false,
          homeScore: 2,
          awayScore: 1,
          submittedAt: new Date(),
          outcome: 'EXACT',
          pointsEarned: 15,
          totalPoints: 30,
          prevPosition: 2,
          newPosition: 1,
        },
      ],
      sentAt: new Date(),
    });

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('buildPredictionsCard returns a Buffer', async () => {
    const buf = await service.buildPredictionsCard({
      match: {
        homeTeam: 'Colombia',
        awayTeam: 'Brasil',
        matchDate: new Date('2026-06-15T20:00:00Z'),
      },
      leagueName: 'Polla Mundial',
      leagueCode: 'PW26',
      predictors: [
        { name: 'Alice', homeScore: 2, awayScore: 1, isAdmin: false },
        { name: 'Bob',   homeScore: 1, awayScore: 1, isAdmin: false },
      ],
      sentAt: new Date(),
    });

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('calls browser.close() even if screenshot throws', async () => {
    const puppeteer = require('puppeteer-core');
    const pageFailing = { ...mockPage, screenshot: jest.fn().mockRejectedValue(new Error('fail')) };
    const browserFailing = { newPage: jest.fn().mockResolvedValue(pageFailing), close: jest.fn().mockResolvedValue(undefined) };
    (puppeteer.launch as jest.Mock).mockResolvedValueOnce(browserFailing);

    await expect(
      service.buildResultsCard({
        match: matchResult,
        leagueName: 'L',
        leagueCode: 'L1',
        results: [],
        sentAt: new Date(),
      }),
    ).rejects.toThrow('fail');

    expect(browserFailing.close).toHaveBeenCalled();
  });
});
