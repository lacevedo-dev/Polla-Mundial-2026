import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InsightsService } from './insights.service';

export class MatchInsightsDto {
    @IsString()
    homeTeam: string;

    @IsString()
    awayTeam: string;

    @IsOptional()
    @IsString()
    phase?: string;

    @IsOptional()
    @IsString()
    group?: string;
}

@ApiTags('insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
    constructor(private readonly insightsService: InsightsService) {}

    @Post('match/:matchId')
    @ApiOperation({ summary: 'Generate AI-powered Smart Insights for a match' })
    async getMatchInsights(
        @Param('matchId') _matchId: string,
        @Body() dto: MatchInsightsDto,
    ) {
        return this.insightsService.generateInsights(
            dto.homeTeam,
            dto.awayTeam,
            dto.phase,
            dto.group,
        );
    }
}
