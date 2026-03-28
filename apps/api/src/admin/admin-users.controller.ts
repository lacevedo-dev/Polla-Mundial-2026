import {
    Controller, Get, Patch, Post, Delete, Param, Body, Query, UseGuards,
    NotFoundException, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Plan, SystemRole } from '@prisma/client';
import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';
import { USER_STATUS, UserStatusValue } from '../users/user-status.constants';

export class UpdateUserAdminDto {
    @IsOptional()
    @IsEnum(Plan)
    plan?: Plan;

    @IsOptional()
    @IsEnum(SystemRole)
    systemRole?: SystemRole;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    emailVerified?: boolean;
}

export class UpdateUserStatusDto {
    @IsEnum(USER_STATUS)
    status: UserStatusValue;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/users')
export class AdminUsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly prisma: PrismaService,
        private readonly adminService: AdminService,
    ) {}

    @Get()
    @ApiOperation({ summary: 'List all users with pagination' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'plan', required: false, enum: Plan })
    @ApiQuery({ name: 'systemRole', required: false, enum: SystemRole })
    @ApiQuery({ name: 'status', required: false, enum: Object.values(USER_STATUS) })
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('search') search?: string,
        @Query('plan') plan?: Plan,
        @Query('systemRole') systemRole?: SystemRole,
        @Query('status') status?: UserStatusValue,
    ) {
        return this.usersService.findAllPaginated({ page, limit, search, plan, systemRole, status, includeInactive: true });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single user with league info' })
    async findOne(@Param('id') id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                leagues: {
                    include: { league: { select: { id: true, name: true, status: true } } },
                },
                _count: { select: { predictions: true, payments: true } },
            },
        });
        if (!user) throw new NotFoundException('Usuario no encontrado');
        const { passwordHash, ...result } = user;
        return result;
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update user plan, role, or verification status' })
    async update(@Param('id') id: string, @Body() dto: UpdateUserAdminDto) {
        const user = await this.usersService.findById(id, { includeInactive: true });
        if (!user) throw new NotFoundException('Usuario no encontrado');
        return this.usersService.updateByAdmin(id, dto);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update user active/inactive status' })
    async updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
        const user = await this.usersService.findById(id, { includeInactive: true });
        if (!user) throw new NotFoundException('Usuario no encontrado');
        await this.usersService.setStatus(id, dto.status);
        return {
            message: dto.status === USER_STATUS.INACTIVE
                ? 'Usuario inactivado exitosamente'
                : 'Usuario reactivado exitosamente',
        };
    }

    @Post(':id/ban')
    @ApiOperation({ summary: 'Legacy alias for inactivating a user' })
    async ban(@Param('id') id: string) {
        return this.updateStatus(id, { status: USER_STATUS.INACTIVE });
    }

    @Post(':id/activate')
    @ApiOperation({ summary: 'Legacy alias for reactivating a user' })
    async activate(@Param('id') id: string) {
        return this.updateStatus(id, { status: USER_STATUS.ACTIVE });
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Hard delete a user permanently' })
    async remove(@Param('id') id: string) {
        const user = await this.usersService.findById(id, { includeInactive: true });
        if (!user) throw new NotFoundException('Usuario no encontrado');
        const summary = await this.usersService.hardDeleteByAdmin(id);
        return { message: 'Usuario eliminado definitivamente', ...summary };
    }

    @Post(':id/credits/reset')
    @ApiOperation({ summary: 'Reset Smart Insights credits for a specific user' })
    async resetUserCredits(@Param('id') id: string) {
        const user = await this.usersService.findById(id, { includeInactive: true });
        if (!user) throw new NotFoundException('Usuario no encontrado');
        const resetAt = new Date().toISOString();
        const existing = await this.adminService.getSystemConfig('user_credit_resets');
        const map = ((existing?.value ?? {}) as Record<string, string>);
        map[id] = resetAt;
        await this.adminService.setSystemConfig('user_credit_resets', map);
        return { ok: true, userId: id, resetAt };
    }
}
