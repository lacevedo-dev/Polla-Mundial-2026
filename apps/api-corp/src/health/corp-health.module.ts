import { Module } from '@nestjs/common';
import { CorpHealthController } from './corp-health.controller';
import { PrismaModule } from '@corp-api/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [CorpHealthController],
})
export class CorpHealthModule {}
