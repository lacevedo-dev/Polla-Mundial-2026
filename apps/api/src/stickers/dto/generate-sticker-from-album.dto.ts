import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GenerateStickerFromAlbumDto {
  @ApiProperty({ description: 'ID API-Football del jugador en PlayerProfile' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  playerApiFootballId: number;

  @ApiPropertyOptional({ description: 'Código de selección si el perfil no tiene equipo asignado' })
  @IsOptional()
  @IsString()
  teamCode?: string;

  @ApiPropertyOptional({ example: 67, description: 'Minuto de contexto para el número de catálogo' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minute?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}
