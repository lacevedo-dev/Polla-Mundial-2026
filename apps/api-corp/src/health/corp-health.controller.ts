import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@corp-api/prisma/prisma.service';
import { readCorpBuildInfo, resolveCorpBuildCommit } from '../build-info';

@Controller('health')
export class CorpHealthController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    async check() {
        const db = await this.prisma.checkDatabaseConnectivity();
        const buildInfo = readCorpBuildInfo();
        const rankingBreakdown = buildInfo?.rankingBreakdown === true;
        return {
            status: db.ok ? 'ok' : 'degraded',
            service: 'api-corp',
            version: process.env.npm_package_version ?? '0.0.1',
            buildGitCommit: resolveCorpBuildCommit(),
            builtAt: buildInfo?.builtAt ?? null,
            deployStamp: process.env.CORP_DEPLOY_STAMP ?? null,
            features: rankingBreakdown
                ? {
                    rankingBreakdown: true,
                    rankingBreakdownRoutes: [
                        'GET /corp/ranking/user/:userId/breakdown',
                        'GET /corp/ranking-breakdown/:userId',
                        'GET /predictions/leaderboard/:leagueId/user/:userId',
                    ],
                }
                : { rankingBreakdown: false },
            timestamp: new Date().toISOString(),
            database: db.ok ? 'connected' : 'error',
            mainApiUrl: process.env.MAIN_API_URL ?? 'not configured',
        };
    }
}
