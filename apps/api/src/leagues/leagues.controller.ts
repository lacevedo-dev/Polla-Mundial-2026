import { Controller, Post, Body, Get, Param, Patch, Delete, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('leagues')
export class LeaguesController {
    constructor(private readonly leaguesService: LeaguesService) { }

    // ── Endpoint público (sin autenticación) ──────────────────────────────

    @Get('info-by-code/:code')
    async getInfoByCode(@Param('code') code: string) {
        return this.leaguesService.getInfoByCode(code);
    }

    // ── Endpoints protegidos ──────────────────────────────────────────────

    @UseGuards(JwtAuthGuard)
    @Get('tournaments')
    async listTournaments() {
        return this.leaguesService.listAvailableTournaments();
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    async createLeague(@Request() req, @Body() createLeagueDto: CreateLeagueDto) {
        const userId = req.user.userId;
        return this.leaguesService.create(userId, createLeagueDto);
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async getMyLeagues(@Request() req) {
        const userId = req.user.userId;
        return this.leaguesService.findAllByUserId(userId);
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('join')
    async joinLeague(@Request() req, @Body('code') code: string) {
        const userId = req.user.userId;
        return this.leaguesService.joinLeagueByCode(userId, code);
    }

    @UseGuards(JwtAuthGuard)
    @Get('public')
    async getPublicLeagues(@Request() req) {
        return this.leaguesService.findPublicLeagues(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('invitations')
    async getMyInvitations(@Request() req) {
        return this.leaguesService.findMyInvitations(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('invitations/:id/accept')
    async acceptInvitation(@Request() req, @Param('id') invitationId: string) {
        return this.leaguesService.acceptInvitation(req.user.userId, invitationId);
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('invitations/:id/decline')
    async declineInvitation(@Request() req, @Param('id') invitationId: string) {
        return this.leaguesService.declineInvitation(invitationId);
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    async getLeagueDetails(@Request() req, @Param('id') leagueId: string) {
        const userId = req.user.userId;
        return this.leaguesService.getLeagueDetails(userId, leagueId);
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Patch(':id/tournament')
    async setLeagueTournament(
        @Request() req,
        @Param('id') leagueId: string,
        @Body('tournamentId') tournamentId: string | undefined,
    ) {
        return this.leaguesService.setLeagueTournament(req.user.userId, leagueId, tournamentId ?? null);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async updateLeague(@Request() req, @Param('id') leagueId: string, @Body() dto: UpdateLeagueDto) {
        return this.leaguesService.updateLeague(req.user.userId, leagueId, dto);
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Delete(':id/members/:userId')
    async removeMember(@Request() req, @Param('id') leagueId: string, @Param('userId') targetUserId: string) {
        return this.leaguesService.removeMember(req.user.userId, leagueId, targetUserId);
    }

    /* ── Payment obligations (league admin) ── */

    @UseGuards(JwtAuthGuard)
    @Get(':id/payments')
    async getLeaguePayments(@Request() req, @Param('id') leagueId: string) {
        return this.leaguesService.getLeaguePaymentObligations(req.user.userId, leagueId);
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post(':id/payments/:obligationId/confirm')
    async confirmPayment(
        @Request() req,
        @Param('id') leagueId: string,
        @Param('obligationId') obligationId: string,
        @Body() body: { method: string; reference?: string; note?: string },
    ) {
        return this.leaguesService.confirmObligation(req.user.userId, leagueId, obligationId, body);
    }

    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post(':id/payments/:obligationId/reset')
    async resetPayment(
        @Request() req,
        @Param('id') leagueId: string,
        @Param('obligationId') obligationId: string,
    ) {
        return this.leaguesService.resetObligation(req.user.userId, leagueId, obligationId);
    }
}
