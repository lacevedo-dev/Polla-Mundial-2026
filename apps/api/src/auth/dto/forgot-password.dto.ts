import { IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
    @IsNotEmpty({ message: 'Ingresa tu correo o documento de identidad' })
    @IsString()
    identifier: string;
}