import {
    Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/predictions')
export class AdminPredictionsController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    @ApiOperation({ summary: 'List all predictions with filters' })
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('matchId') matchId?: string,
        @Query('leagueId') leagueId?: string,
        @Query('userId') userId?: string,
    ) {
        const skip = (page - 1) * limit;
        const where: any = {
            ...(matchId && { matchId }),
            ...(leagueId && { leagueId }),
            ...(userId && { userId }),
        };

        const [data, total] = await Promise.all([
            this.prisma.prediction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { submittedAt: 'desc' },
                include: {
                    user: { select: { id: true, name: true, username: true, avatar: true } },
                    match: {
                        include: { homeTeam: true, awayTeam: true },
                    },
                    league: { select: { id: true, name: true } },
                },
            }),
            this.prisma.prediction.count({ where }),
        ]);

        return { data, total, page, limit };
    }
}
