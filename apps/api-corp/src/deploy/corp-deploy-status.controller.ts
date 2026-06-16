import { Controller, Get } from '@nestjs/common';
import { readCorpBuildInfo, resolveCorpBuildCommit } from '../build-info';

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
            buildGitCommit: resolveCorpBuildCommit(),
            builtAt: buildInfo?.builtAt ?? null,
            rankingBreakdown: buildInfo?.rankingBreakdown === true,
            routes: [
                'GET /corp/ranking/user/:userId/breakdown',
                'GET /corp/ranking-breakdown/:userId',
            ],
        };
    }
}
