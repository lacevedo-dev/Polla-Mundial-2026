import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
    @IsNotEmpty({ message: 'Ingresa tu correo, usuario o número de documento' })
    @IsString()
    identifier: string;

    @IsOptional()
    @IsString()
    appUrl?: string;
}