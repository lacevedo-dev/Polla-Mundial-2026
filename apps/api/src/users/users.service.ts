import { Injectable } from '@nestjs/common';
import { Prisma, SystemRole, Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async findByUsername(username: string) {
        return this.prisma.user.findUnique({
            where: { username },
        });
    }

    async findById(id: string) {
        return this.prisma.user.findUnique({
            where: { id },
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
    }) {
        const { page, limit, search, plan, systemRole } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.UserWhereInput = {
            ...(search && {
                OR: [
                    { name: { contains: search } },
                    { email: { contains: search } },
                    { username: { contains: search } },
                ],
            }),
            ...(plan && { plan }),
            ...(systemRole && { systemRole }),
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
                    createdAt: true,
                    _count: { select: { leagues: true, predictions: true } },
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    async updateByAdmin(id: string, data: Partial<{ plan: Plan; systemRole: SystemRole; emailVerified: boolean }>) {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }
}
