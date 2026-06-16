import { Module } from '@nestjs/common';
import { PredictionsModule } from '@corp-api/predictions/predictions.module';
import { CorpApiRankingBreakdownController } from './corp-api-ranking-breakdown.controller';

@Module({
    imports: [PredictionsModule],
    controllers: [CorpApiRankingBreakdownController],
})
export class CorpApiRankingModule {}
