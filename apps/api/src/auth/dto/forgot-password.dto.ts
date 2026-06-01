import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
    @IsNotEmpty({ message: 'Ingresa tu número de documento de identidad' })
    @IsString()
    identifier: string;

    @IsOptional()
    @IsString()
    appUrl?: string;
}