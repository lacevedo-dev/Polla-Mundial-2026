import {
    Controller, Get, Patch, Param, Body, Query, UseGuards,
    NotFoundException, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LeagueStatus, Plan, MemberStatus } from '@prisma/client';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

export class UpdateLeagueAdminDto {
    @IsOptional()
    @IsEnum(LeagueStatus)
    status?: LeagueStatus;

    @IsOptional()
    @IsEnum(Plan)
    plan?: Plan;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/leagues')
export class AdminLeaguesController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    @ApiOperation({ summary: 'List all leagues with pagination' })
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('status') status?: LeagueStatus,
        @Query('plan') plan?: Plan,
        @Query('search') search?: string,
    ) {
        const skip = (page - 1) * limit;
        const where: any = {
            ...(status && { status }),
            ...(plan && { plan }),
            ...(search && { name: { contains: search } }),
        };

        const [data, total] = await Promise.all([
            this.prisma.league.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: { select: { members: true, predictions: true } },
                },
            }),
            this.prisma.league.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get league detail with members' })
    async findOne(@Param('id') id: string) {
        const league = await this.prisma.league.findUnique({
            where: { id },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true, avatar: true } },
                    },
                },
                _count: { select: { predictions: true, payments: true } },
            },
        });
        if (!league) throw new NotFoundException('Liga no encontrada');
        return league;
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update league status, plan, or name' })
    async update(@Param('id') id: string, @Body() dto: UpdateLeagueAdminDto) {
        const league = await this.prisma.league.findUnique({ where: { id } });
        if (!league) throw new NotFoundException('Liga no encontrada');
        return this.prisma.league.update({ where: { id }, data: dto });
    }

    @Get(':id/members')
    @ApiOperation({ summary: 'Get league members' })
    async getMembers(@Param('id') id: string) {
        const league = await this.prisma.league.findUnique({ where: { id } });
        if (!league) throw new NotFoundException('Liga no encontrada');

        return this.prisma.leagueMember.findMany({
            where: { leagueId: id },
            include: {
                user: { select: { id: true, name: true, email: true, avatar: true, plan: true } },
            },
        });
    }

    @Patch(':id/members/:userId/ban')
    @ApiOperation({ summary: 'Ban a member from a league' })
    async banMember(@Param('id') id: string, @Param('userId') userId: string) {
        const member = await this.prisma.leagueMember.findUnique({
            where: { userId_leagueId: { userId, leagueId: id } },
        });
        if (!member) throw new NotFoundException('Miembro no encontrado');
        return this.prisma.leagueMember.update({
            where: { userId_leagueId: { userId, leagueId: id } },
            data: { status: MemberStatus.BANNED },
        });
    }
}
