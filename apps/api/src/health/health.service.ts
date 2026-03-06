import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthResponse, HealthStatus } from './health.types';

@Injectable()
export class HealthService {
    constructor(private readonly prismaService: PrismaService) { }

    getLiveness(): HealthResponse {
        return this.buildHealthResponse('ok', 'unknown');
    }

    async getReadiness(): Promise<HealthResponse> {
        const databaseConnectivity = await this.prismaService.checkDatabaseConnectivity();

        if (databaseConnectivity.ok) {
            return this.buildHealthResponse('ok', 'up');
        }

        throw new ServiceUnavailableException({
            ...this.buildHealthResponse('degraded', 'down', databaseConnectivity.category),
            message: 'Database connectivity check failed.',
        });
    }

    private buildHealthResponse(
        status: HealthStatus,
        databaseStatus: HealthResponse['checks']['database'],
        databaseFailureCategory?: NonNullable<HealthResponse['diagnostics']>['databaseFailureCategory'],
    ): HealthResponse {
        return {
            service: 'polla-api',
            status,
            timestamp: new Date().toISOString(),
            checks: {
                app: 'up',
                database: databaseStatus,
            },
            diagnostics: databaseFailureCategory ? {
                databaseFailureCategory,
            } : undefined,
        };
    }
}
