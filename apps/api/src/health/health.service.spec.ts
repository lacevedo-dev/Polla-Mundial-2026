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
        prismaServiceMock.checkDatabaseConnectivity.mockResolvedValue({ ok: true });

        const response = await healthService.getReadiness();

        expect(response.status).toBe('ok');
        expect(response.checks.database).toBe('up');
        expect(response.diagnostics).toBeUndefined();
    });

    it('throws 503 readiness response with diagnostic category when database is down by quota', async () => {
        prismaServiceMock.checkDatabaseConnectivity.mockResolvedValue({
            ok: false,
            category: 'quota',
            message: 'Database user quota exceeded.',
        });

        await expect(healthService.getReadiness()).rejects.toMatchObject({
            response: expect.objectContaining({
                status: 'degraded',
                checks: {
                    app: 'up',
                    database: 'down',
                },
                diagnostics: {
                    databaseFailureCategory: 'quota',
                },
                message: 'Database connectivity check failed.',
            }),
        });
        await expect(healthService.getReadiness()).rejects.toThrow(ServiceUnavailableException);
    });
});
