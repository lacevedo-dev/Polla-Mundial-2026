import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StickersController } from './stickers.controller';
import { StickerAiConfigService } from './sticker-ai-config.service';
import { StickerGlobalReferenceService } from './sticker-global-reference.service';
import { StickerReferenceStorageService, type StickerUploadFile } from './sticker-reference-storage.service';
import { StickerTeamReferenceService } from './sticker-team-reference.service';
import { StickersService } from './stickers.service';

@Module({
  imports: [PrismaModule],
  controllers: [StickersController],
  providers: [
    StickersService,
    StickerAiConfigService,
    StickerReferenceStorageService,
    StickerGlobalReferenceService,
    StickerTeamReferenceService,
  ],
  exports: [
    StickersService,
    StickerAiConfigService,
    StickerReferenceStorageService,
    StickerGlobalReferenceService,
    StickerTeamReferenceService,
  ],
})
export class StickersModule {}
