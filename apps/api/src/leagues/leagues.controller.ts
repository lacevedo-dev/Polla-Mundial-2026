import { Controller, Post, Body, Get, Param, Patch, Delete, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
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

    @HttpCode(HttpStatus.OK)
    @Post('join')
    async joinLeague(@Request() req, @Body('code') code: string) {
        const userId = req.user.userId;
        return this.leaguesService.joinLeagueByCode(userId, code);
    }

    @Get('public')
    async getPublicLeagues(@Request() req) {
        return this.leaguesService.findPublicLeagues(req.user.userId);
    }

    @Get('invitations')
    async getMyInvitations(@Request() req) {
        return this.leaguesService.findMyInvitations(req.user.userId);
    }

    @HttpCode(HttpStatus.OK)
    @Post('invitations/:id/accept')
    async acceptInvitation(@Request() req, @Param('id') invitationId: string) {
        return this.leaguesService.acceptInvitation(req.user.userId, invitationId);
    }

    @HttpCode(HttpStatus.OK)
    @Post('invitations/:id/decline')
    async declineInvitation(@Request() req, @Param('id') invitationId: string) {
        return this.leaguesService.declineInvitation(invitationId);
    }

    @Get(':id')
    async getLeagueDetails(@Request() req, @Param('id') leagueId: string) {
        const userId = req.user.userId;
        return this.leaguesService.getLeagueDetails(userId, leagueId);
    }

    @Patch(':id')
    async updateLeague(@Request() req, @Param('id') leagueId: string, @Body() dto: UpdateLeagueDto) {
        return this.leaguesService.updateLeague(req.user.userId, leagueId, dto);
    }

    @HttpCode(HttpStatus.OK)
    @Delete(':id/members/:userId')
    async removeMember(@Request() req, @Param('id') leagueId: string, @Param('userId') targetUserId: string) {
        return this.leaguesService.removeMember(req.user.userId, leagueId, targetUserId);
    }

    /* ── Payment obligations (league admin) ── */

    @Get(':id/payments')
    async getLeaguePayments(@Request() req, @Param('id') leagueId: string) {
        return this.leaguesService.getLeaguePaymentObligations(req.user.userId, leagueId);
    }

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
