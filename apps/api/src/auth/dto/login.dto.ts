import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
    @IsNotEmpty({ message: 'El correo electrónico o usuario es requerido' })
    @IsString()
    identifier: string;

    @IsNotEmpty({ message: 'La contraseña es requerida' })
    @IsString()
    password: string;
}
