import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappGroupService } from '../../whatsapp/whatsapp-group.service';
import type {
  NewRedCardEvent,
  NewSubstitutionEvent,
  NewYellowCardEvent,
} from '../../matches/match-events.util';

export type RedCardDispatchParams = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  card: NewRedCardEvent;
};

export type YellowCardDispatchParams = Omit<RedCardDispatchParams, 'card'> & {
  card: NewYellowCardEvent;
};

export type SubstitutionDispatchParams = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  substitution: NewSubstitutionEvent;
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
    await this.dispatchForLeagues(params.matchId, 'RED_CARD', async (leagueId, leagueName) => {
      if (!this.waGroup) return false;
      return this.waGroup.enqueueRedCardNotification(params.matchId, leagueId, {
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
      });
    }, `player=${params.card.playerName ?? '?'} min=${params.card.minute}`);
  }

  /** Encola YELLOW_CARD en grupos WA de ligas con predicciones en el partido. */
  async dispatchYellowCard(params: YellowCardDispatchParams): Promise<void> {
    await this.dispatchForLeagues(params.matchId, 'YELLOW_CARD', async (leagueId, leagueName) => {
      if (!this.waGroup) return false;
      return this.waGroup.enqueueYellowCardNotification(params.matchId, leagueId, {
        homeTeam: params.homeTeamName,
        awayTeam: params.awayTeamName,
        homeScore: params.homeScore,
        awayScore: params.awayScore,
        elapsed: params.elapsed,
        leagueName,
        playerName: params.card.playerName,
        teamName: params.card.teamName,
        minute: params.card.minute,
        extraMin: params.card.extraMin,
      });
    }, `player=${params.card.playerName ?? '?'} min=${params.card.minute}`);
  }

  /** Encola SUBSTITUTION en grupos WA de ligas con predicciones en el partido. */
  async dispatchSubstitution(params: SubstitutionDispatchParams): Promise<void> {
    await this.dispatchForLeagues(
      params.matchId,
      'SUBSTITUTION',
      async (leagueId, leagueName) => {
        if (!this.waGroup) return false;
        return this.waGroup.enqueueSubstitutionNotification(params.matchId, leagueId, {
          homeTeam: params.homeTeamName,
          awayTeam: params.awayTeamName,
          homeScore: params.homeScore,
          awayScore: params.awayScore,
          elapsed: params.elapsed,
          leagueName,
          playerInName: params.substitution.playerInName,
          playerOutName: params.substitution.playerOutName,
          teamName: params.substitution.teamName,
          minute: params.substitution.minute,
          extraMin: params.substitution.extraMin,
        });
      },
      `in=${params.substitution.playerInName ?? '?'} out=${params.substitution.playerOutName ?? '?'} min=${params.substitution.minute}`,
    );
  }

  private async dispatchForLeagues(
    matchId: string,
    label: 'RED_CARD' | 'YELLOW_CARD' | 'SUBSTITUTION',
    enqueue: (leagueId: string, leagueName: string) => Promise<boolean>,
    detail: string,
  ): Promise<void> {
    try {
      const predictions = await this.prisma.prediction.findMany({
        where: { matchId },
        select: { leagueId: true },
      });

      if (predictions.length === 0) {
        this.logger.debug(`${label} skipped for match ${matchId}: no predictions`);
        return;
      }

      if (!this.waGroup) {
        this.logger.warn(`${label} skipped for match ${matchId}: WhatsappGroupService unavailable`);
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
        const ok = await enqueue(leagueId, leagueName);
        if (ok) enqueued++;
      }

      this.logger.log(
        `${label} dispatch match=${matchId} ${detail} leagues=${leagueIds.length} enqueued=${enqueued}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${label} dispatch failed for match ${matchId}: ${message}`);
    }
  }
}
