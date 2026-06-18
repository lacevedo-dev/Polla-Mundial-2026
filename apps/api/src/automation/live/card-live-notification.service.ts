import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappGroupService } from '../../whatsapp/whatsapp-group.service';
import type { NewRedCardEvent } from '../../matches/match-events.util';

export type RedCardDispatchParams = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  card: NewRedCardEvent;
};

@Injectable()
export class CardLiveNotificationService {
  private readonly logger = new Logger(CardLiveNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(WhatsappGroupService) private readonly waGroup?: WhatsappGroupService,
  ) {}

  /** Encola RED_CARD en grupos WA de ligas con predicciones en el partido. */
  async dispatchRedCard(params: RedCardDispatchParams): Promise<void> {
    try {
      const predictions = await this.prisma.prediction.findMany({
        where: { matchId: params.matchId },
        select: { leagueId: true },
      });

      if (predictions.length === 0) {
        this.logger.debug(
          `RED_CARD skipped for match ${params.matchId}: no predictions`,
        );
        return;
      }

      if (!this.waGroup) {
        this.logger.warn(
          `RED_CARD skipped for match ${params.matchId}: WhatsappGroupService unavailable`,
        );
        return;
      }

      const leagueIds = [...new Set(predictions.map((p) => p.leagueId))];
      const leagues =
        leagueIds.length > 0
          ? await this.prisma.league.findMany({
              where: { id: { in: leagueIds } },
              select: { id: true, name: true },
            })
          : [];
      const leagueNameById = new Map(leagues.map((l) => [l.id, l.name]));

      let enqueued = 0;
      for (const leagueId of leagueIds) {
        const leagueName = leagueNameById.get(leagueId) ?? 'Polla';
        const ok = await this.waGroup.enqueueRedCardNotification(
          params.matchId,
          leagueId,
          {
            homeTeam: params.homeTeamName,
            awayTeam: params.awayTeamName,
            homeScore: params.homeScore,
            awayScore: params.awayScore,
            elapsed: params.elapsed,
            leagueName,
            playerName: params.card.playerName,
            teamName: params.card.teamName,
            cardDetail: params.card.detail,
            minute: params.card.minute,
            extraMin: params.card.extraMin,
          },
        );
        if (ok) enqueued++;
      }

      this.logger.log(
        `RED_CARD dispatch match=${params.matchId} player=${params.card.playerName ?? '?'} ` +
          `min=${params.card.minute} leagues=${leagueIds.length} enqueued=${enqueued}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `RED_CARD dispatch failed for match ${params.matchId}: ${message}`,
      );
    }
  }
}
