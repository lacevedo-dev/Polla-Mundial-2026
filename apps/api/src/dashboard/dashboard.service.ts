import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { USER_STATUS } from '../users/user-status.constants';

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
  puntos: number;
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

    // Count predictions with points vs predictions without points once a match is resolved
    let aciertos = 0;
    let errores = 0;

    predictions.forEach((pred) => {
      if (pred.match.homeScore !== null && pred.match.awayScore !== null) {
        if ((pred.points ?? 0) > 0) {
          aciertos++;
        } else {
          errores++;
        }
      }
    });

    const total = aciertos + errores;
    const tasa = total > 0 ? (aciertos / total) * 100 : 0;

    // Get user streak (assuming 0 if not set)
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: USER_STATUS.ACTIVE },
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
    // 1 query: todas las membresias del usuario con nombre/participantes
    const memberships = await this.prisma.leagueMember.findMany({
      where: { userId },
      select: {
        league: {
          select: {
            id: true,
            name: true,
            _count: { select: { members: true } },
          },
        },
      },
    });

    if (memberships.length === 0) return { ligas: [] };

    const leagueIds = memberships.map((m) => m.league.id);

    // 1 query: puntos reales por usuario+liga (groupBy)
    const pointsRows = await this.prisma.prediction.groupBy({
      by: ['userId', 'leagueId'],
      where: { leagueId: { in: leagueIds }, points: { not: null } },
      _sum: { points: true },
    });

    // Indexado: leagueId -> userId -> totalPoints
    const leaguePointsMap = new Map<string, Map<string, number>>();
    for (const row of pointsRows) {
      if (!leaguePointsMap.has(row.leagueId)) {
        leaguePointsMap.set(row.leagueId, new Map());
      }
      leaguePointsMap.get(row.leagueId)!.set(row.userId, row._sum.points ?? 0);
    }

    const ligas: LeagueItem[] = memberships.map(({ league }) => {
      const usersInLeague = leaguePointsMap.get(league.id) ?? new Map<string, number>();
      const tusPuntos = usersInLeague.get(userId) ?? 0;
      const maxPuntos = Math.max(0, ...usersInLeague.values());

      let posicion = 1;
      for (const pts of usersInLeague.values()) {
        if (pts > tusPuntos) posicion++;
      }

      return {
        id: league.id,
        nombre: league.name,
        posicion,
        tusPuntos,
        maxPuntos,
        participantes: league._count.members,
      };
    });

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
  async getRecentPredictions(userId: string, leagueId?: string): Promise<{ predicciones: RecentPrediction[] }> {
    const predictions = await this.prisma.prediction.findMany({
      where: {
        userId,
        ...(leagueId ? { leagueId } : {}),
      },
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

    const latestPredictions = new Map<string, (typeof predictions)[number]>();
    for (const prediction of predictions) {
      const key = leagueId ? prediction.matchId : `${prediction.leagueId}:${prediction.matchId}`;
      if (!latestPredictions.has(key)) {
        latestPredictions.set(key, prediction);
      }
    }

    const predicciones: RecentPrediction[] = [...latestPredictions.values()].slice(0, 5).map((pred) => {
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
      const puntos = pred.points ?? 0;
      const fecha = new Date(pred.submittedAt).toLocaleDateString('es-ES');

      return {
        id: pred.id,
        match: matchName,
        tuPrediccion,
        resultado: actualResult,
        acierto,
        puntos,
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
