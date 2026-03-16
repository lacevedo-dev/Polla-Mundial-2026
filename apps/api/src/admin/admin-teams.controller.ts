import {
    Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

export class CreateTeamDto {
    @IsString() name: string;
    @IsString() code: string;
    @IsOptional() @IsString() group?: string;
    @IsOptional() @IsString() flagUrl?: string;
}

export class UpdateTeamDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsString() code?: string;
    @IsOptional() @IsString() group?: string;
    @IsOptional() @IsString() flagUrl?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/teams')
export class AdminTeamsController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    @ApiOperation({ summary: 'List all teams' })
    async findAll() {
        return this.prisma.team.findMany({ orderBy: { name: 'asc' } });
    }

    @Post()
    @ApiOperation({ summary: 'Create a new team' })
    async create(@Body() dto: CreateTeamDto) {
        return this.prisma.team.create({ data: dto });
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a team' })
    async update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
        const team = await this.prisma.team.findUnique({ where: { id } });
        if (!team) throw new NotFoundException('Equipo no encontrado');
        return this.prisma.team.update({ where: { id }, data: dto });
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a team' })
    async remove(@Param('id') id: string) {
        const team = await this.prisma.team.findUnique({ where: { id } });
        if (!team) throw new NotFoundException('Equipo no encontrado');
        await this.prisma.team.delete({ where: { id } });
        return { message: 'Equipo eliminado exitosamente' };
    }
}
