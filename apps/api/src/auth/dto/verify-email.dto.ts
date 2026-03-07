import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
    @IsNotEmpty({ message: 'El token de verificación es obligatorio' })
    @IsString()
    token: string;
}
