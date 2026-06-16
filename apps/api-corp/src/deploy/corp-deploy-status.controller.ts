import { Controller, Get } from '@nestjs/common';
import { readCorpBuildInfo, resolveCorpBuildCommit } from '../build-info';
import { CORP_BUILD_MARKER } from '../build-marker';

/**
 * Endpoint público para verificar si el contenedor en producción fue actualizado.
 * No requiere autenticación.
 */
@Controller()
export class CorpDeployStatusController {
    @Get('api-corp-version')
    getDeployStatus() {
        const buildInfo = readCorpBuildInfo();
        return {
            service: 'api-corp',
            buildMarker: CORP_BUILD_MARKER,
            deployStamp: process.env.CORP_DEPLOY_STAMP ?? null,
            buildGitCommit: resolveCorpBuildCommit(),
            builtAt: buildInfo?.builtAt ?? null,
            rankingBreakdown: buildInfo?.rankingBreakdown === true,
            routes: [
                'GET /corp/member-points/:userId',
                'GET /corp/ranking?breakdownUserId=:userId',
                'GET /corp/ranking/user/:userId/breakdown',
            ],
        };
    }

    @Get('corp-api-ping')
    ping() {
        return {
            ok: true,
            buildMarker: CORP_BUILD_MARKER,
            deployStamp: process.env.CORP_DEPLOY_STAMP ?? null,
        };
    }
}
