import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { mapRegisterOperationalError } from './auth-error.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async validateUser(identifier: string, pass: string): Promise<any> {
        let user = await this.usersService.findByEmail(identifier);
        if (!user) {
            user = await this.usersService.findByUsername(identifier);
        }

        if (user && await bcrypt.compare(pass, user.passwordHash)) {
            const { passwordHash, ...result } = user;
            return result;
        }
        return null;
    }

    async login(loginDto: LoginDto) {
        const user = await this.validateUser(loginDto.identifier, loginDto.password);
        if (!user) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        const payload = { username: user.username, sub: user.id, email: user.email };
        return {
            accessToken: this.jwtService.sign(payload),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                avatar: user.avatar,
                plan: user.plan,
            },
        };
    }

    async register(registerDto: RegisterDto) {
        const existingEmail = await this.wrapRegisterDatabaseOperation(() =>
            this.usersService.findByEmail(registerDto.email),
        );
        if (existingEmail) {
            throw new ConflictException('El correo electrónico ya está registrado');
        }

        const existingUsername = await this.wrapRegisterDatabaseOperation(() =>
            this.usersService.findByUsername(registerDto.username),
        );
        if (existingUsername) {
            throw new ConflictException('El nombre de usuario ya está en uso');
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

        const user = await this.wrapRegisterDatabaseOperation(() =>
            this.usersService.create({
                name: registerDto.name,
                email: registerDto.email,
                username: registerDto.username,
                passwordHash,
                phone: registerDto.phone,
                countryCode: registerDto.countryCode,
            }),
        );

        const { passwordHash: _, ...result } = user;
        const payload = { username: user.username, sub: user.id, email: user.email };

        return {
            message: 'Usuario registrado exitosamente',
            accessToken: this.jwtService.sign(payload),
            user: result,
        };
    }

    private async wrapRegisterDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            throw mapRegisterOperationalError(error);
        }
    }
}
