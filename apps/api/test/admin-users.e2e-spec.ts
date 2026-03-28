jest.mock('./../src/prisma/prisma.service', () => ({
    PrismaService: class PrismaService { },
}));

import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AdminUsersController } from './../src/admin/admin-users.controller';
import { AdminService } from './../src/admin/admin.service';
import { JwtAuthGuard } from './../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from './../src/auth/guards/roles.guard';
import { PrismaService } from './../src/prisma/prisma.service';
import { UsersService } from './../src/users/users.service';

class MockAdminGuard implements CanActivate {
    canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        req.user = {
            userId: 'superadmin-1',
            systemRole: 'SUPERADMIN',
        };
        return true;
    }
}

describe('Admin users (e2e)', () => {
    let app: INestApplication<App>;

    const usersServiceMock = {
        findAllPaginated: jest.fn(),
        findById: jest.fn(),
        setStatus: jest.fn(),
        hardDeleteByAdmin: jest.fn(),
        updateByAdmin: jest.fn(),
    };

    const prismaServiceMock = {
        user: {
            findUnique: jest.fn(),
        },
    };

    const adminServiceMock = {
        getSystemConfig: jest.fn(),
        setSystemConfig: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        usersServiceMock.findAllPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
        usersServiceMock.findById.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
        usersServiceMock.setStatus.mockResolvedValue(undefined);
        usersServiceMock.hardDeleteByAdmin.mockResolvedValue({ deletedPaymentCount: 2 });

        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [AdminUsersController],
            providers: [
                {
                    provide: UsersService,
                    useValue: usersServiceMock,
                },
                {
                    provide: PrismaService,
                    useValue: prismaServiceMock,
                },
                {
                    provide: AdminService,
                    useValue: adminServiceMock,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useClass(MockAdminGuard)
            .overrideGuard(RolesGuard)
            .useClass(MockAdminGuard)
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }));
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('lists users including inactive ones for admin management', async () => {
        await request(app.getHttpServer())
            .get('/admin/users?status=INACTIVE&page=2&limit=5')
            .expect(200)
            .expect({ data: [], total: 0, page: 1, limit: 20 });

        expect(usersServiceMock.findAllPaginated).toHaveBeenCalledWith({
            page: 2,
            limit: 5,
            search: undefined,
            plan: undefined,
            systemRole: undefined,
            status: 'INACTIVE',
            includeInactive: true,
        });
    });

    it('updates the user status through the soft-delete endpoint', async () => {
        await request(app.getHttpServer())
            .patch('/admin/users/user-1/status')
            .send({ status: 'INACTIVE' })
            .expect(200)
            .expect({ message: 'Usuario inactivado exitosamente' });

        expect(usersServiceMock.findById).toHaveBeenCalledWith('user-1', { includeInactive: true });
        expect(usersServiceMock.setStatus).toHaveBeenCalledWith('user-1', 'INACTIVE');
    });

    it('returns 404 when trying to change the status of an unknown user', async () => {
        usersServiceMock.findById.mockResolvedValueOnce(null);

        await request(app.getHttpServer())
            .patch('/admin/users/missing/status')
            .send({ status: 'INACTIVE' })
            .expect(404);
    });

    it('hard deletes the user and returns the cleanup summary', async () => {
        await request(app.getHttpServer())
            .delete('/admin/users/user-1')
            .expect(200)
            .expect({
                message: 'Usuario eliminado definitivamente',
                deletedPaymentCount: 2,
            });

        expect(usersServiceMock.hardDeleteByAdmin).toHaveBeenCalledWith('user-1');
    });

    it('rejects invalid status payloads before hitting the service', async () => {
        await request(app.getHttpServer())
            .patch('/admin/users/user-1/status')
            .send({ status: 'DELETED' })
            .expect(400);

        expect(usersServiceMock.setStatus).not.toHaveBeenCalled();
    });
});
