import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from './../src/auth/auth.controller';
import { AuthService } from './../src/auth/auth.service';
import { UsersService } from './../src/users/users.service';

describe('Auth register avatar (e2e)', () => {
    let app: INestApplication<App>;

    const authServiceMock = {
        register: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        authServiceMock.register.mockResolvedValue({
            accessToken: 'jwt-token',
            user: {
                id: 'user-1',
                name: 'Ana Gomez',
                email: 'ana@mail.com',
                username: 'anagomez',
                avatar: '/uploads/avatars/profile-photo.webp',
            },
        });

        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: authServiceMock,
                },
                {
                    provide: UsersService,
                    useValue: {},
                },
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('accepts multipart registration with an avatar file', async () => {
        await request(app.getHttpServer())
            .post('/auth/register')
            .field('name', 'Ana Gomez')
            .field('email', 'ana@mail.com')
            .field('username', 'anagomez')
            .field('password', 'Password1')
            .field('phone', '3101234568')
            .field('countryCode', '+57')
            .attach('avatar', Buffer.from('avatar-image'), {
                filename: 'profile-photo.webp',
                contentType: 'image/webp',
            })
            .expect(201);

        expect(authServiceMock.register).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Ana Gomez',
                email: 'ana@mail.com',
                username: 'anagomez',
                password: 'Password1',
                phone: '3101234568',
                countryCode: '+57',
            }),
            expect.objectContaining({
                originalname: 'profile-photo.webp',
                mimetype: 'image/webp',
            }),
        );
    });

    it('accepts registration requests without an avatar file', async () => {
        await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                name: 'Ana Gomez',
                email: 'ana@mail.com',
                username: 'anagomez',
                password: 'Password1',
                phone: '3101234568',
                countryCode: '+57',
            })
            .expect(201);

        expect(authServiceMock.register).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Ana Gomez',
                email: 'ana@mail.com',
                username: 'anagomez',
                password: 'Password1',
                phone: '3101234568',
                countryCode: '+57',
            }),
            undefined,
        );
    });

    it('rejects unsupported avatar file types before hitting the auth service', async () => {
        await request(app.getHttpServer())
            .post('/auth/register')
            .field('name', 'Ana Gomez')
            .field('email', 'ana@mail.com')
            .field('username', 'anagomez')
            .field('password', 'Password1')
            .attach('avatar', Buffer.from('plain-text'), {
                filename: 'notes.txt',
                contentType: 'text/plain',
            })
            .expect(400);

        expect(authServiceMock.register).not.toHaveBeenCalled();
    });
});
