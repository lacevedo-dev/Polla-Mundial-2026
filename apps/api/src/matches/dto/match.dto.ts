import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { Phase } from '@prisma/client';

export class CreateMatchDto {
    @IsNotEmpty()
    @IsString()
    homeTeamId: string;

    @IsNotEmpty()
    @IsString()
    awayTeamId: string;

    @IsNotEmpty()
    @IsEnum(Phase)
    phase: Phase;

    @IsOptional()
    @IsString()
    group?: string;

    @IsOptional()
    @IsInt()
    matchNumber?: number;

    @IsOptional()
    @IsString()
    venue?: string;

    @IsNotEmpty()
    @IsDateString()
    matchDate: string;
}

export class UpdateMatchScoreDto {
    @IsInt()
    @IsNotEmpty()
    homeScore: number;

    @IsInt()
    @IsNotEmpty()
    awayScore: number;

  /** Goles en tanda de penales (API-Football score.penalty). */
    @IsOptional()
    @IsInt()
    penaltyHomeScore?: number;

    @IsOptional()
    @IsInt()
    penaltyAwayScore?: number;

  /** Clasificado en eliminatoria — obligatorio si el marcador queda empatado. */
    @IsOptional()
    @IsString()
    advancingTeamId?: string;
}
