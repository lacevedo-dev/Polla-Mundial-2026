import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StickersService } from './stickers.service';
import { GenerateStickerDto } from './dto/generate-sticker.dto';
import { GenerateStickerFromAlbumDto } from './dto/generate-sticker-from-album.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/stickers')
export class StickersController {
  constructor(private readonly stickersService: StickersService) {}

  @Get('cached/:playerApiFootballId')
  @ApiOperation({ summary: 'Obtiene el sticker premium cacheado de un jugador (si existe)' })
  async getCached(@Param('playerApiFootballId', ParseIntPipe) playerApiFootballId: number) {
    const cached = await this.stickersService.getCachedSticker(playerApiFootballId);
    if (!cached) {
      return { ok: false, cached: false, playerApiFootballId };
    }
    return cached;
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Genera (o reutiliza) sticker premium OpenAI usando foto del jugador',
  })
  async generate(@Body() dto: GenerateStickerDto) {
    return this.stickersService.getOrGenerateSticker(dto);
  }

  @Post('generate-from-album')
  @ApiOperation({
    summary: 'Genera sticker OpenAI desde PlayerProfile (álbum admin)',
  })
  async generateFromAlbum(@Body() dto: GenerateStickerFromAlbumDto) {
    return this.stickersService.generateFromAlbum(dto);
  }
}
