import { Module } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { PredictionReportModule } from '../prediction-report/prediction-report.module';
import { FootballSyncModule } from '../football-sync/football-sync.module';
import { AutomationModule } from '../automation/automation.module';

@Module({
    imports: [PrismaModule, PredictionsModule, PredictionReportModule, FootballSyncModule, AutomationModule],
    controllers: [MatchesController],
    providers: [MatchesService],
    exports: [MatchesService],
})
export class MatchesModule { }
