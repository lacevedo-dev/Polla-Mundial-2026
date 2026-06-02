import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FootballProxyService } from './football-proxy.service';
import { JwtAuthGuard } from '@corp-api/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('corp/football')
export class FootballProxyController {
    constructor(private readonly proxy: FootballProxyService) {}

    @Get('matches')
    getMatches(
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('tournamentId') tournamentId?: string,
    ) {
        return this.proxy.getMatches({ from, to, tournamentId });
    }

    @Get('tournaments')
    getTournaments() {
        return this.proxy.getTournaments();
    }

    @Get('teams')
    getTeams() {
        return this.proxy.getTeams();
    }
}
