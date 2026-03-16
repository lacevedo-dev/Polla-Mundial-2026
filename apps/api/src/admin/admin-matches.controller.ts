import {
    Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
    NotFoundException, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Phase, MatchStatus } from '@prisma/client';
import { IsOptional, IsEnum, IsString, IsNumber, IsDateString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MatchesService } from '../matches/matches.service';

export class AdminCreateMatchDto {
    @IsString() homeTeamId: string;
    @IsString() awayTeamId: string;
    @IsEnum(Phase) phase: Phase;
    @IsDateString() matchDate: string;
    @IsOptional() @IsString() venue?: string;
    @IsOptional() @IsString() group?: string;
    @IsOptional() @IsNumber() matchNumber?: number;
}

export class AdminUpdateScoreDto {
    @IsNumber() homeScore: number;
    @IsNumber() awayScore: number;
}

export class AdminUpdateMatchDto {
    @IsOptional() @IsString() homeTeamId?: string;
    @IsOptional() @IsString() awayTeamId?: string;
    @IsOptional() @IsEnum(Phase) phase?: Phase;
    @IsOptional() @IsDateString() matchDate?: string;
    @IsOptional() @IsEnum(MatchStatus) status?: MatchStatus;
    @IsOptional() @IsString() venue?: string;
    @IsOptional() @IsString() group?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/matches')
export class AdminMatchesController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly matchesService: MatchesService,
    ) {}

    @Get()
    @ApiOperation({ summary: 'List all matches' })
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
        @Query('phase') phase?: Phase,
        @Query('status') status?: MatchStatus,
    ) {
        const skip = (page - 1) * limit;
        const where: any = {
            ...(phase && { phase }),
            ...(status && { status }),
        };

        const [data, total] = await Promise.all([
            this.prisma.match.findMany({
                where,
                skip,
                take: limit,
                orderBy: { matchDate: 'asc' },
                include: { homeTeam: true, awayTeam: true },
            }),
            this.prisma.match.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    @Post()
    @ApiOperation({ summary: 'Create a new match' })
    async create(@Body() dto: AdminCreateMatchDto) {
        return this.matchesService.create(dto as any);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update match details' })
    async update(@Param('id') id: string, @Body() dto: AdminUpdateMatchDto) {
        const match = await this.prisma.match.findUnique({ where: { id } });
        if (!match) throw new NotFoundException('Partido no encontrado');
        return this.prisma.match.update({
            where: { id },
            data: dto as any,
            include: { homeTeam: true, awayTeam: true },
        });
    }

    @Patch(':id/score')
    @ApiOperation({ summary: 'Update match score and trigger points calculation' })
    async updateScore(@Param('id') id: string, @Body() dto: AdminUpdateScoreDto) {
        return this.matchesService.updateScore(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a match' })
    async remove(@Param('id') id: string) {
        const match = await this.prisma.match.findUnique({ where: { id } });
        if (!match) throw new NotFoundException('Partido no encontrado');
        await this.prisma.match.delete({ where: { id } });
        return { message: 'Partido eliminado exitosamente' };
    }

    @Get(':id/predictions')
    @ApiOperation({ summary: 'Get all predictions for a match' })
    async getMatchPredictions(@Param('id') id: string) {
        const match = await this.prisma.match.findUnique({ where: { id } });
        if (!match) throw new NotFoundException('Partido no encontrado');
        return this.prisma.prediction.findMany({
            where: { matchId: id },
            include: {
                user: { select: { id: true, name: true, username: true, avatar: true } },
                league: { select: { id: true, name: true } },
            },
            orderBy: { submittedAt: 'desc' },
        });
    }
}
