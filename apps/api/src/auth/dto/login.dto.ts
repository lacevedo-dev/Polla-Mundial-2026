import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
    @IsNotEmpty({ message: 'El documento de identidad es requerido' })
    @IsString()
    identifier: string;

    @IsNotEmpty({ message: 'La contraseÃ±a es requerida' })
    @IsString()
    password: string;

    @IsOptional()
    @IsString()
    recaptchaToken?: string;
}
