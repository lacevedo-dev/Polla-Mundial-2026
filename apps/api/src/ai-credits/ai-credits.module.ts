import { Module } from '@nestjs/common';
import { AiCreditsController } from './ai-credits.controller';
import { AiCreditsService } from './ai-credits.service';
import { PrismaClient } from '@prisma/client';

@Module({
    controllers: [AiCreditsController],
    providers: [
        AiCreditsService,
        {
            provide: PrismaClient,
            useValue: new PrismaClient(),
        },
    ],
    exports: [AiCreditsService],
})
export class AiCreditsModule {}
