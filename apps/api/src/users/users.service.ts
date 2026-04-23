import { Injectable } from '@nestjs/common';
import { Plan, Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseSystemConfigValue, serializeSystemConfigValue } from '../system-config/system-config.util';
import { USER_STATUS, UserStatusValue } from './user-status.constants';

const TEST_EMAIL_DOMAINS = [
    'testpolla.local',
    'test.com',
    'prueba.com',
    'seed.local',
    'polla-test.com',
    'example.com',
];

type FindUserOptions = {
    includeInactive?: boolean;
};

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    private buildStatusWhere(includeInactive = false): Prisma.UserWhereInput {
        return includeInactive ? {} : { status: USER_STATUS.ACTIVE };
    }

    async create(data: Prisma.UserCreateInput) {
        const email = data.email?.toLowerCase?.() ?? data.email;
        const isTestDomain = TEST_EMAIL_DOMAINS.some(
            (domain) => email?.endsWith(`@${domain}`) || email?.includes(`.${domain}`),
        );
        if (isTestDomain) {
            throw new Error(`Email ${email} es de un dominio de prueba y no está permitido`);
        }

        return this.prisma.user.create({
            data,
        });
    }

    async findByEmail(email: string, options: FindUserOptions = {}) {
        return this.prisma.user.findFirst({
            where: {
                email,
                ...this.buildStatusWhere(options.includeInactive),
            },
        });
    }

    async findByUsername(username: string, options: FindUserOptions = {}) {
        return this.prisma.user.findFirst({
            where: {
                username,
                ...this.buildStatusWhere(options.includeInactive),
            },
        });
    }

    async findById(id: string, options: FindUserOptions = {}) {
        return this.prisma.user.findFirst({
            where: {
                id,
                ...this.buildStatusWhere(options.includeInactive),
            },
        });
    }

    async create(data: Prisma.UserCreateInput) {
        return this.prisma.user.create({
            data,
        });
    }

    async findAllPaginated(params: {
        page: number;
        limit: number;
        search?: string;
        plan?: Plan;
        systemRole?: SystemRole;
        status?: UserStatusValue;
        includeInactive?: boolean;
    }) {
        const { page, limit, search, plan, systemRole, status, includeInactive = true } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.UserWhereInput = {
            ...this.buildStatusWhere(includeInactive),
            ...(search && {
                OR: [
                    { name: { contains: search } },
                    { email: { contains: search } },
                    { username: { contains: search } },
                ],
            }),
            ...(plan && { plan }),
            ...(systemRole && { systemRole }),
            ...(status && { status }),
        };

        const [data, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    username: true,
                    avatar: true,
                    plan: true,
                    systemRole: true,
                    emailVerified: true,
                    status: true,
                    createdAt: true,
                    _count: { select: { leagues: true, predictions: true } },
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    async updateByAdmin(id: string, data: Partial<{ plan: Plan; systemRole: SystemRole; emailVerified: boolean; status: UserStatusValue }>) {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }

    async setStatus(id: string, status: UserStatusValue) {
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id },
                data: { status },
            });

            if (status === USER_STATUS.INACTIVE) {
                await tx.verificationToken.deleteMany({
                    where: { userId: id },
                });
            }

            return user;
        });
    }

    async hardDeleteByAdmin(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const payments = await tx.payment.findMany({
                where: { userId: id },
                select: { id: true },
            });
            const paymentIds = payments.map((payment) => payment.id);

            if (paymentIds.length > 0) {
                await tx.transaction.deleteMany({
                    where: { paymentId: { in: paymentIds } },
                });
            }

            await tx.prediction.deleteMany({ where: { userId: id } });
            await tx.phaseBonus.deleteMany({ where: { userId: id } });
            await tx.auditLog.deleteMany({ where: { userId: id } });
            await tx.invitation.deleteMany({ where: { invitedBy: id } });
            await tx.userAiCredits.deleteMany({ where: { userId: id } });
            await tx.payment.deleteMany({ where: { userId: id } });

            const creditResetsRecord = await tx.systemConfig.findUnique({
                where: { key: 'user_credit_resets' },
            });
            if (creditResetsRecord) {
                const currentMap = parseSystemConfigValue<Record<string, string> | null>(creditResetsRecord.value) ?? {};
                if (currentMap[id]) {
                    delete currentMap[id];
                    await tx.systemConfig.update({
                        where: { key: 'user_credit_resets' },
                        data: { value: serializeSystemConfigValue(currentMap) },
                    });
                }
            }

            await tx.user.delete({ where: { id } });

            return {
                deletedPaymentCount: paymentIds.length,
            };
        });
    }
}
