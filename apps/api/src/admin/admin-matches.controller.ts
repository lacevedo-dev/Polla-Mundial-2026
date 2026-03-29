import {
    Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
    NotFoundException, ParseIntPipe, DefaultValuePipe, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Phase, MatchStatus } from '@prisma/client';
import { IsOptional, IsEnum, IsString, IsNumber, IsDateString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MatchesService } from '../matches/matches.service';
import { PredictionsService } from '../predictions/predictions.service';

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
    @IsOptional() @IsString() externalId?: string;
    @IsOptional() @IsString() linkSource?: 'manual' | 'suggested';
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
        private readonly predictionsService: PredictionsService,
    ) {}

    private parseAuditDetail(detail?: string | null) {
        if (!detail) return null;
        try {
            return JSON.parse(detail);
        } catch {
            return null;
        }
    }

    private parseDateComponent(dateValue: string) {
        const [datePart] = dateValue.split('T');
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
        if (!match) {
            throw new BadRequestException('startDate/endDate deben tener formato YYYY-MM-DD');
        }

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const probe = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        if (
            probe.getUTCFullYear() !== year
            || probe.getUTCMonth() !== month - 1
            || probe.getUTCDate() !== day
        ) {
            throw new BadRequestException('startDate/endDate no son fechas válidas');
        }

        return { year, month, day };
    }

    private buildMatchDateBoundary(dateValue: string, boundary: 'gte' | 'lt') {
        const { year, month, day } = this.parseDateComponent(dateValue);
        return boundary === 'gte'
            ? new Date(Date.UTC(year, month - 1, day, 5, 0, 0))
            : new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0));
    }

    @Get()
    @ApiOperation({ summary: 'List all matches' })
    @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Fecha mínima inclusiva en formato YYYY-MM-DD' })
    @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Fecha máxima inclusiva en formato YYYY-MM-DD' })
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
        @Query('phase') phase?: Phase,
        @Query('status') status?: MatchStatus,
        @Query('linked') linked?: string,
        @Query('risk') risk?: 'blocked' | 'failing' | 'healthy',
        @Query('linkSource') linkSource?: 'manual' | 'suggested',
        @Query('tournamentId') tournamentId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const skip = (page - 1) * limit;
        const linkSourceMatchIds = linkSource
            ? Array.from(new Set(
                (await this.prisma.auditLog.findMany({
                    where: {
                        action: 'MATCH_EXTERNAL_LINK_UPDATED',
                        detail: {
                            contains: `"linkSource":"${linkSource}"`,
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    select: { detail: true },
                }))
                    .map((audit) => this.parseAuditDetail(audit.detail)?.matchId as string | undefined)
                    .filter(Boolean),
            ))
            : null;

        const matchDateFilter = {
            ...(startDate ? { gte: this.buildMatchDateBoundary(startDate, 'gte') } : {}),
            ...(endDate ? { lt: this.buildMatchDateBoundary(endDate, 'lt') } : {}),
        };

        const where: any = {
            ...(phase && { phase }),
            ...(status && { status }),
            ...(linked === 'true' ? { NOT: { externalId: null } } : {}),
            ...(linked === 'false' ? { externalId: null } : {}),
            ...(risk === 'blocked' ? { externalId: null } : {}),
            ...(risk === 'failing' ? { NOT: { externalId: null }, syncLogs: { some: { status: 'FAILED' } } } : {}),
            ...(risk === 'healthy' ? { NOT: { externalId: null }, syncLogs: { some: { status: 'SUCCESS' } } } : {}),
            ...(linkSource ? { id: { in: linkSourceMatchIds?.length ? linkSourceMatchIds : ['__none__'] } } : {}),
            ...(tournamentId ? { tournamentId } : {}),
            ...((startDate || endDate) ? { matchDate: matchDateFilter } : {}),
        };

        const [data, total, summaryMatches] = await Promise.all([
            this.prisma.match.findMany({
                where,
                skip,
                take: limit,
                orderBy: { matchDate: 'asc' },
                include: {
                    homeTeam: true,
                    awayTeam: true,
                    tournament: { select: { id: true, name: true, logoUrl: true } },
                    syncLogs: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                },
            }),
            this.prisma.match.count({ where }),
            this.prisma.match.findMany({
                where,
                select: {
                    id: true,
                    externalId: true,
                    syncLogs: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { status: true },
                    },
                },
            }),
        ]);

        const latestLinkAudits = data.length
            ? await this.prisma.auditLog.findMany({
                where: {
                    action: 'MATCH_EXTERNAL_LINK_UPDATED',
                    OR: data.map((match) => ({
                        detail: {
                            contains: `"matchId":"${match.id}"`,
                        },
                    })),
                },
                orderBy: { createdAt: 'desc' },
                select: { detail: true, createdAt: true },
            })
            : [];

        const latestLinkSourceByMatch = new Map<string, 'manual' | 'suggested'>();
        for (const audit of latestLinkAudits) {
            const detail = this.parseAuditDetail(audit.detail);
            if (!detail?.matchId || latestLinkSourceByMatch.has(detail.matchId)) continue;
            if (detail?.linkSource === 'manual' || detail?.linkSource === 'suggested') {
                latestLinkSourceByMatch.set(detail.matchId, detail.linkSource);
            }
        }

        const summary = summaryMatches.reduce((acc, match) => {
            const latestStatus = match.syncLogs[0]?.status ?? null;
            if (!match.externalId) acc.blocked += 1;
            else if (latestStatus === 'FAILED') acc.failing += 1;
            else if (latestStatus === 'SUCCESS') acc.healthy += 1;
            else acc.pending += 1;
            return acc;
        }, { blocked: 0, failing: 0, healthy: 0, pending: 0 });

        return {
            data: data.map(({ syncLogs, tournament, ...match }) => ({
                ...match,
                tournamentId: tournament?.id ?? null,
                tournamentName: tournament?.name ?? null,
                tournamentLogo: tournament?.logoUrl ?? null,
                lastSyncStatus: syncLogs[0]?.status ?? null,
                lastSyncMessage: syncLogs[0]?.message ?? null,
                lastSyncError: syncLogs[0]?.error ?? null,
                lastSyncTriggeredBy: syncLogs[0]?.triggeredBy ?? null,
                currentLinkSource: latestLinkSourceByMatch.get(match.id) ?? null,
            })),
            total,
            summary,
            page,
            limit,
        };
    }

    @Post()
    @ApiOperation({ summary: 'Create a new match' })
    async create(@Body() dto: AdminCreateMatchDto) {
        return this.matchesService.create(dto as any);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update match details' })
    async update(@Param('id') id: string, @Body() dto: AdminUpdateMatchDto, @CurrentUser() user: { id?: string }) {
        const match = await this.prisma.match.findUnique({ where: { id } });
        if (!match) throw new NotFoundException('Partido no encontrado');
        const data = {
            ...dto,
            ...(dto.externalId !== undefined ? { externalId: dto.externalId.trim() || null } : {}),
        };
        const updatedMatch = await this.prisma.match.update({
            where: { id },
            data: data as any,
            include: {
                homeTeam: true,
                awayTeam: true,
                syncLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        if (dto.externalId !== undefined && match.externalId !== updatedMatch.externalId && user?.id) {
            await this.prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: updatedMatch.externalId ? 'MATCH_EXTERNAL_LINK_UPDATED' : 'MATCH_EXTERNAL_LINK_REMOVED',
                    detail: JSON.stringify({
                        matchId: id,
                        previousExternalId: match.externalId,
                        externalId: updatedMatch.externalId,
                        linkSource: dto.linkSource ?? 'manual',
                    }),
                },
            });
        }

        const { syncLogs, ...matchWithoutLogs } = updatedMatch;
        return {
            ...matchWithoutLogs,
            lastSyncStatus: syncLogs[0]?.status ?? null,
            lastSyncMessage: syncLogs[0]?.message ?? null,
            lastSyncError: syncLogs[0]?.error ?? null,
            lastSyncTriggeredBy: syncLogs[0]?.triggeredBy ?? null,
        };
    }

    @Patch(':id/score')
    @ApiOperation({ summary: 'Update match score and trigger points calculation' })
    async updateScore(@Param('id') id: string, @Body() dto: AdminUpdateScoreDto) {
        return this.matchesService.updateScore(id, dto);
    }

    @Post('recalculate-all')
    @ApiOperation({ summary: 'Recalculate points for all finished matches' })
    async recalculateAll() {
        const finishedMatches = await this.prisma.match.findMany({
            where: { status: 'FINISHED', homeScore: { not: null }, awayScore: { not: null } },
            select: { id: true, phase: true },
            orderBy: { matchDate: 'asc' },
        });

        let processed = 0;
        const errors: { matchId: string; error: string }[] = [];

        for (const match of finishedMatches) {
            try {
                await this.predictionsService.calculateMatchPoints(match.id);
                await this.predictionsService.calculatePhaseBonuses(match.id);
                processed++;
            } catch (err) {
                errors.push({ matchId: match.id, error: err instanceof Error ? err.message : String(err) });
            }
        }

        return { total: finishedMatches.length, processed, errors };
    }

    @Post(':id/recalculate')
    @ApiOperation({ summary: 'Recalculate points for a single finished match' })
    async recalculateOne(@Param('id') id: string) {
        const match = await this.prisma.match.findUnique({ where: { id } });
        if (!match) throw new NotFoundException('Partido no encontrado');
        await this.predictionsService.calculateMatchPoints(id);
        await this.predictionsService.calculatePhaseBonuses(id);
        return { ok: true, matchId: id };
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

    @Get(':id/sync-history')
    @ApiOperation({ summary: 'Get sync and link history for a match' })
    async getMatchSyncHistory(@Param('id') id: string) {
        const match = await this.prisma.match.findUnique({ where: { id } });
        if (!match) throw new NotFoundException('Partido no encontrado');

        const [syncLogs, auditLogs] = await Promise.all([
            this.prisma.footballSyncLog.findMany({
                where: { matchId: id },
                orderBy: { createdAt: 'desc' },
                take: 8,
            }),
            this.prisma.auditLog.findMany({
                where: {
                    action: {
                        in: ['MATCH_EXTERNAL_LINK_UPDATED', 'MATCH_EXTERNAL_LINK_REMOVED'],
                    },
                    detail: {
                        contains: `"matchId":"${id}"`,
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            }),
        ]);

        return {
            syncLogs,
            linkAudit: auditLogs.map((audit) => ({
                id: audit.id,
                action: audit.action,
                detail: audit.detail,
                detailData: this.parseAuditDetail(audit.detail),
                createdAt: audit.createdAt,
                user: audit.user,
            })),
        };
    }
}
