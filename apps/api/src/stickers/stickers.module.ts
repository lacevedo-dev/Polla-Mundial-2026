import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StickersController } from './stickers.controller';
import { StickerAiConfigService } from './sticker-ai-config.service';
import { StickersService } from './stickers.service';

@Module({
  imports: [PrismaModule],
  controllers: [StickersController],
  providers: [StickersService, StickerAiConfigService],
  exports: [StickersService, StickerAiConfigService],
})
export class StickersModule {}
