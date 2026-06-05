import { Module } from '@nestjs/common';
import { DataSyncController } from './data-sync.controller';
import { DataSyncService } from './data-sync.service';
import { PrismaModule } from '../overrides/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [DataSyncController],
    providers: [DataSyncService],
    exports: [DataSyncService],
})
export class DataSyncModule {}
