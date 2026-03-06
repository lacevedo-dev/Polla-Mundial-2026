import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import type { HealthResponse } from './health.types';

@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) { }

    @Get('live')
    getLiveness(): HealthResponse {
        return this.healthService.getLiveness();
    }

    @Get('ready')
    async getReadiness(): Promise<HealthResponse> {
        return this.healthService.getReadiness();
    }
}
