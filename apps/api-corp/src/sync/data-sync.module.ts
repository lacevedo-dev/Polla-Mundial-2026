import { Module } from '@nestjs/common';
import { DataSyncService } from './data-sync.service';
import { PrismaModule } from '../overrides/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [DataSyncService],
    exports: [DataSyncService],
})
export class DataSyncModule {}
