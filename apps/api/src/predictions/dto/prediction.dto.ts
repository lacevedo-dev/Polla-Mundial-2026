import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreatePredictionDto {
    @IsNotEmpty()
    @IsString()
    matchId: string;

    @IsNotEmpty()
    @IsString()
    leagueId: string;

    @IsInt()
    @Min(0)
    homeScore: number;

    @IsInt()
    @Min(0)
    awayScore: number;

    @IsOptional()
    @IsString()
    advanceTeamId?: string;
}
