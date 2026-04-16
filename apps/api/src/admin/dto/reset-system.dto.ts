import { IsBoolean, IsOptional } from 'class-validator';

export class ResetSystemDto {
    @IsOptional()
    @IsBoolean()
    predictions?: boolean;

    @IsOptional()
    @IsBoolean()
    participations?: boolean;

    @IsOptional()
    @IsBoolean()
    leagues?: boolean;

    @IsOptional()
    @IsBoolean()
    payments?: boolean;

    @IsOptional()
    @IsBoolean()
    notifications?: boolean;
}
