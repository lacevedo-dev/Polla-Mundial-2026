import { Module } from '@nestjs/common';
import { PredictionsModule } from '@corp-api/predictions/predictions.module';
import { CorpRankingDetailController } from './corp-ranking-detail.controller';

@Module({
    imports: [PredictionsModule],
    controllers: [CorpRankingDetailController],
})
export class CorpRankingDetailModule {}
