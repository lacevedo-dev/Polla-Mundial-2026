import { Controller, Get, Post, Body, Param, Patch, UseGuards, Query, Sse, Res, MessageEvent } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { CreateMatchDto, UpdateMatchScoreDto } from './dto/match.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Phase } from '@prisma/client';
import type { PlayerProfile } from '@prisma/client';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { Response } from 'express';
import { SyncEventsService } from '../football-sync/services/sync-events.service';
import { SyncPlanService } from '../football-sync/services/sync-plan.service';
import { PrismaService } from '../prisma/prisma.service';
import { dedupeMatchEvents } from './match-events.util';
import { LiveDisplayConfigService } from '../automation/config/live-display-config.service';
import { GoalStickerConfigService } from '../automation/config/goal-sticker-config.service';
import { resolveTeamStickerTheme, resolveStickerCountryCode } from '../football-sync/catalog/team-sticker-theme.util';

@Controller('matches')
export class MatchesController {
    constructor(
        private readonly matchesService: MatchesService,
        private readonly syncEvents: SyncEventsService,
        private readonly syncPlan: SyncPlanService,
        private readonly prisma: PrismaService,
        private readonly liveDisplayConfig: LiveDisplayConfigService,
        private readonly goalStickerConfig: GoalStickerConfigService,
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

    /** Eventos (goles, tarjetas) de un partido — incluye perfil cacheado si existe */
    @Get(':id/events')
    async getEvents(@Param('id') id: string) {
        const events = await this.prisma.matchEvent.findMany({
            where: { matchId: id },
            orderBy: [{ minute: 'asc' }, { extraMin: 'asc' }, { updatedAt: 'asc' }],
            select: {
                id: true, type: true, detail: true,
                playerName: true, assistName: true,
                playerExternalId: true,
                minute: true, extraMin: true, teamId: true,
                annulled: true, annulledReason: true,
            },
        });

        const playerIds = events
            .map((e) => e.playerExternalId)
            .filter((pid): pid is number => pid != null);
        const teamIds = [...new Set(events.map((e) => e.teamId).filter(Boolean))] as string[];

        const [profiles, teams] = await Promise.all([
            playerIds.length > 0
                ? this.prisma.playerProfile.findMany({
                    where: { apiFootballPlayerId: { in: playerIds } },
                })
                : [],
            teamIds.length > 0
                ? this.prisma.team.findMany({
                    where: { id: { in: teamIds } },
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        shortCode: true,
                        flagUrl: true,
                        stickerPrimaryColor: true,
                        stickerSecondaryColor: true,
                        stickerAccentColor: true,
                        stickerPillFromColor: true,
                        stickerPillToColor: true,
                    },
                })
                : [],
        ]);

        const profileByApiId = new Map<number, PlayerProfile>(
            profiles.map((p) => [p.apiFootballPlayerId, p] as const),
        );
        type TeamStickerRow = (typeof teams)[number];
        const teamById = new Map<string, TeamStickerRow>(
            teams.map((t) => [t.id, t] as const),
        );

        return dedupeMatchEvents(events.map((event) => {
            const profile = event.playerExternalId
                ? profileByApiId.get(event.playerExternalId)
                : undefined;
            const team = event.teamId ? teamById.get(event.teamId) : undefined;
            const theme = team ? resolveTeamStickerTheme(team) : null;

            return {
                ...event,
                type: String(event.type).trim().toUpperCase(),
                playerProfile: profile
                    ? {
                        photoUrl: profile.photoUrl,
                        jerseyNumber: profile.jerseyNumber,
                        birthDate: profile.birthDate,
                        height: profile.height,
                        weight: profile.weight,
                        nationality: profile.nationality,
                    }
                    : null,
                teamStickerTheme: team && theme
                    ? {
                        primary: theme.primary,
                        secondary: theme.secondary,
                        accent: theme.accent,
                        pillFrom: theme.pillFrom,
                        pillTo: theme.pillTo,
                        flagUrl: team.flagUrl,
                        countryCode: resolveStickerCountryCode({
                            code: team.code,
                            shortCode: team.shortCode,
                            teamName: team.name,
                        }),
                    }
                    : null,
            };
        }));
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
        const [plan, liveDisplay] = await Promise.all([
            this.syncPlan.calculateDailyPlan(),
            this.liveDisplayConfig.getSettings(),
        ]);
        return {
            intervalMinutes: plan.intervalMinutes,
            lastSync: plan.lastSync,
            nextSyncIn: plan.nextSyncIn,
            hasLiveMatches: plan.hasLiveMatches,
            strategy: plan.strategy,
            liveDisplay,
        };
    }

    @Get('live/display-settings')
    @UseGuards(JwtAuthGuard)
    async getLiveDisplaySettings() {
        return this.liveDisplayConfig.getSettings();
    }

    @Get('live/goal-sticker-settings')
    @UseGuards(JwtAuthGuard)
    async getGoalStickerSettings() {
        return this.goalStickerConfig.getSettings();
    }
}
