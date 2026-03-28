import { Injectable, Logger } from '@nestjs/common';
import { MemberStatus } from '@prisma/client';
import {
  getPendingReportMatches,
  getReportAudienceFromLeague,
  MatchAutomationSweepContext,
  MatchAutomationSweepLeague,
} from '../notifications/match-automation-sweep-context';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionReportEmailService, ResultOutcome } from './prediction-report-email.service';

type PendingReportLeague = {
  id: string;
  name: string;
  code: string;
  closePredictionMinutes: number;
  prefetchedLeague?: MatchAutomationSweepLeague;
};

@Injectable()
export class PredictionReportService {
  private readonly logger = new Logger(PredictionReportService.name);
  private static readonly REPORTABLE_MEMBER_STATUSES = [
    MemberStatus.ACTIVE,
    MemberStatus.PENDING_PAYMENT,
  ] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: PredictionReportEmailService,
  ) {}

  private readonly hasCompletePredictionScores = <
    T extends { homeScore: number | null; awayScore: number | null },
  >(
    prediction: T,
  ): prediction is T & { homeScore: number; awayScore: number } =>
    prediction.homeScore !== null && prediction.awayScore !== null;

  /**
   * Busca matches cuya ventana de predicciones acaba de cerrarse (por liga)
   * y envÃ­a el reporte a todos los miembros activos de cada liga.
   */
  async sendPendingReports(
    context?: MatchAutomationSweepContext,
  ): Promise<void> {
    const now = context?.now ?? new Date();

    const leagues: PendingReportLeague[] = context
      ? context.activeLeagues.map((league) => ({
          id: league.id,
          name: league.name,
          code: league.code,
          closePredictionMinutes: league.closePredictionMinutes,
          prefetchedLeague: league,
        }))
      : await this.prisma.league.findMany({
          select: {
            id: true,
            name: true,
            code: true,
            closePredictionMinutes: true,
          },
        });

    for (const league of leagues) {
      const matches = context
        ? getPendingReportMatches(
            context,
            league.id,
            league.closePredictionMinutes,
          )
        : await this.prisma.match.findMany({
            where: {
              predictionReportSentAt: null,
              matchDate: {
                gt: new Date(
                  now.getTime() - league.closePredictionMinutes * 60_000,
                ),
                lte: new Date(
                  now.getTime() + league.closePredictionMinutes * 60_000,
                ),
              },
              predictions: {
                some: { leagueId: league.id },
              },
            },
            include: {
              homeTeam: true,
              awayTeam: true,
              predictions: {
                where: { leagueId: league.id },
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
                orderBy: { submittedAt: 'asc' },
              },
            },
          });

      for (const match of matches) {
        const leaguePredictions = match.predictions
          .filter((prediction) => prediction.leagueId === league.id)
          .sort(
            (left, right) =>
              left.submittedAt.getTime() - right.submittedAt.getTime(),
          );
        if (leaguePredictions.length === 0) continue;

        const { members, recipients } = await this.getLeagueReportAudience(
          league.id,
          league.prefetchedLeague,
        );
        if (recipients.length === 0) continue;

        const predictors = leaguePredictions.filter(this.hasCompletePredictionScores).map((prediction) => {
          const member = members.find(
            (leagueMember) => leagueMember.userId === prediction.userId,
          );
          return {
            userId: prediction.userId,
            name: this.resolvePredictorName(prediction.user, prediction.userId),
            isAdmin: member?.role === 'ADMIN',
            homeScore: prediction.homeScore,
            awayScore: prediction.awayScore,
            submittedAt: prediction.submittedAt,
          };
        });

        const standings = await this.getStandings(league.id);

        this.logger.log(
          `Enviando reporte de predicciones: ${match.homeTeam.name} vs ${match.awayTeam.name} ` +
            `| Liga: ${league.code} | ${recipients.length} destinatarios`,
        );

        await this.emailService.sendPredictionsReport({
          recipients,
          leagueName: league.name,
          leagueCode: league.code,
          leagueId: league.id,
          matchId: match.id,
          match: {
            homeTeam: match.homeTeam.name,
            awayTeam: match.awayTeam.name,
            matchDate: match.matchDate,
            venue: match.venue ?? undefined,
            round: match.round ?? undefined,
          },
          predictors,
          standings,
          sentAt: now,
        });

        await this.prisma.match.update({
          where: { id: match.id },
          data: { predictionReportSentAt: now },
        });

        this.logger.log(`Reporte enviado para match ${match.id}`);
      }
    }
  }

  /**
   * Genera el reporte para un match/liga especÃƒÂ­fico (para preview o envÃƒÂ­o manual).
   */
  async sendReportForMatch(matchId: string, leagueId: string, testEmail?: string): Promise<void> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        predictions: {
          where: { leagueId },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { submittedAt: 'asc' },
        },
      },
    });

    const league = await this.prisma.league.findUniqueOrThrow({
      where: { id: leagueId },
      select: { name: true, code: true },
    });

    const { members, recipients: allRecipients } = await this.getLeagueReportAudience(leagueId);

    const predictors = match.predictions.filter(this.hasCompletePredictionScores).map(p => {
      const member = members.find(m => m.userId === p.userId);
      return {
        userId:    p.userId,
        name:      this.resolvePredictorName(p.user, p.userId),
        isAdmin:   member?.role === 'ADMIN',
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        submittedAt: p.submittedAt,
      };
    });

    const standings = await this.getStandings(leagueId);

    const recipients = testEmail ? [testEmail] : allRecipients;

    await this.emailService.sendPredictionsReport({
      recipients,
      leagueName: league.name,
      leagueCode: league.code,
      leagueId,
      matchId,
      match: {
        homeTeam:  match.homeTeam.name,
        awayTeam:  match.awayTeam.name,
        matchDate: match.matchDate,
        venue:     match.venue ?? undefined,
        round:     match.round ?? undefined,
      },
      predictors,
      standings,
      sentAt: new Date(),
    });
  }

  async getPreviewHtml(matchId: string, leagueId: string): Promise<string> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        predictions: {
          where: { leagueId },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { submittedAt: 'asc' },
        },
      },
    });

    const league = await this.prisma.league.findUniqueOrThrow({
      where: { id: leagueId },
      select: { name: true, code: true },
    });

    const { members } = await this.getLeagueReportAudience(leagueId);

    const predictors = match.predictions.filter(this.hasCompletePredictionScores).map(p => {
      const member = members.find(m => m.userId === p.userId);
      return {
        userId:    p.userId,
        name:      this.resolvePredictorName(p.user, p.userId),
        isAdmin:   member?.role === 'ADMIN',
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        submittedAt: p.submittedAt,
      };
    });

    const standings = await this.getStandings(leagueId);

    return this.emailService.buildHtml({
      leagueName: league.name,
      leagueCode: league.code,
      match: {
        homeTeam:  match.homeTeam.name,
        awayTeam:  match.awayTeam.name,
        matchDate: match.matchDate,
        venue:     match.venue ?? undefined,
        round:     match.round ?? undefined,
      },
      predictors,
      standings,
      sentAt: new Date(),
    });
  }

  /**
   * EnvÃƒÂ­a el correo de resultados automÃƒÂ¡ticamente cuando un partido termina.
   * Llamado desde MatchSyncService despuÃƒÂ©s de calcular los puntos.
   */
  async sendMatchResultsReport(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match || match.homeScore === null || match.awayScore === null) return;

    // Encontrar todas las ligas que tienen predicciones en este partido
    const leagueIds = await this.prisma.prediction.findMany({
      where: { matchId },
      select: { leagueId: true },
      distinct: ['leagueId'],
    });

    for (const { leagueId } of leagueIds) {
      const league = await this.prisma.league.findUnique({
        where: { id: leagueId },
        select: { name: true, code: true },
      });
      if (!league) continue;

      const { members, recipients } = await this.getLeagueReportAudience(leagueId);
      if (recipients.length === 0) continue;

      const predictions = await this.prisma.prediction.findMany({
        where: { matchId, leagueId, points: { not: null } },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { submittedAt: 'asc' },
      });
      if (predictions.length === 0) continue;

      // Standings ANTES de este partido
      const prevPreds = await this.prisma.prediction.findMany({
        where: { leagueId, points: { not: null }, matchId: { not: matchId } },
        select: { userId: true, points: true },
      });
      const prevTotals = new Map<string, number>();
      for (const p of prevPreds) prevTotals.set(p.userId, (prevTotals.get(p.userId) ?? 0) + (p.points ?? 0));

      // Standings DESPUÃƒâ€°S (incluyendo este partido)
      const afterTotals = new Map<string, number>(prevTotals);
      for (const p of predictions) afterTotals.set(p.userId, (afterTotals.get(p.userId) ?? 0) + (p.points ?? 0));

      const sortedPrev  = [...prevTotals.entries()].sort((a, b) => b[1] - a[1]);
      const sortedAfter = [...afterTotals.entries()].sort((a, b) => b[1] - a[1]);
      const prevStandings  = new Map(sortedPrev.map(([uid, pts], i)  => [uid, { points: pts, position: i + 1 }]));
      const afterStandings = new Map(sortedAfter.map(([uid, pts], i) => [uid, { points: pts, position: i + 1 }]));

      const realHome = match.homeScore!;
      const realAway = match.awayScore!;

      const results = predictions.filter(this.hasCompletePredictionScores).map(p => {
        const member  = members.find(m => m.userId === p.userId);
        const outcome = this.parseOutcomeFromDetail(p.pointDetail, p.points);
        return {
          userId:       p.userId,
          name:         this.resolvePredictorName(p.user, p.userId),
          isAdmin:      member?.role === 'ADMIN',
          homeScore:    p.homeScore,
          awayScore:    p.awayScore,
          submittedAt:  p.submittedAt,
          outcome,
          pointsEarned: p.points ?? 0,
          prevPosition: prevStandings.get(p.userId)?.position ?? 99,
          newPosition:  afterStandings.get(p.userId)?.position ?? 99,
        };
      });

      this.logger.log(
        `Enviando correo de resultados: ${match.homeTeam.name} ${realHome}-${realAway} ${match.awayTeam.name} | ${league.code} | ${recipients.length} destinatarios`,
      );

      await this.emailService.sendResultsReport({
        recipients,
        leagueName: league.name,
        leagueCode: league.code,
        leagueId,
        matchId,
        match: {
          homeTeam:  match.homeTeam.name,
          awayTeam:  match.awayTeam.name,
          matchDate: match.matchDate,
          homeScore: realHome,
          awayScore: realAway,
          venue:     match.venue ?? undefined,
          round:     match.round ?? undefined,
        },
        results,
        sentAt: new Date(),
      });
    }
  }

  async getPreviewStartHtml(matchId: string): Promise<string> {
    const firstPrediction = await this.prisma.prediction.findFirst({
      where: { matchId },
      select: { leagueId: true },
    });
    if (!firstPrediction) return '<p style="font-family:sans-serif;padding:2rem">No hay predicciones para este partido.</p>';
    return this.getPreviewHtml(matchId, firstPrediction.leagueId);
  }

  async getMatchLeagues(matchId: string): Promise<{ id: string; name: string; code: string }[]> {
    const leagueIds = await this.prisma.prediction.findMany({
      where: { matchId },
      select: { leagueId: true },
      distinct: ['leagueId'],
    });
    const leagues = await Promise.all(
      leagueIds.map(({ leagueId }) =>
        this.prisma.league.findUnique({
          where: { id: leagueId },
          select: { id: true, name: true, code: true },
        }),
      ),
    );
    return leagues.filter(Boolean) as { id: string; name: string; code: string }[];
  }

  async getPreviewResultsHtml(matchId: string): Promise<string> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (match.homeScore === null || match.awayScore === null) {
      return '<p style="font-family:sans-serif;padding:2rem">Este partido no tiene resultado registrado.</p>';
    }

    const firstPrediction = await this.prisma.prediction.findFirst({
      where: { matchId, points: { not: null } },
      select: { leagueId: true },
    });
    if (!firstPrediction) {
      return '<p style="font-family:sans-serif;padding:2rem">No hay predicciones con puntos calculados para este partido.</p>';
    }

    const { leagueId } = firstPrediction;
    const league = await this.prisma.league.findUniqueOrThrow({
      where: { id: leagueId },
      select: { name: true, code: true },
    });

    const { members } = await this.getLeagueReportAudience(leagueId);

    const predictions = await this.prisma.prediction.findMany({
      where: { matchId, leagueId, points: { not: null } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { submittedAt: 'asc' },
    });

    const prevPreds = await this.prisma.prediction.findMany({
      where: { leagueId, points: { not: null }, matchId: { not: matchId } },
      select: { userId: true, points: true },
    });
    const prevTotals = new Map<string, number>();
    for (const p of prevPreds) prevTotals.set(p.userId, (prevTotals.get(p.userId) ?? 0) + (p.points ?? 0));

    const afterTotals = new Map<string, number>(prevTotals);
    for (const p of predictions) afterTotals.set(p.userId, (afterTotals.get(p.userId) ?? 0) + (p.points ?? 0));

    const sortedPrev  = [...prevTotals.entries()].sort((a, b) => b[1] - a[1]);
    const sortedAfter = [...afterTotals.entries()].sort((a, b) => b[1] - a[1]);
    const prevStandings  = new Map(sortedPrev.map(([uid, pts], i)  => [uid, { points: pts, position: i + 1 }]));
    const afterStandings = new Map(sortedAfter.map(([uid, pts], i) => [uid, { points: pts, position: i + 1 }]));

    const results = predictions.filter(this.hasCompletePredictionScores).map(p => {
      const member = members.find(m => m.userId === p.userId);
      return {
        userId:       p.userId,
        name:         this.resolvePredictorName(p.user, p.userId),
        isAdmin:      member?.role === 'ADMIN',
        homeScore:    p.homeScore,
        awayScore:    p.awayScore,
        submittedAt:  p.submittedAt,
        outcome:      this.parseOutcomeFromDetail(p.pointDetail, p.points),
        pointsEarned: p.points ?? 0,
        prevPosition: prevStandings.get(p.userId)?.position ?? 99,
        newPosition:  afterStandings.get(p.userId)?.position ?? 99,
      };
    });

    return this.emailService.buildResultHtml({
      leagueName: league.name,
      leagueCode: league.code,
      match: {
        homeTeam:  match.homeTeam.name,
        awayTeam:  match.awayTeam.name,
        matchDate: match.matchDate,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        venue:     match.venue ?? undefined,
        round:     match.round ?? undefined,
      },
      results,
      sentAt: new Date(),
    });
  }

  async getPreviewResultsHtmlForLeague(matchId: string, leagueId: string): Promise<string> {
    const match = await this.prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (match.homeScore === null || match.awayScore === null) {
      return '<p style="font-family:sans-serif;padding:2rem">Este partido no tiene resultado registrado.</p>';
    }

    const league = await this.prisma.league.findUniqueOrThrow({
      where: { id: leagueId },
      select: { name: true, code: true },
    });

    const { members } = await this.getLeagueReportAudience(leagueId);

    const predictions = await this.prisma.prediction.findMany({
      where: { matchId, leagueId, points: { not: null } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { submittedAt: 'asc' },
    });
    if (predictions.length === 0) {
      return '<p style="font-family:sans-serif;padding:2rem">No hay predicciones con puntos calculados para esta polla.</p>';
    }

    const prevPreds = await this.prisma.prediction.findMany({
      where: { leagueId, points: { not: null }, matchId: { not: matchId } },
      select: { userId: true, points: true },
    });
    const prevTotals = new Map<string, number>();
    for (const p of prevPreds) prevTotals.set(p.userId, (prevTotals.get(p.userId) ?? 0) + (p.points ?? 0));

    const afterTotals = new Map<string, number>(prevTotals);
    for (const p of predictions) afterTotals.set(p.userId, (afterTotals.get(p.userId) ?? 0) + (p.points ?? 0));

    const sortedPrev  = [...prevTotals.entries()].sort((a, b) => b[1] - a[1]);
    const sortedAfter = [...afterTotals.entries()].sort((a, b) => b[1] - a[1]);
    const prevStandings  = new Map(sortedPrev.map(([uid, pts], i)  => [uid, { points: pts, position: i + 1 }]));
    const afterStandings = new Map(sortedAfter.map(([uid, pts], i) => [uid, { points: pts, position: i + 1 }]));

    const results = predictions.filter(this.hasCompletePredictionScores).map(p => {
      const member = members.find(m => m.userId === p.userId);
      return {
        userId:       p.userId,
        name:         this.resolvePredictorName(p.user, p.userId),
        isAdmin:      member?.role === 'ADMIN',
        homeScore:    p.homeScore,
        awayScore:    p.awayScore,
        submittedAt:  p.submittedAt,
        outcome:      this.parseOutcomeFromDetail(p.pointDetail, p.points),
        pointsEarned: p.points ?? 0,
        prevPosition: prevStandings.get(p.userId)?.position ?? 99,
        newPosition:  afterStandings.get(p.userId)?.position ?? 99,
      };
    });

    return this.emailService.buildResultHtml({
      leagueName: league.name,
      leagueCode: league.code,
      match: {
        homeTeam:  match.homeTeam.name,
        awayTeam:  match.awayTeam.name,
        matchDate: match.matchDate,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        venue:     match.venue ?? undefined,
        round:     match.round ?? undefined,
      },
      results,
      sentAt: new Date(),
    });
  }

  async resendPredictionsReport(matchId: string): Promise<{ leagues: number; recipients: number }> {
    const leagueIds = await this.prisma.prediction.findMany({
      where: { matchId },
      select: { leagueId: true },
      distinct: ['leagueId'],
    });

    let recipients = 0;
    for (const { leagueId } of leagueIds) {
      const { recipients: leagueRecipients } = await this.getLeagueReportAudience(leagueId);
      if (!leagueRecipients.length) continue;
      await this.sendReportForMatch(matchId, leagueId);
      recipients += leagueRecipients.length;
    }

    return { leagues: leagueIds.length, recipients };
  }

  async resendResultsReport(matchId: string): Promise<{ leagues: number; recipients: number }> {
    const leagueIds = await this.prisma.prediction.findMany({
      where: { matchId },
      select: { leagueId: true },
      distinct: ['leagueId'],
    });

    const recipientCounts = await Promise.all(
      leagueIds.map(async ({ leagueId }) => {
        const { recipients } = await this.getLeagueReportAudience(leagueId);
        return recipients.length;
      }),
    );

    await this.sendMatchResultsReport(matchId);

    return {
      leagues: leagueIds.length,
      recipients: recipientCounts.reduce((sum, count) => sum + count, 0),
    };
  }

  private parseOutcomeFromDetail(pointDetail: string | null, points: number | null): ResultOutcome {
    if (pointDetail) {
      try {
        const detail = JSON.parse(pointDetail) as { type: string; uniqueBonus?: number };
        if (detail.type === 'EXACT_SCORE' && (detail.uniqueBonus ?? 0) > 0) return 'EXACT_UNIQUE';
        if (detail.type === 'EXACT_SCORE')         return 'EXACT';
        if (detail.type === 'CORRECT_WINNER_GOAL') return 'WINNER_GOAL';
        if (detail.type === 'CORRECT_WINNER')      return 'WINNER';
        if (detail.type === 'TEAM_GOALS')          return 'GOAL';
        // Legacy: CORRECT_DIFF was old name for winner+diff, treat as WINNER
        if (detail.type === 'CORRECT_DIFF')        return 'WINNER';
      } catch (_) { /* pointDetail malformado */ }
    }
    // Fallback for predictions without pointDetail
    return (points ?? 0) > 0 ? 'WINNER' : 'WRONG';
  }

  private resolvePredictorName(
    user: { name: string | null; email?: string | null },
    userId: string,
  ): string {
    return user.name ?? user.email ?? userId;
  }

  private async getStandings(leagueId: string): Promise<Map<string, { points: number; position: number }>> {
    const predictions = await this.prisma.prediction.findMany({
      where: { leagueId, points: { not: null } },
      select: { userId: true, points: true },
    });

    const totals = new Map<string, number>();
    for (const p of predictions) {
      totals.set(p.userId, (totals.get(p.userId) ?? 0) + (p.points ?? 0));
    }

    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const result = new Map<string, { points: number; position: number }>();
    sorted.forEach(([userId, points], idx) => {
      result.set(userId, { points, position: idx + 1 });
    });
    return result;
  }

  async getLeagueAudience(leagueId: string) {
    return this.getLeagueReportAudience(leagueId);
  }

  private async getLeagueReportAudience(
    leagueId: string,
    prefetchedLeague?: MatchAutomationSweepLeague,
  ) {
    if (prefetchedLeague) {
      return getReportAudienceFromLeague(prefetchedLeague);
    }

    const members = await this.prisma.leagueMember.findMany({
      where: {
        leagueId,
        status: { in: [...PredictionReportService.REPORTABLE_MEMBER_STATUSES] },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const recipients = [...new Set(
      members
        .map((member) => member.user.email)
        .filter(Boolean) as string[],
    )];

    return { members, recipients };
  }
}
