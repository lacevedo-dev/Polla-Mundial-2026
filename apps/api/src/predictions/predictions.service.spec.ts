jest.mock('../prisma/prisma.service', () => ({
    PrismaService: class PrismaService { },
}));

import { Phase, ScoringType } from '@prisma/client';
import { PredictionsService } from './predictions.service';

describe('PredictionsService', () => {
    const scoringRules = [
        { ruleType: ScoringType.EXACT_SCORE, points: 5 },
        { ruleType: ScoringType.CORRECT_DIFF, points: 3 },
        { ruleType: ScoringType.CORRECT_WINNER, points: 2 },
    ];

    const createService = (prismaMock: any = {}) => new PredictionsService(prismaMock as any);

    describe('calculatePointsForOne hierarchy', () => {
        it('awards exact score in group stage', () => {
            const service = createService();

            const result = (service as any).calculatePointsForOne(
                { homeScore: 2, awayScore: 1, phase: Phase.GROUP },
                { homeScore: 2, awayScore: 1 },
                scoringRules,
            );

            expect(result.total).toBe(5);
            expect(result.detail).toEqual({
                type: 'EXACT_SCORE',
                basePoints: 5,
                phase: Phase.GROUP,
                multiplier: 1,
            });
        });

        it('awards correct goal difference in group stage', () => {
            const service = createService();

            const result = (service as any).calculatePointsForOne(
                { homeScore: 3, awayScore: 1, phase: Phase.GROUP },
                { homeScore: 2, awayScore: 0 },
                scoringRules,
            );

            expect(result.total).toBe(3);
            expect(result.detail.type).toBe('CORRECT_DIFF');
        });

        it('awards winner points with knockout multiplier', () => {
            const service = createService();

            const result = (service as any).calculatePointsForOne(
                { homeScore: 1, awayScore: 0, phase: Phase.ROUND_OF_16 },
                { homeScore: 3, awayScore: 1 },
                scoringRules,
            );

            expect(result.total).toBe(3);
            expect(result.detail).toEqual({
                type: 'CORRECT_WINNER',
                basePoints: 2,
                phase: Phase.ROUND_OF_16,
                multiplier: 1.5,
            });
        });

        it('returns zero points when prediction misses result trend', () => {
            const service = createService();

            const result = (service as any).calculatePointsForOne(
                { homeScore: 1, awayScore: 0, phase: Phase.QUARTER },
                { homeScore: 0, awayScore: 1 },
                scoringRules,
            );

            expect(result.total).toBe(0);
            expect(result.detail.type).toBe('NONE');
            expect(result.detail.multiplier).toBe(1.5);
        });
    });

    describe('calculateMatchPoints', () => {
        it('skips recalculation when match is not finished (null scores)', async () => {
            const prismaMock = {
                match: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 'match-null',
                        homeScore: null,
                        awayScore: null,
                        phase: Phase.GROUP,
                    }),
                },
                prediction: {
                    findMany: jest.fn(),
                    update: jest.fn(),
                },
            };

            const service = createService(prismaMock);
            await service.calculateMatchPoints('match-null');

            expect(prismaMock.prediction.findMany).not.toHaveBeenCalled();
            expect(prismaMock.prediction.update).not.toHaveBeenCalled();
        });

        it('persists decimal-compatible point detail for a finished knockout match', async () => {
            const prismaMock = {
                match: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 'match-1',
                        homeScore: 1,
                        awayScore: 0,
                        phase: Phase.ROUND_OF_16,
                    }),
                },
                prediction: {
                    findMany: jest.fn().mockResolvedValue([
                        {
                            id: 'prediction-1',
                            homeScore: 3,
                            awayScore: 1,
                            league: { scoringRules },
                        },
                    ]),
                    update: jest.fn().mockResolvedValue({ id: 'prediction-1' }),
                },
            };

            const service = createService(prismaMock);

            await service.calculateMatchPoints('match-1');

            expect(prismaMock.prediction.update).toHaveBeenCalledWith({
                where: { id: 'prediction-1' },
                data: {
                    points: 3,
                    pointDetail: {
                        type: 'CORRECT_WINNER',
                        basePoints: 2,
                        phase: Phase.ROUND_OF_16,
                        multiplier: 1.5,
                    },
                },
            });
        });
    });

    describe('getLeaderboard', () => {
        it('orders users by decimal totals', async () => {
            const prismaMock = {
                leagueMember: {
                    findMany: jest.fn().mockResolvedValue([
                        {
                            userId: 'u1',
                            user: { id: 'u1', username: 'ana', name: 'Ana', avatar: null },
                        },
                        {
                            userId: 'u2',
                            user: { id: 'u2', username: 'beto', name: 'Beto', avatar: null },
                        },
                    ]),
                },
                prediction: {
                    groupBy: jest.fn().mockResolvedValue([
                        { userId: 'u1', _sum: { points: 3.25 } },
                        { userId: 'u2', _sum: { points: 4.5 } },
                    ]),
                },
            };

            const service = createService(prismaMock);
            const leaderboard = await service.getLeaderboard('league-1');

            expect(leaderboard[0]).toMatchObject({ id: 'u2', points: 4.5 });
            expect(leaderboard[1]).toMatchObject({ id: 'u1', points: 3.25 });
        });
    });
});
