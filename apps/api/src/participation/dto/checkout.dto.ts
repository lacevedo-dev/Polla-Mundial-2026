import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ParticipationCategoryDto } from './selection.dto';

export class ParticipationCheckoutItemDto {
  @IsString()
  obligationId: string;

  @IsEnum(ParticipationCategoryDto)
  category: ParticipationCategoryDto;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class PrepareParticipationCheckoutDto {
  @IsString()
  leagueId: string;

  @IsArray()
  obligationIds: string[];
}
