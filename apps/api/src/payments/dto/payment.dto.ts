import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
    @IsNotEmpty()
    @IsString()
    leagueId: string;

    @IsNotEmpty()
    @IsInt()
    @Min(1000) // Mínimo 1000 COP
    amount: number;

    @IsNotEmpty()
    @IsEnum(PaymentMethod)
    method: PaymentMethod;

    @IsOptional()
    @IsString()
    conceptId?: string;

    @IsOptional()
    @IsString()
    conceptType?: string; // e.g. 'BASE_FEE', 'STAGE_FEE'
}
