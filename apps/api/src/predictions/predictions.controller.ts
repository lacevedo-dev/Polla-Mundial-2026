import { Controller, Post, Body, Get, Param, UseGuards, Request, Query } from '@nestjs/common';
import { PredictionsService } from './predictions.service';
import { CreatePredictionDto } from './dto/prediction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('predictions')
export class PredictionsController {
    constructor(private readonly predictionsService: PredictionsService) { }

    @Post()
    async upsert(@Request() req, @Body() createPredictionDto: CreatePredictionDto) {
        const userId = req.user.userId;
        return this.predictionsService.upsertPrediction(userId, createPredictionDto);
    }

    @Get('league/:leagueId')
    async getMyPredictions(@Request() req, @Param('leagueId') leagueId: string) {
        const userId = req.user.userId;
        return this.predictionsService.findByLeagueAndUser(leagueId, userId);
    }

    @Get('leaderboard/:leagueId')
    async getLeaderboard(
        @Param('leagueId') leagueId: string,
        @Query('category') category?: string,
    ) {
        return this.predictionsService.getLeaderboard(leagueId, category);
    }

    @Get('leaderboard/:leagueId/user/:userId')
    async getLeaderboardUserBreakdown(
        @Param('leagueId') leagueId: string,
        @Param('userId') userId: string,
        @Query('category') category?: string,
    ) {
        return this.predictionsService.getLeaderboardUserBreakdown(leagueId, userId, category);
    }

    /** Clasificación provisional considerando el marcador actual de partidos en vivo */
    @Get('live-standings/:leagueId')
    async getLiveStandings(
        @Param('leagueId') leagueId: string,
        @Request() req,
    ) {
        return this.predictionsService.getLiveStandings(leagueId, req.user.userId);
    }
}
