import {
    Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
    NotFoundException, ParseIntPipe, DefaultValuePipe, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Phase, MatchStatus, SyncLogStatus } from '@prisma/client';
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

const MAX_MATCHES_PAGE_LIMIT = 100;
const LINK_SOURCE_AUDIT_SCAN_LIMIT = 2000;
const PAGE_LINK_AUDIT_SCAN_LIMIT = 1000;
const VALID_RISKS = ['blocked', 'failing', 'healthy'] as const;
const VALID_LINK_SOURCES = ['manual', 'suggested'] as const;

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
        // Los detalles de auditoría son LongText; no intentes parsear blobs enormes
        // en endpoints de listado porque pueden bloquear el event loop.
        if (detail.length > 10_000) return null;
        try {
            return JSON.parse(detail);
        } catch {
            return null;
        }
    }

    private assertPositiveInt(value: number, field: string, max?: number) {
        if (!Number.isInteger(value) || value < 1) {
            throw new BadRequestException(`${field} debe ser un entero positivo`);
        }
        if (max && value > max) {
            throw new BadRequestException(`${field} no puede ser mayor a ${max}`);
        }
        return value;
    }

    private validateOptionalEnum<T extends string>(value: T | undefined, allowed: readonly T[], field: string) {
        if (value === undefined || value === null || value === '') return undefined;
        if (!allowed.includes(value)) {
            throw new BadRequestException(`${field} no es válido`);
        }
        return value;
    }

    private andWhere(where: Record<string, unknown>, extra: Record<string, unknown>) {
        return { AND: [where, extra] };
    }

    private async getSummary(where: Record<string, unknown>) {
        const [blocked, failing, healthy, pending] = await Promise.all([
            this.prisma.match.count({ where: this.andWhere(where, { externalId: null }) }),
            this.prisma.match.count({
                where: this.andWhere(where, {
                    NOT: { externalId: null },
                    syncLogs: { some: { status: SyncLogStatus.FAILED } },
                }),
            }),
            this.prisma.match.count({
                where: this.andWhere(where, {
                    NOT: { externalId: null },
                    syncLogs: { some: { status: SyncLogStatus.SUCCESS } },
                }),
            }),
            this.prisma.match.count({
                where: this.andWhere(where, {
                    NOT: { externalId: null },
                    syncLogs: { none: { status: { in: [SyncLogStatus.FAILED, SyncLogStatus.SUCCESS] } } },
                }),
            }),
        ]);

        return { blocked, failing, healthy, pending };
    }

    private async getRecentMatchIdsByLinkSource(linkSource: 'manual' | 'suggested') {
        const audits = await this.prisma.auditLog.findMany({
            where: { action: 'MATCH_EXTERNAL_LINK_UPDATED' },
            orderBy: { createdAt: 'desc' },
            take: LINK_SOURCE_AUDIT_SCAN_LIMIT,
            select: { detail: true },
        });

        const ids = new Set<string>();
        for (const audit of audits) {
            const detail = this.parseAuditDetail(audit.detail);
            if (detail?.linkSource === linkSource && typeof detail.matchId === 'string') {
                ids.add(detail.matchId);
            }
        }

        return [...ids];
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
        const safePage = this.assertPositiveInt(page, 'page');
        const safeLimit = this.assertPositiveInt(limit, 'limit', MAX_MATCHES_PAGE_LIMIT);
        const phaseFilter = this.validateOptionalEnum(phase, Object.values(Phase), 'phase');
        const statusFilter = this.validateOptionalEnum(status, Object.values(MatchStatus), 'status');
        const linkedFilter = this.validateOptionalEnum(linked as 'true' | 'false' | undefined, ['true', 'false'], 'linked');
        const riskFilter = this.validateOptionalEnum(risk, VALID_RISKS, 'risk');
        const linkSourceFilter = this.validateOptionalEnum(linkSource, VALID_LINK_SOURCES, 'linkSource');
        const skip = (safePage - 1) * safeLimit;
        const linkSourceMatchIds = linkSourceFilter
            ? await this.getRecentMatchIdsByLinkSource(linkSourceFilter)
            : null;

        const matchDateFilter = {
            ...(startDate ? { gte: this.buildMatchDateBoundary(startDate, 'gte') } : {}),
            ...(endDate ? { lt: this.buildMatchDateBoundary(endDate, 'lt') } : {}),
        };

        const where: any = {
            ...(phaseFilter && { phase: phaseFilter }),
            ...(statusFilter && { status: statusFilter }),
            ...(linkedFilter === 'true' ? { NOT: { externalId: null } } : {}),
            ...(linkedFilter === 'false' ? { externalId: null } : {}),
            ...(riskFilter === 'blocked' ? { externalId: null } : {}),
            ...(riskFilter === 'failing' ? { NOT: { externalId: null }, syncLogs: { some: { status: SyncLogStatus.FAILED } } } : {}),
            ...(riskFilter === 'healthy' ? { NOT: { externalId: null }, syncLogs: { some: { status: SyncLogStatus.SUCCESS } } } : {}),
            ...(linkSourceFilter ? { id: { in: linkSourceMatchIds?.length ? linkSourceMatchIds : ['__none__'] } } : {}),
            ...(tournamentId ? { tournamentId } : {}),
            ...((startDate || endDate) ? { matchDate: matchDateFilter } : {}),
        };

        const [data, total] = await Promise.all([
            this.prisma.match.findMany({
                where,
                skip,
                take: safeLimit,
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
        ]);

        const summary = await this.getSummary(where);

        const pageMatchIds = new Set(data.map((m) => m.id));
        const latestLinkAudits = data.length
            ? (await this.prisma.auditLog.findMany({
                where: { action: 'MATCH_EXTERNAL_LINK_UPDATED' },
                orderBy: { createdAt: 'desc' },
                take: PAGE_LINK_AUDIT_SCAN_LIMIT,
                select: { detail: true, createdAt: true },
            }))
            : [];

        const latestLinkSourceByMatch = new Map<string, 'manual' | 'suggested'>();
        for (const audit of latestLinkAudits) {
            const detail = this.parseAuditDetail(audit.detail);
            if (!detail?.matchId || !pageMatchIds.has(detail.matchId) || latestLinkSourceByMatch.has(detail.matchId)) continue;
            if (detail?.linkSource === 'manual' || detail?.linkSource === 'suggested') {
                latestLinkSourceByMatch.set(detail.matchId, detail.linkSource);
            }
        }

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
            page: safePage,
            limit: safeLimit,
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
        const { linkSource, ...matchFields } = dto;
        const data = {
            ...matchFields,
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
                        linkSource: linkSource ?? 'manual',
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
