import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

export class RegisterDto {
    @IsNotEmpty({ message: 'El nombre es obligatorio' })
    @IsString()
    @MaxLength(100)
    name: string;

    @IsNotEmpty({ message: 'El usuario es obligatorio' })
    @IsString()
    @MaxLength(30)
    @MinLength(3, { message: 'El usuario debe tener al menos 3 caracteres' })
    @Matches(/^[a-zA-Z0-9_]+$/, { message: 'El usuario solo puede contener letras, números y guiones bajos' })
    username: string;

    @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
    @IsEmail({}, { message: 'Debe ser un correo electrónico válido' })
    email: string;

    @IsNotEmpty({ message: 'La contraseña es obligatoria' })
    @IsString()
    @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, { message: 'La contraseña debe tener al menos una letra mayúscula, una letra minúscula y un número o carácter especial' })
    password: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    countryCode?: string;
}
