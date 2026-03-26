jest.mock('../prisma/prisma.service', () => ({
    PrismaService: class PrismaService { },
}));

import { MemberStatus, Phase, ScoringType } from '@prisma/client';
import { PredictionsService } from './predictions.service';

describe('PredictionsService', () => {
    const scoringRules = [
        { ruleType: ScoringType.EXACT_SCORE,       points: 5 },
        { ruleType: ScoringType.CORRECT_WINNER,    points: 2 },
        { ruleType: ScoringType.TEAM_GOALS,        points: 1 },
        { ruleType: ScoringType.UNIQUE_PREDICTION, points: 5 },
    ];

    const createService = (prismaMock: any = {}) => new PredictionsService(prismaMock as any);

    describe('calculatePointsForOne — reglas de puntuación', () => {

        it('marcador exacto en fase de grupos: 5 pts', () => {
            const service = createService();
            const result = (service as any).calculatePointsForOne(
                { homeScore: 2, awayScore: 1, phase: Phase.GROUP },
                { homeScore: 2, awayScore: 1 },
                scoringRules,
            );
            expect(result.total).toBe(5);
            expect(result.detail.type).toBe('EXACT_SCORE');
            expect(result.detail.exactPoints).toBe(5);
            expect(result.detail.winnerPoints).toBe(0);
            expect(result.detail.goalPoints).toBe(0);
            expect(result.detail.multiplier).toBe(1);
        });

        it('ganador + gol acertado (CORRECT_WINNER_GOAL): 3 pts — ej: real 2-0, pred 1-0', () => {
            const service = createService();
            // Uruguay 2-0 France — Zidane predicts 1-0: home wins ✓, away goals 0=0 ✓
            const result = (service as any).calculatePointsForOne(
                { homeScore: 2, awayScore: 0, phase: Phase.GROUP },
                { homeScore: 1, awayScore: 0 },
                scoringRules,
            );
            expect(result.total).toBe(3);
            expect(result.detail.type).toBe('CORRECT_WINNER_GOAL');
            expect(result.detail.winnerPoints).toBe(2);
            expect(result.detail.goalPoints).toBe(1);
        });

        it('solo ganador acertado (CORRECT_WINNER): 2 pts — ej: real 2-0, pred 3-1', () => {
            const service = createService();
            // Both home wins, no goals match: 2≠3, 0≠1
            const result = (service as any).calculatePointsForOne(
                { homeScore: 2, awayScore: 0, phase: Phase.GROUP },
                { homeScore: 3, awayScore: 1 },
                scoringRules,
            );
            expect(result.total).toBe(2);
            expect(result.detail.type).toBe('CORRECT_WINNER');
            expect(result.detail.winnerPoints).toBe(2);
            expect(result.detail.goalPoints).toBe(0);
        });

        it('solo gol acertado (TEAM_GOALS): 1 pt — ej: real 2-0, pred 0-0', () => {
            const service = createService();
            // Winner wrong (draw vs home), away goals 0=0 ✓
            const result = (service as any).calculatePointsForOne(
                { homeScore: 2, awayScore: 0, phase: Phase.GROUP },
                { homeScore: 0, awayScore: 0 },
                scoringRules,
            );
            expect(result.total).toBe(1);
            expect(result.detail.type).toBe('TEAM_GOALS');
            expect(result.detail.winnerPoints).toBe(0);
            expect(result.detail.goalPoints).toBe(1);
        });

        it('ningún acierto (NONE): 0 pts', () => {
            const service = createService();
            const result = (service as any).calculatePointsForOne(
                { homeScore: 1, awayScore: 0, phase: Phase.GROUP },
                { homeScore: 0, awayScore: 1 },
                scoringRules,
            );
            expect(result.total).toBe(0);
            expect(result.detail.type).toBe('NONE');
        });

        it('ganador + gol en eliminatoria: aplica multiplicador x1.5 → (2+1)*1.5 = 4.5 pts', () => {
            const service = createService();
            // real 1-3, pred 1-2: away wins ✓, home goals 1=1 ✓
            const result = (service as any).calculatePointsForOne(
                { homeScore: 1, awayScore: 3, phase: Phase.ROUND_OF_16 },
                { homeScore: 1, awayScore: 2 },
                scoringRules,
            );
            expect(result.total).toBe(4.5);
            expect(result.detail.type).toBe('CORRECT_WINNER_GOAL');
            expect(result.detail.multiplier).toBe(1.5);
        });

        it('solo ganador en eliminatoria con multiplicador: 2*1.5 = 3 pts', () => {
            const service = createService();
            const result = (service as any).calculatePointsForOne(
                { homeScore: 1, awayScore: 0, phase: Phase.ROUND_OF_16 },
                { homeScore: 3, awayScore: 1 },
                scoringRules,
            );
            expect(result.total).toBe(3);
            expect(result.detail.type).toBe('CORRECT_WINNER');
            expect(result.detail.multiplier).toBe(1.5);
        });

        it('marcador exacto en cuartos aplica multiplicador x1.5: 5*1.5 = 7.5 pts', () => {
            const service = createService();
            const result = (service as any).calculatePointsForOne(
                { homeScore: 2, awayScore: 1, phase: Phase.QUARTER },
                { homeScore: 2, awayScore: 1 },
                scoringRules,
            );
            expect(result.total).toBe(7.5);
            expect(result.detail.type).toBe('EXACT_SCORE');
        });
    });

    describe('calculateMatchPoints — flujo completo', () => {
        it('no recalcula cuando el partido no tiene marcador', async () => {
            const prismaMock = {
                match: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 'match-null', homeScore: null, awayScore: null, phase: Phase.GROUP,
                    }),
                },
                prediction: { findMany: jest.fn(), update: jest.fn() },
            };
            const service = createService(prismaMock);
            await service.calculateMatchPoints('match-null');
            expect(prismaMock.prediction.findMany).not.toHaveBeenCalled();
        });

        it('persiste pointDetail correcto para partido de eliminatoria', async () => {
            const prismaMock = {
                match: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 'match-1', homeScore: 1, awayScore: 0, phase: Phase.ROUND_OF_16,
                    }),
                },
                prediction: {
                    findMany: jest.fn().mockResolvedValue([
                        {
                            id: 'pred-1', homeScore: 3, awayScore: 1, leagueId: 'league-1',
                            league: { scoringRules },
                        },
                    ]),
                    update: jest.fn().mockResolvedValue({}),
                },
            };
            const service = createService(prismaMock);
            await service.calculateMatchPoints('match-1');

            // real 1-0, pred 3-1 → home wins ✓, goals 1≠3, 0≠1 → CORRECT_WINNER x1.5 = 3 pts
            expect(prismaMock.prediction.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'pred-1' },
                    data: expect.objectContaining({
                        points: 3,
                    }),
                }),
            );
        });

        it('aplica bono único (UNIQUE_PREDICTION) cuando solo 1 persona acierta exacto', async () => {
            const prismaMock = {
                match: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 'match-2', homeScore: 2, awayScore: 0, phase: Phase.GROUP,
                    }),
                },
                prediction: {
                    findMany: jest.fn().mockResolvedValue([
                        {
                            id: 'pred-exact', homeScore: 2, awayScore: 0, leagueId: 'league-1',
                            league: { scoringRules },
                        },
                        {
                            id: 'pred-winner', homeScore: 3, awayScore: 1, leagueId: 'league-1',
                            league: { scoringRules },
                        },
                    ]),
                    update: jest.fn().mockResolvedValue({}),
                },
            };
            const service = createService(prismaMock);
            await service.calculateMatchPoints('match-2');

            // pred-exact: EXACT 5pts base → debe recibir +5 único → 10 pts total
            const calls = prismaMock.prediction.update.mock.calls;
            const exactCall = calls.find((c: any[]) => c[0].where.id === 'pred-exact' && c[0].data.points === 10);
            expect(exactCall).toBeDefined();
        });

        it('NO aplica bono único cuando 2 personas aciertan exacto', async () => {
            const prismaMock = {
                match: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 'match-3', homeScore: 2, awayScore: 0, phase: Phase.GROUP,
                    }),
                },
                prediction: {
                    findMany: jest.fn().mockResolvedValue([
                        {
                            id: 'pred-exact-1', homeScore: 2, awayScore: 0, leagueId: 'league-1',
                            league: { scoringRules },
                        },
                        {
                            id: 'pred-exact-2', homeScore: 2, awayScore: 0, leagueId: 'league-1',
                            league: { scoringRules },
                        },
                    ]),
                    update: jest.fn().mockResolvedValue({}),
                },
            };
            const service = createService(prismaMock);
            await service.calculateMatchPoints('match-3');

            // Ambos deben quedar en 5 pts, no en 10
            const calls = prismaMock.prediction.update.mock.calls;
            const bonusCall = calls.find((c: any[]) => c[0].data.points === 10);
            expect(bonusCall).toBeUndefined();
        });
    });

    describe('getLeaderboard ? criterios de desempate y filtros', () => {
        it('ordena por puntos descendente', async () => {
            const prismaMock = {
                leagueMember: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', user: { id: 'u1', username: 'ana', name: 'Ana', avatar: null } },
                        { userId: 'u2', user: { id: 'u2', username: 'beto', name: 'Beto', avatar: null } },
                    ]),
                },
                prediction: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', points: 3, pointDetail: null },
                        { userId: 'u2', points: 7, pointDetail: null },
                    ]),
                },
                phaseBonus: { findMany: jest.fn().mockResolvedValue([]) },
            };
            const service = createService(prismaMock);
            const lb = await service.getLeaderboard('league-1');
            expect(lb[0]).toMatchObject({ id: 'u2', points: 7 });
            expect(lb[1]).toMatchObject({ id: 'u1', points: 3 });
        });

        it('en empate de puntos, desempata por marcadores exactos', async () => {
            const detailExact = JSON.stringify({
                type: 'EXACT_SCORE', exactPoints: 5, winnerPoints: 0, goalPoints: 0,
                uniqueBonus: 0, basePoints: 5, phase: 'GROUP', multiplier: 1, total: 5,
            });
            const detailWinner = JSON.stringify({
                type: 'CORRECT_WINNER', exactPoints: 0, winnerPoints: 2, goalPoints: 0,
                uniqueBonus: 0, basePoints: 2, phase: 'GROUP', multiplier: 1, total: 2,
            });
            const prismaMock = {
                leagueMember: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', user: { id: 'u1', username: 'ana', name: 'Ana', avatar: null } },
                        { userId: 'u2', user: { id: 'u2', username: 'beto', name: 'Beto', avatar: null } },
                    ]),
                },
                prediction: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', matchId: 'm1', points: 5, pointDetail: detailExact, match: { group: 'A', phase: Phase.GROUP } },
                        { userId: 'u2', matchId: 'm2', points: 2, pointDetail: detailWinner, match: { group: 'A', phase: Phase.GROUP } },
                        { userId: 'u2', matchId: 'm3', points: 3, pointDetail: JSON.stringify({ type: 'CORRECT_WINNER_GOAL', exactPoints: 0, winnerPoints: 2, goalPoints: 1, uniqueBonus: 0, basePoints: 3, phase: 'GROUP', multiplier: 1, total: 3 }), match: { group: 'A', phase: Phase.GROUP } },
                    ]),
                },
                phaseBonus: { findMany: jest.fn().mockResolvedValue([]) },
            };
            const service = createService(prismaMock);
            const lb = await service.getLeaderboard('league-1');
            expect(lb[0]).toMatchObject({ id: 'u1', exactCount: 1 });
            expect(lb[1]).toMatchObject({ id: 'u2', exactCount: 0 });
        });

        it('filtra ranking por participaci?n por partido usando obligaciones pagadas', async () => {
            const prismaMock = {
                leagueMember: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', user: { id: 'u1', username: 'ana', name: 'Ana', avatar: null } },
                        { userId: 'u2', user: { id: 'u2', username: 'beto', name: 'Beto', avatar: null } },
                    ]),
                },
                participationObligation: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', matchId: 'm1', referenceId: 'm1' },
                    ]),
                },
                prediction: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', matchId: 'm1', points: 4, pointDetail: null, match: { group: 'A', phase: Phase.GROUP } },
                        { userId: 'u2', matchId: 'm1', points: 7, pointDetail: null, match: { group: 'A', phase: Phase.GROUP } },
                    ]),
                },
                phaseBonus: { findMany: jest.fn().mockResolvedValue([]) },
            };
            const service = createService(prismaMock);
            const lb = await service.getLeaderboard('league-1', 'MATCH');

            expect(prismaMock.participationObligation.findMany).toHaveBeenCalled();
            expect(lb).toHaveLength(1);
            expect(lb[0]).toMatchObject({ id: 'u1', points: 4 });
        });

        it('filtra ranking por ronda e incluye bonos de fase de esa ronda', async () => {
            const prismaMock = {
                leagueMember: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', user: { id: 'u1', username: 'ana', name: 'Ana', avatar: null } },
                    ]),
                },
                participationObligation: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', matchId: null, referenceId: Phase.ROUND_OF_16 },
                    ]),
                },
                prediction: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', matchId: 'm4', points: 6, pointDetail: null, match: { group: null, phase: Phase.ROUND_OF_16 } },
                    ]),
                },
                phaseBonus: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', points: 8, phase: Phase.ROUND_OF_16 },
                        { userId: 'u1', points: 5, phase: Phase.FINAL },
                    ]),
                },
            };
            const service = createService(prismaMock);
            const lb = await service.getLeaderboard('league-1', 'ROUND');

            expect(lb[0]).toMatchObject({ id: 'u1', points: 14, phaseBonusPoints: 8 });
        });
    });

    describe('getLeaderboardUserBreakdown', () => {
        it('devuelve el detalle por partido y bonos de un participante en la categoria activa', async () => {
            const prismaMock = {
                leagueMember: {
                    findUnique: jest.fn().mockResolvedValue({
                        userId: 'u1',
                        leagueId: 'league-1',
                        status: MemberStatus.ACTIVE,
                        user: { id: 'u1', username: 'ana', name: 'Ana', avatar: null },
                    }),
                },
                participationObligation: {
                    findMany: jest.fn().mockResolvedValue([
                        { userId: 'u1', matchId: 'm1', referenceId: 'm1' },
                    ]),
                },
                prediction: {
                    findMany: jest.fn().mockResolvedValue([
                        {
                            id: 'pred-1',
                            leagueId: 'league-1',
                            userId: 'u1',
                            matchId: 'm1',
                            points: 5,
                            pointDetail: JSON.stringify({
                                type: 'EXACT_SCORE',
                                exactPoints: 5,
                                winnerPoints: 0,
                                goalPoints: 0,
                                uniqueBonus: 0,
                                basePoints: 5,
                                phase: 'GROUP',
                                multiplier: 1,
                                total: 5,
                            }),
                            homeScore: 2,
                            awayScore: 1,
                            advanceTeamId: null,
                            submittedAt: new Date('2026-06-11T18:00:00.000Z'),
                            match: {
                                id: 'm1',
                                matchDate: new Date('2026-06-11T18:00:00.000Z'),
                                phase: Phase.GROUP,
                                group: 'A',
                                venue: 'Bogota',
                                homeScore: 2,
                                awayScore: 1,
                                homeTeam: { id: 't1', name: 'Colombia', code: 'CO', shortCode: 'COL', flagUrl: null },
                                awayTeam: { id: 't2', name: 'Argentina', code: 'AR', shortCode: 'ARG', flagUrl: null },
                            },
                        },
                    ]),
                },
                phaseBonus: {
                    findMany: jest.fn().mockResolvedValue([
                        { id: 'bonus-1', leagueId: 'league-1', userId: 'u1', phase: Phase.GROUP, points: 3, awardedAt: new Date('2026-06-12T18:00:00.000Z') },
                    ]),
                },
            };

            const service = createService(prismaMock);
            const breakdown = await service.getLeaderboardUserBreakdown('league-1', 'u1', 'MATCH');

            expect(prismaMock.participationObligation.findMany).toHaveBeenCalled();
            expect(breakdown.summary).toMatchObject({
                points: 5,
                exactCount: 1,
                phaseBonusPoints: 0,
            });
            expect(breakdown.matches[0]).toMatchObject({
                id: 'pred-1',
                points: 5,
                prediction: { homeScore: 2, awayScore: 1 },
            });
            expect(breakdown.bonuses).toEqual([]);
        });
    });
});
