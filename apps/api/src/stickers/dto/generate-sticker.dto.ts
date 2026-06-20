import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateStickerDto {
  @ApiProperty({
    description: 'ID API-Football del jugador; clave de caché (solo se genera una vez)',
    example: 1642,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  playerApiFootballId: number;

  @ApiProperty({ example: 'https://media.api-sports.io/football/players/1642.png' })
  @IsUrl()
  @IsNotEmpty()
  photoUrl: string;

  @ApiProperty({ example: 'JEAN-PHILIPPE GBAMIN' })
  @IsString()
  @IsNotEmpty()
  playerName: string;

  @ApiProperty({ example: '25-09-1995' })
  @IsString()
  @IsNotEmpty()
  birthDate: string;

  @ApiProperty({ example: '1,86m' })
  @IsString()
  @IsNotEmpty()
  height: string;

  @ApiProperty({ example: '83 kg' })
  @IsString()
  @IsNotEmpty()
  weight: string;

  @ApiProperty({ example: 'CIV' })
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @ApiProperty({ example: "Côte d'Ivoire" })
  @IsString()
  @IsNotEmpty()
  countryName: string;

  @ApiProperty({ example: 'CIV27' })
  @IsString()
  @IsNotEmpty()
  cardCode: string;

  @ApiProperty({ example: '261' })
  @IsString()
  @IsNotEmpty()
  stickerNumber: string;

  @ApiPropertyOptional({ example: '25' })
  @IsString()
  @IsOptional()
  mainNumber?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'auto'], default: 'high' })
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'auto'])
  quality?: 'low' | 'medium' | 'high' | 'auto';

  @ApiPropertyOptional({
    description: 'Incluir base64 en la respuesta (solo debug; preferir imageUrl)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeBase64?: boolean;

  @ApiPropertyOptional({
    description: 'Incluir el prompt enviado a OpenAI (solo debug admin)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includePrompt?: boolean;

  @ApiPropertyOptional({
    description: 'Forzar nueva generación aunque exista caché',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}
