import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async validateUser(identifier: string, pass: string): Promise<any> {
        // Buscar usuario por email o username
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
                plan: user.plan
            }
        };
    }

    async register(registerDto: RegisterDto) {
        // Verificar si el correo ya existe
        const existingEmail = await this.usersService.findByEmail(registerDto.email);
        if (existingEmail) {
            throw new ConflictException('El correo electrónico ya está registrado');
        }

        // Verificar si el usuario ya existe
        const existingUsername = await this.usersService.findByUsername(registerDto.username);
        if (existingUsername) {
            throw new ConflictException('El nombre de usuario ya está en uso');
        }

        // Hashear contraseña
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

        // Crear usuario
        const user = await this.usersService.create({
            name: registerDto.name,
            email: registerDto.email,
            username: registerDto.username,
            passwordHash: passwordHash,
            phone: registerDto.phone,
            countryCode: registerDto.countryCode
        });

        const { passwordHash: _, ...result } = user;

        // Auto login después del registro
        const payload = { username: user.username, sub: user.id, email: user.email };
        return {
            message: 'Usuario registrado exitosamente',
            accessToken: this.jwtService.sign(payload),
            user: result
        };
    }
}
