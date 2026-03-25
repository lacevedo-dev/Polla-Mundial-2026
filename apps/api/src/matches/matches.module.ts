import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { PredictionReportModule } from '../prediction-report/prediction-report.module';

@Module({
    imports: [PrismaModule, PredictionsModule, PredictionReportModule],
    controllers: [MatchesController],
    providers: [MatchesService],
    exports: [MatchesService],
})
export class MatchesModule { }
