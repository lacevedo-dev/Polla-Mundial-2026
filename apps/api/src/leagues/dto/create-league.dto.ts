import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Privacy, Plan, Currency } from '@prisma/client';

class CreateStageFeeDto {
    @IsString() type: string;
    @IsString() label: string;
    @IsInt() @Min(0) amount: number;
    @IsBoolean() active: boolean;
}

class CreateDistributionDto {
    @IsString() category: string;
    @IsInt() @Min(1) position: number;
    @IsString() label: string;
    @IsNumber() @Min(0) @Max(100) percentage: number;
    @IsBoolean() active: boolean;
}

export class CreateLeagueDto {
    @IsNotEmpty({ message: 'El nombre de la liga es obligatorio' })
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(Privacy, { message: 'Privacidad inválida (PUBLIC, PRIVATE)' })
    privacy?: Privacy;

    @IsOptional()
    @IsNumber()
    @Min(2)
    @Max(500)
    maxParticipants?: number;

    @IsOptional()
    @IsBoolean()
    includeBaseFee?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0)
    baseFee?: number;

    @IsOptional()
    @IsEnum(Currency, { message: 'Moneda inválida' })
    currency?: Currency;

    @IsOptional()
    @IsEnum(Plan, { message: 'Plan inválido (FREE, GOLD, DIAMOND)' })
    plan?: Plan;

    @IsOptional()
    @IsBoolean()
    includeStageFees?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(50)
    adminFeePercent?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateStageFeeDto)
    stageFees?: CreateStageFeeDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDistributionDto)
    distributions?: CreateDistributionDto[];

    @IsOptional()
    @IsString()
    primaryTournamentId?: string;
}
