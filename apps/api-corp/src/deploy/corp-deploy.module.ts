import { Module } from '@nestjs/common';
import { CorpDeployStatusController } from './corp-deploy-status.controller';

@Module({
    controllers: [CorpDeployStatusController],
})
export class CorpDeployModule {}
