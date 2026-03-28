import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
    const prismaMock = {
        user: {
            findFirst: jest.fn(),
        },
    };

    let strategy: JwtStrategy;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        strategy = new JwtStrategy(prismaMock as any);
    });

    it('returns the persisted user identity for active users', async () => {
        prismaMock.user.findFirst.mockResolvedValue({
            id: 'user-1',
            username: 'ana',
            email: 'ana@mail.com',
            systemRole: 'USER',
        });

        await expect(strategy.validate({
            sub: 'user-1',
            username: 'ignored',
            email: 'ignored@mail.com',
            systemRole: 'SUPERADMIN',
        })).resolves.toEqual({
            userId: 'user-1',
            username: 'ana',
            email: 'ana@mail.com',
            systemRole: 'USER',
        });
    });

    it('rejects inactive or missing users', async () => {
        prismaMock.user.findFirst.mockResolvedValue(null);

        await expect(strategy.validate({ sub: 'user-1' })).rejects.toThrow(UnauthorizedException);
    });
});
