import { UsersService } from './users.service';
import { USER_STATUS } from './user-status.constants';

describe('UsersService', () => {
    const prismaMock = {
        user: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        verificationToken: {
            deleteMany: jest.fn(),
        },
        payment: {
            findMany: jest.fn(),
            deleteMany: jest.fn(),
        },
        transaction: {
            deleteMany: jest.fn(),
        },
        prediction: {
            deleteMany: jest.fn(),
        },
        phaseBonus: {
            deleteMany: jest.fn(),
        },
        auditLog: {
            deleteMany: jest.fn(),
        },
        invitation: {
            deleteMany: jest.fn(),
        },
        userAiCredits: {
            deleteMany: jest.fn(),
        },
        systemConfig: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    let service: UsersService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new UsersService(prismaMock as any);
    });

    it('filters inactive users by default when searching by email', async () => {
        prismaMock.user.findFirst.mockResolvedValue(null);

        await service.findByEmail('ana@mail.com');

        expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
            where: {
                email: 'ana@mail.com',
                status: USER_STATUS.ACTIVE,
            },
        });
    });

    it('can include inactive users when explicitly requested', async () => {
        prismaMock.user.findFirst.mockResolvedValue(null);

        await service.findById('user-1', { includeInactive: true });

        expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'user-1',
            },
        });
    });

    it('hard deletes dependent user data before deleting the user', async () => {
        prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
            callback({
                user: prismaMock.user,
                payment: prismaMock.payment,
                transaction: prismaMock.transaction,
                prediction: prismaMock.prediction,
                phaseBonus: prismaMock.phaseBonus,
                auditLog: prismaMock.auditLog,
                invitation: prismaMock.invitation,
                userAiCredits: prismaMock.userAiCredits,
                systemConfig: prismaMock.systemConfig,
            }),
        );
        prismaMock.payment.findMany.mockResolvedValue([{ id: 'pay-1' }, { id: 'pay-2' }]);
        prismaMock.systemConfig.findUnique.mockResolvedValue({
            key: 'user_credit_resets',
            value: JSON.stringify({ 'user-1': '2026-03-28T00:00:00.000Z', 'user-2': '2026-03-27T00:00:00.000Z' }),
        });
        prismaMock.systemConfig.update.mockResolvedValue(undefined);
        prismaMock.transaction.deleteMany.mockResolvedValue({ count: 2 });
        prismaMock.prediction.deleteMany.mockResolvedValue({ count: 4 });
        prismaMock.phaseBonus.deleteMany.mockResolvedValue({ count: 1 });
        prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 1 });
        prismaMock.invitation.deleteMany.mockResolvedValue({ count: 1 });
        prismaMock.userAiCredits.deleteMany.mockResolvedValue({ count: 1 });
        prismaMock.payment.deleteMany.mockResolvedValue({ count: 2 });
        prismaMock.user.delete.mockResolvedValue({ id: 'user-1' });

        const result = await service.hardDeleteByAdmin('user-1');

        expect(prismaMock.transaction.deleteMany).toHaveBeenCalledWith({
            where: { paymentId: { in: ['pay-1', 'pay-2'] } },
        });
        expect(prismaMock.prediction.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
        expect(prismaMock.phaseBonus.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
        expect(prismaMock.auditLog.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
        expect(prismaMock.invitation.deleteMany).toHaveBeenCalledWith({ where: { invitedBy: 'user-1' } });
        expect(prismaMock.userAiCredits.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
        expect(prismaMock.payment.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
        expect(prismaMock.systemConfig.update).toHaveBeenCalledWith({
            where: { key: 'user_credit_resets' },
            data: { value: JSON.stringify({ 'user-2': '2026-03-27T00:00:00.000Z' }) },
        });
        expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
        expect(result).toEqual({ deletedPaymentCount: 2 });
    });
});
