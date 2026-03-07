import { ConflictException, ServiceUnavailableException } from '@nestjs/common';

jest.mock('../users/users.service', () => ({
    UsersService: class UsersService { },
}));

jest.mock('bcrypt', () => ({
    hash: jest.fn().mockResolvedValue('hashed-password'),
    compare: jest.fn(),
}));

import { AuthService } from './auth.service';

describe('AuthService.register', () => {
    const usersServiceMock = {
        findByEmail: jest.fn(),
        findByUsername: jest.fn(),
        create: jest.fn(),
    };

    const jwtServiceMock = {
        sign: jest.fn().mockReturnValue('jwt-token'),
    };

    const emailServiceMock = {
        sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
        sendResendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    const prismaServiceMock = {
        verificationToken: {
            create: jest.fn().mockResolvedValue({
                id: 'token-1',
                token: 'token-123',
                userId: 'user-1',
                expiresAt: new Date(),
                usedAt: null,
            }),
            findUnique: jest.fn(),
            deleteMany: jest.fn(),
            update: jest.fn(),
        },
        user: {
            update: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    const avatarStorageServiceMock = {
        save: jest.fn().mockResolvedValue('/uploads/avatars/saved-avatar.png'),
        remove: jest.fn().mockResolvedValue(undefined),
    };

    let authService: AuthService;

    beforeEach(() => {
        jest.clearAllMocks();
        authService = new AuthService(
            usersServiceMock as any,
            jwtServiceMock as any,
            emailServiceMock as any,
            prismaServiceMock as any,
            avatarStorageServiceMock as any,
        );
    });

    it('returns token and user when registration succeeds', async () => {
        usersServiceMock.findByEmail.mockResolvedValue(null);
        usersServiceMock.findByUsername.mockResolvedValue(null);
        avatarStorageServiceMock.save.mockResolvedValueOnce('/uploads/avatars/profile-photo.webp');
        usersServiceMock.create.mockResolvedValue({
            id: 'user-1',
            name: 'Ana Gomez',
            email: 'ana@mail.com',
            username: 'anagomez',
            phone: '3101234568',
            countryCode: '+57',
            avatar: '/uploads/avatars/profile-photo.webp',
        });

        const avatarFile = {
            originalname: 'profile-photo.webp',
            mimetype: 'image/webp',
            buffer: Buffer.from('avatar-binary'),
        } as Express.Multer.File;

        await expect(authService.register({
            name: 'Ana Gomez',
            email: 'ana@mail.com',
            username: 'anagomez',
            password: 'Password1',
            phone: '3101234568',
            countryCode: '+57',
        }, avatarFile)).resolves.toMatchObject({
            accessToken: 'jwt-token',
            user: expect.objectContaining({
                id: 'user-1',
                email: 'ana@mail.com',
                username: 'anagomez',
                avatar: '/uploads/avatars/profile-photo.webp',
            }),
        });
        expect(avatarStorageServiceMock.save).toHaveBeenCalledWith(avatarFile);
        expect(usersServiceMock.create).toHaveBeenCalledWith(expect.objectContaining({
            avatar: '/uploads/avatars/profile-photo.webp',
        }));
    });

    it('preserves duplicate email conflicts', async () => {
        usersServiceMock.findByEmail.mockResolvedValue({ id: 'existing-user' });

        await expect(authService.register({
            name: 'Ana Gomez',
            email: 'ana@mail.com',
            username: 'anagomez',
            password: 'Password1',
        } as any)).rejects.toThrow(ConflictException);
    });

    it('skips avatar storage when registration arrives without an avatar file', async () => {
        usersServiceMock.findByEmail.mockResolvedValue(null);
        usersServiceMock.findByUsername.mockResolvedValue(null);
        usersServiceMock.create.mockResolvedValue({
            id: 'user-1',
            name: 'Ana Gomez',
            email: 'ana@mail.com',
            username: 'anagomez',
            phone: '3101234568',
            countryCode: '+57',
            avatar: null,
        });

        await authService.register({
            name: 'Ana Gomez',
            email: 'ana@mail.com',
            username: 'anagomez',
            password: 'Password1',
            phone: '3101234568',
            countryCode: '+57',
        });

        expect(avatarStorageServiceMock.save).not.toHaveBeenCalled();
        expect(usersServiceMock.create).toHaveBeenCalledWith(expect.objectContaining({
            avatar: undefined,
        }));
    });

    it('removes a saved avatar when user creation fails after storage succeeds', async () => {
        usersServiceMock.findByEmail.mockResolvedValue(null);
        usersServiceMock.findByUsername.mockResolvedValue(null);
        avatarStorageServiceMock.save.mockResolvedValueOnce('/uploads/avatars/cleanup-avatar.png');
        usersServiceMock.create.mockRejectedValueOnce(new Error('user create failed'));

        const avatarFile = {
            originalname: 'cleanup-avatar.png',
            mimetype: 'image/png',
            buffer: Buffer.from('avatar-binary'),
        } as Express.Multer.File;

        await expect(authService.register({
            name: 'Ana Gomez',
            email: 'ana@mail.com',
            username: 'anagomez',
            password: 'Password1',
            phone: '3101234568',
            countryCode: '+57',
        }, avatarFile)).rejects.toThrow('user create failed');

        expect(avatarStorageServiceMock.remove).toHaveBeenCalledWith('/uploads/avatars/cleanup-avatar.png');
    });

    it('translates database connectivity failures into a safe temporary-unavailable error', async () => {
        usersServiceMock.findByEmail.mockRejectedValue(
            Object.assign(
                new Error('Raw query failed. Code: `45028`. Message: `pool timeout: failed to retrieve a connection from pool after 10001ms`'),
                {
                    code: 'P2010',
                    cause: Object.assign(new Error('connect ECONNREFUSED ::1:3306'), {
                        code: 'ECONNREFUSED',
                    }),
                },
            ),
        );

        await expect(authService.register({
            name: 'Ana Gomez',
            email: 'ana@mail.com',
            username: 'anagomez',
            password: 'Password1',
        } as any)).rejects.toMatchObject({
            response: expect.objectContaining({
                code: 'REGISTER_TEMPORARILY_UNAVAILABLE',
                message: 'El registro está temporalmente no disponible. Intenta nuevamente en unos minutos.',
            }),
        });
        await expect(authService.register({
            name: 'Ana Gomez',
            email: 'ana@mail.com',
            username: 'anagomez',
            password: 'Password1',
        } as any)).rejects.toThrow(ServiceUnavailableException);
    });
});
