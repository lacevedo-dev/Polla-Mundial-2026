import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export enum ParticipationCategoryDto {
  PRINCIPAL = 'PRINCIPAL',
  MATCH = 'MATCH',
  GROUP = 'GROUP',
  ROUND = 'ROUND',
  PHASE = 'PHASE',
}

export class ParticipationSelectionItemDto {
  @IsEnum(ParticipationCategoryDto)
  category: ParticipationCategoryDto;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  multiplier: number;
}

export class UpsertParticipationSelectionsDto {
  @IsString()
  leagueId: string;

  @IsOptional()
  @IsString()
  matchId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipationSelectionItemDto)
  selections: ParticipationSelectionItemDto[];
}
