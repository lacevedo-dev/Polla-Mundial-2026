import { Module } from '@nestjs/common';
import { AiCreditsController } from './ai-credits.controller';
import { AiCreditsService } from './ai-credits.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AiCreditsController],
    providers: [AiCreditsService],
    exports: [AiCreditsService],
})
export class AiCreditsModule {}
