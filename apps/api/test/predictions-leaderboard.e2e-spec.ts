jest.mock('./../src/prisma/prisma.service', () => ({
    PrismaService: class PrismaService { },
}));

import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from './../src/auth/guards/jwt-auth.guard';
import { PredictionsController } from './../src/predictions/predictions.controller';
import { PredictionsService } from './../src/predictions/predictions.service';

class MockJwtAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        req.user = { userId: 'user-1' };
        return true;
    }
}

describe('Predictions leaderboard (e2e)', () => {
    let app: INestApplication<App>;
    const predictionsServiceMock = {
        upsertPrediction: jest.fn(),
        findByLeagueAndUser: jest.fn(),
        getLeaderboard: jest.fn(),
    };

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [PredictionsController],
            providers: [
                {
                    provide: PredictionsService,
                    useValue: predictionsServiceMock,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useClass(MockJwtAuthGuard)
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        jest.clearAllMocks();
        await app.close();
    });

    it('returns leaderboard preserving decimal points', async () => {
        predictionsServiceMock.getLeaderboard.mockResolvedValue([
            { id: 'u2', name: 'Beto', points: 4.5 },
            { id: 'u1', name: 'Ana', points: 3.25 },
        ]);

        await request(app.getHttpServer())
            .get('/predictions/leaderboard/league-1')
            .expect(200)
            .expect([
                { id: 'u2', name: 'Beto', points: 4.5 },
                { id: 'u1', name: 'Ana', points: 3.25 },
            ]);

        expect(predictionsServiceMock.getLeaderboard).toHaveBeenCalledWith('league-1');
    });
});
