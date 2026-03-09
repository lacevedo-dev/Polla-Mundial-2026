import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardStats {
  aciertos: number;
  errores: number;
  racha: number;
  tasa: number;
}

export interface LeagueItem {
  id: string;
  nombre: string;
  posicion: number;
  tusPuntos: number;
  maxPuntos: number;
  participantes: number;
}

export interface PerformanceWeek {
  week: string;
  points: number;
}

export interface RecentPrediction {
  id: string;
  match: string;
  tuPrediccion: string;
  resultado: string;
  acierto: boolean;
  fecha: string;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard statistics for a user
   * - Total correct and incorrect predictions
   * - Current streak (from User model)
   * - Success percentage
   */
  async getStats(userId: string): Promise<DashboardStats> {
    // Get all predictions for this user
    const predictions = await this.prisma.prediction.findMany({
      where: { userId },
      include: {
        match: {
          select: {
            homeScore: true,
            awayScore: true,
          },
        },
      },
    });

    // Count correct and incorrect
    let aciertos = 0;
    let errores = 0;

    predictions.forEach((pred) => {
      if (pred.match.homeScore !== null && pred.match.awayScore !== null) {
        const isCorrect =
          pred.homeScore === pred.match.homeScore &&
          pred.awayScore === pred.match.awayScore;
        if (isCorrect) {
          aciertos++;
        } else {
          errores++;
        }
      }
    });

    const total = aciertos + errores;
    const tasa = total > 0 ? (aciertos / total) * 100 : 0;

    // Get user streak (assuming 0 if not set)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }, // User model might not have streak field in current schema
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      aciertos,
      errores,
      racha: 0, // Streak calculation would depend on User model extension
      tasa: Math.round(tasa * 100) / 100,
    };
  }

  /**
   * Get user's leagues with position and points
   */
  async getLeagues(userId: string): Promise<{ ligas: LeagueItem[] }> {
    // Get all leagues user is a member of
    const memberships = await this.prisma.leagueMember.findMany({
      where: { userId },
      include: {
        league: {
          select: {
            id: true,
            name: true,
            members: {
              select: { userId: true },
            },
          },
        },
      },
    });

    // For each league, get user's points and rankings
    const ligas: LeagueItem[] = [];

    for (const membership of memberships) {
      // Get user's correct predictions in this league
      const userPredictions = await this.prisma.prediction.findMany({
        where: {
          userId,
          leagueId: membership.league.id,
        },
        include: {
          match: {
            select: {
              homeScore: true,
              awayScore: true,
            },
          },
        },
      });

      let tusPuntos = 0;
      userPredictions.forEach((pred) => {
        if (pred.match.homeScore !== null && pred.match.awayScore !== null) {
          const isCorrect =
            pred.homeScore === pred.match.homeScore &&
            pred.awayScore === pred.match.awayScore;
          if (isCorrect) {
            tusPuntos++;
          }
        }
      });

      // Get max points in league (any user's correct predictions)
      const allLeaguePredictions = await this.prisma.prediction.findMany({
        where: { leagueId: membership.league.id },
        include: {
          match: {
            select: {
              homeScore: true,
              awayScore: true,
            },
          },
          user: {
            select: { id: true },
          },
        },
      });

      const userPointsMap = new Map<string, number>();
      allLeaguePredictions.forEach((pred) => {
        if (pred.match.homeScore !== null && pred.match.awayScore !== null) {
          const isCorrect =
            pred.homeScore === pred.match.homeScore &&
            pred.awayScore === pred.match.awayScore;
          if (isCorrect) {
            const currentPoints = userPointsMap.get(pred.userId) || 0;
            userPointsMap.set(pred.userId, currentPoints + 1);
          }
        }
      });

      // Get position
      let posicion = 1;
      for (const points of userPointsMap.values()) {
        if (points > tusPuntos) {
          posicion++;
        }
      }

      const maxPuntos = Math.max(...userPointsMap.values(), tusPuntos);

      ligas.push({
        id: membership.league.id,
        nombre: membership.league.name,
        posicion,
        tusPuntos,
        maxPuntos,
        participantes: membership.league.members.length,
      });
    }

    return { ligas };
  }

  /**
   * Get performance data for last 12 weeks
   */
  async getPerformance(userId: string): Promise<PerformanceWeek[]> {
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84); // 12 weeks * 7 days

    const predictions = await this.prisma.prediction.findMany({
      where: {
        userId,
        submittedAt: {
          gte: twelveWeeksAgo,
        },
      },
      include: {
        match: {
          select: {
            homeScore: true,
            awayScore: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    // Group by week
    const weekMap = new Map<string, number>();

    predictions.forEach((pred) => {
      if (pred.match.homeScore !== null && pred.match.awayScore !== null) {
        const isCorrect =
          pred.homeScore === pred.match.homeScore &&
          pred.awayScore === pred.match.awayScore;

        const date = new Date(pred.submittedAt);
        const year = date.getFullYear();
        const week = this.getWeekNumber(date);
        const weekKey = `${year}-W${week.toString().padStart(2, '0')}`;

        if (isCorrect) {
          const currentPoints = weekMap.get(weekKey) || 0;
          weekMap.set(weekKey, currentPoints + 1);
        }
      }
    });

    // Convert to array and sort
    const result: PerformanceWeek[] = Array.from(weekMap.entries())
      .map(([week, points]) => ({ week, points }))
      .sort((a, b) => b.week.localeCompare(a.week));

    return result;
  }

  /**
   * Get recent predictions (last 5)
   */
  async getRecentPredictions(userId: string): Promise<{ predicciones: RecentPrediction[] }> {
    const predictions = await this.prisma.prediction.findMany({
      where: { userId },
      include: {
        match: {
          include: {
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
      take: 5,
    });

    const predicciones: RecentPrediction[] = predictions.map((pred) => {
      const matchName = `${pred.match.homeTeam.name} vs ${pred.match.awayTeam.name}`;
      const tuPrediccion = `${pred.homeScore}-${pred.awayScore}`;
      const actualResult =
        pred.match.homeScore !== null && pred.match.awayScore !== null
          ? `${pred.match.homeScore}-${pred.match.awayScore}`
          : 'Pendiente';
      const acierto =
        pred.match.homeScore !== null &&
        pred.match.awayScore !== null &&
        pred.homeScore === pred.match.homeScore &&
        pred.awayScore === pred.match.awayScore;
      const fecha = new Date(pred.submittedAt).toLocaleDateString('es-ES');

      return {
        id: pred.id,
        match: matchName,
        tuPrediccion,
        resultado: actualResult,
        acierto,
        fecha,
      };
    });

    return { predicciones };
  }

  /**
   * Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((d.getTime() - yearStart.getTime()) / 86400000 / 7);
  }
}
