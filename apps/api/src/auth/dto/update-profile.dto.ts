import { IsOptional, IsString, MinLength, Matches, MaxLength } from 'class-validator';

export class UpdateProfileDto {
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(80)
    name?: string;

    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(30)
    @Matches(/^[a-zA-Z0-9_]+$/, { message: 'El usuario solo puede contener letras, números y guión bajo' })
    username?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    countryCode?: string;

    @IsOptional()
    @IsString()
    birthDate?: string;
}
