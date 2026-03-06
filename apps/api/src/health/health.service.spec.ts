import { ServiceUnavailableException } from '@nestjs/common';

jest.mock('../prisma/prisma.service', () => ({
    PrismaService: class PrismaService { },
}));

import { HealthService } from './health.service';

describe('HealthService', () => {
    const prismaServiceMock = {
        checkDatabaseConnectivity: jest.fn(),
    };

    let healthService: HealthService;

    beforeEach(() => {
        jest.clearAllMocks();
        healthService = new HealthService(prismaServiceMock as any);
    });

    it('returns deterministic liveness payload', () => {
        const response = healthService.getLiveness();

        expect(response.service).toBe('polla-api');
        expect(response.status).toBe('ok');
        expect(response.checks).toEqual({
            app: 'up',
            database: 'unknown',
        });
        expect(new Date(response.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('returns readiness ok when database is reachable', async () => {
        prismaServiceMock.checkDatabaseConnectivity.mockResolvedValue(true);

        const response = await healthService.getReadiness();

        expect(response.status).toBe('ok');
        expect(response.checks.database).toBe('up');
    });

    it('throws 503 readiness response when database is down', async () => {
        prismaServiceMock.checkDatabaseConnectivity.mockResolvedValue(false);

        await expect(healthService.getReadiness()).rejects.toThrow(ServiceUnavailableException);
    });
});
