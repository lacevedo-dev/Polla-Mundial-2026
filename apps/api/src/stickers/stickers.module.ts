import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StickersController } from './stickers.controller';
import { StickersService } from './stickers.service';

@Module({
  imports: [PrismaModule],
  controllers: [StickersController],
  providers: [StickersService],
  exports: [StickersService],
})
export class StickersModule {}
