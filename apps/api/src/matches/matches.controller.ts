import { Controller, Get, Post, Body, Param, Patch, UseGuards, Query, Sse, Res, MessageEvent } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { CreateMatchDto, UpdateMatchScoreDto } from './dto/match.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Phase } from '@prisma/client';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { Response } from 'express';
import { SyncEventsService } from '../football-sync/services/sync-events.service';
import { SyncPlanService } from '../football-sync/services/sync-plan.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('matches')
export class MatchesController {
    constructor(
        private readonly matchesService: MatchesService,
        private readonly syncEvents: SyncEventsService,
        private readonly syncPlan: SyncPlanService,
        private readonly prisma: PrismaService,
    ) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@Body() createMatchDto: CreateMatchDto) {
        return this.matchesService.create(createMatchDto);
    }

    @Get()
    async findAll(
        @Query('phase') phase?: Phase,
        @Query('leagueId') leagueId?: string,
    ) {
        if (leagueId) {
            return this.matchesService.findByLeague(leagueId);
        }
        if (phase) {
            return this.matchesService.findByPhase(phase);
        }
        return this.matchesService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.matchesService.findOne(id);
    }

    /** Eventos (goles, tarjetas) de un partido */
    @Get(':id/events')
    async getEvents(@Param('id') id: string) {
        const events = await (this.prisma as any).matchEvent.findMany({
            where: { matchId: id },
            orderBy: [{ minute: 'asc' }, { extraMin: 'asc' }],
            select: {
                id: true, type: true, detail: true,
                playerName: true, assistName: true,
                minute: true, extraMin: true,
            },
        });
        return events;
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/score')
    async updateScore(
        @Param('id') id: string,
        @Body() updateScoreDto: UpdateMatchScoreDto,
    ) {
        return this.matchesService.updateScore(id, updateScoreDto);
    }

    @Sse('live/stream')
    @UseGuards(JwtAuthGuard)
    liveMatchEvents(@Res() res: Response): Observable<MessageEvent> {
        const heartbeat = setInterval(() => {
            try { res.write(': heartbeat\n\n'); } catch { /* closed */ }
        }, 25000);
        res.on('close', () => clearInterval(heartbeat));

        return this.syncEvents.getObservable().pipe(
            filter(e => e.type === 'match_updated' || e.type === 'sync_completed'),
            map((event): MessageEvent => ({
                type: event.type,
                data: JSON.stringify(event.data),
                id: String(event.timestamp),
            })),
        );
    }

    @Get('live/sync-info')
    @UseGuards(JwtAuthGuard)
    async getLiveSyncInfo() {
        const plan = await this.syncPlan.calculateDailyPlan();
        return {
            intervalMinutes: plan.intervalMinutes,
            lastSync: plan.lastSync,
            nextSyncIn: plan.nextSyncIn,
            hasLiveMatches: plan.hasLiveMatches,
            strategy: plan.strategy,
        };
    }
}
