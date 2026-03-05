import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Privacy, Plan, Currency } from '@prisma/client';

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
    @Max(100)
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
}
