import { Controller, Post, Body, Get, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('leagues')
export class LeaguesController {
    constructor(private readonly leaguesService: LeaguesService) { }

    @Post()
    async createLeague(@Request() req, @Body() createLeagueDto: CreateLeagueDto) {
        const userId = req.user.userId;
        return this.leaguesService.create(userId, createLeagueDto);
    }

    @Get()
    async getMyLeagues(@Request() req) {
        const userId = req.user.userId;
        return this.leaguesService.findAllByUserId(userId);
    }

    @Get(':id')
    async getLeagueDetails(@Request() req, @Param('id') leagueId: string) {
        const userId = req.user.userId;
        return this.leaguesService.getLeagueDetails(userId, leagueId);
    }

    @HttpCode(HttpStatus.OK)
    @Post('join')
    async joinLeague(@Request() req, @Body('code') code: string) {
        const userId = req.user.userId;
        return this.leaguesService.joinLeagueByCode(userId, code);
    }
}
