import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrepareParticipationCheckoutDto } from './dto/checkout.dto';
import { UpsertParticipationSelectionsDto } from './dto/selection.dto';
import { ParticipationService } from './participation.service';

@UseGuards(JwtAuthGuard)
@Controller('participation')
export class ParticipationController {
  constructor(private readonly participationService: ParticipationService) {}

  @Get('options')
  async getOptions(
    @Request() req,
    @Query('leagueId') leagueId: string,
    @Query('matchId') matchId?: string,
  ) {
    return this.participationService.getAvailableCategories(
      req.user.userId,
      leagueId,
      matchId,
    );
  }

  @Post('selections')
  async upsertSelections(
    @Request() req,
    @Body() dto: UpsertParticipationSelectionsDto,
  ) {
    return this.participationService.upsertSelections(req.user.userId, dto);
  }

  @Get('summary')
  async getSummary(@Request() req, @Query('leagueId') leagueId: string) {
    return this.participationService.getParticipationSummary(
      req.user.userId,
      leagueId,
    );
  }

  @Post('checkout/prepare')
  async prepareCheckout(
    @Request() req,
    @Body() dto: PrepareParticipationCheckoutDto,
  ) {
    return this.participationService.prepareCheckout(req.user.userId, dto);
  }
}
