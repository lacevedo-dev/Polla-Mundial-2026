import { Controller, Get, Post, Body, Param, Patch, UseGuards, Query } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { CreateMatchDto, UpdateMatchScoreDto } from './dto/match.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Phase } from '@prisma/client';

@Controller('matches')
export class MatchesController {
    constructor(private readonly matchesService: MatchesService) { }

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

    @UseGuards(JwtAuthGuard)
    @Patch(':id/score')
    async updateScore(
        @Param('id') id: string,
        @Body() updateScoreDto: UpdateMatchScoreDto,
    ) {
        return this.matchesService.updateScore(id, updateScoreDto);
    }
}
