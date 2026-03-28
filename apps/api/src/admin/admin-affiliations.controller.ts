import {
    Controller, Get, Patch, Param, Body, Query, UseGuards, NotFoundException,
    ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Plan } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from '../users/users.service';

export class UpdateAffiliationDto {
    @IsEnum(Plan)
    plan: Plan;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/affiliations')
export class AdminAffiliationsController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    @ApiOperation({ summary: 'List user-plan affiliations with pagination' })
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('search') search?: string,
        @Query('plan') plan?: Plan,
    ) {
        return this.usersService.findAllPaginated({ page, limit, search, plan });
    }

    @Patch(':userId')
    @ApiOperation({ summary: "Change a user's plan" })
    async updateAffiliation(@Param('userId') userId: string, @Body() dto: UpdateAffiliationDto) {
        const user = await this.usersService.findById(userId, { includeInactive: true });
        if (!user) throw new NotFoundException('Usuario no encontrado');
        return this.usersService.updateByAdmin(userId, { plan: dto.plan });
    }
}
