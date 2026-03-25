import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionReportEmailService } from './prediction-report-email.service';

@Injectable()
export class PredictionReportService {
  private readonly logger = new Logger(PredictionReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: PredictionReportEmailService,
  ) {}

  /**
   * Busca matches cuya ventana de predicciones acaba de cerrarse (por liga)
   * y envía el reporte a todos los miembros activos de cada liga.
   */
  async sendPendingReports(): Promise<void> {
    const now = new Date();

    // Obtener todos los leagues con sus closePredictionMinutes
    const leagues = await this.prisma.league.findMany({
      select: { id: true, name: true, code: true, closePredictionMinutes: true },
    });

    for (const league of leagues) {
      const closingThreshold = new Date(now.getTime() - league.closePredictionMinutes * 60_000);

      // Matches de esta liga cuya ventana cerró y el reporte aún no se envió
      const matches = await this.prisma.match.findMany({
        where: {
          predictionReportSentAt: null,
          matchDate: {
            gt:  closingThreshold,         // el partido no ocurrió hace demasiado tiempo
            lte: new Date(now.getTime() + league.closePredictionMinutes * 60_000), // ya cerró la ventana
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
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { submittedAt: 'asc' },
          },
        },
      });

      for (const match of matches) {
        if (match.predictions.length === 0) continue;

        // Miembros activos de la liga con email
        const members = await this.prisma.leagueMember.findMany({
          where: { leagueId: league.id, status: 'ACTIVE' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        });

        const recipients = members
          .map(m => m.user.email)
          .filter(Boolean) as string[];

        if (recipients.length === 0) continue;

        // Preparar datos del reporte
        const predictors = match.predictions.map(p => {
          const member = members.find(m => m.userId === p.userId);
          return {
            userId:    p.userId,
            name:      p.user.name,
            isAdmin:   member?.role === 'ADMIN',
            homeScore: p.homeScore,
            awayScore: p.awayScore,
            submittedAt: p.submittedAt,
          };
        });

        // Ranking actual en la liga
        const standings = await this.getStandings(league.id);

        this.logger.log(
          `Enviando reporte de predicciones: ${match.homeTeam.name} vs ${match.awayTeam.name} ` +
          `| Liga: ${league.code} | ${recipients.length} destinatarios`,
        );

        await this.emailService.sendPredictionsReport({
          recipients,
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
          sentAt: now,
        });

        // Marcar como enviado
        await this.prisma.match.update({
          where: { id: match.id },
          data: { predictionReportSentAt: now },
        });

        this.logger.log(`Reporte enviado para match ${match.id}`);
      }
    }
  }

  /**
   * Genera el reporte para un match/liga específico (para preview o envío manual).
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

    const members = await this.prisma.leagueMember.findMany({
      where: { leagueId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const predictors = match.predictions.map(p => {
      const member = members.find(m => m.userId === p.userId);
      return {
        userId:    p.userId,
        name:      p.user.name,
        isAdmin:   member?.role === 'ADMIN',
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        submittedAt: p.submittedAt,
      };
    });

    const standings = await this.getStandings(leagueId);

    const recipients = testEmail
      ? [testEmail]
      : (members.map(m => m.user.email).filter(Boolean) as string[]);

    await this.emailService.sendPredictionsReport({
      recipients,
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

    const members = await this.prisma.leagueMember.findMany({
      where: { leagueId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const predictors = match.predictions.map(p => {
      const member = members.find(m => m.userId === p.userId);
      return {
        userId:    p.userId,
        name:      p.user.name,
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
}
