import { Module } from '@nestjs/common';
import { PredictionsModule } from '@corp-api/predictions/predictions.module';
import { DataSyncController } from './data-sync.controller';
import { DataSyncService } from './data-sync.service';
import { PrismaModule } from '../overrides/prisma.module';

@Module({
    imports: [PrismaModule, PredictionsModule],
    controllers: [DataSyncController],
    providers: [DataSyncService],
    exports: [DataSyncService],
})
export class DataSyncModule {}
