import { Module } from '@nestjs/common';
import { PredictionsService } from './predictions.service';
import { PredictionsController } from './predictions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PredictionsController],
    providers: [PredictionsService],
    exports: [PredictionsService],
})
export class PredictionsModule { }
