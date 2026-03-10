import { Controller, Get, UseGuards, Request, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { DashboardStatsDto } from './dto/dashboard-stats.dto';
import type { DashboardLeaguesResponseDto } from './dto/dashboard-leagues.dto';
import type { PerformanceWeekDto } from './dto/dashboard-performance.dto';
import type { RecentPredictionsResponseDto } from './dto/dashboard-predictions.dto';

/**
 * Dashboard Controller
 *
 * Provides endpoints for the user dashboard including statistics,
 * league standings, performance history, and recent predictions.
 *
 * All endpoints require JWT authentication via the Authorization header.
 */
@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/stats
   *
   * Returns the authenticated user's prediction statistics including
   * correct/incorrect counts, current streak, and success rate percentage.
   *
   * @returns {DashboardStatsDto} User statistics object
   * @throws {401} Unauthorized - Missing or invalid JWT token
   * @throws {500} Internal Server Error - Failed to compute stats
   *
   * @example Response 200
   * {
   *   "aciertos": 45,
   *   "errores": 10,
   *   "racha": 3,
   *   "tasa": 81.82
   * }
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get user dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Stats retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getStats(@Request() req): Promise<DashboardStatsDto> {
    try {
      const userId = req.user.userId;
      return await this.dashboardService.getStats(userId);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch dashboard stats');
    }
  }

  /**
   * GET /dashboard/leagues
   *
   * Returns all leagues the authenticated user participates in,
   * including their position, points, and league metadata.
   * Position is calculated by comparing the user's correct predictions
   * against all other participants in each league.
   *
   * @returns {DashboardLeaguesResponseDto} Object containing array of league items
   * @throws {401} Unauthorized - Missing or invalid JWT token
   * @throws {500} Internal Server Error - Failed to fetch leagues
   *
   * @example Response 200
   * {
   *   "ligas": [
   *     {
   *       "id": "clxyz...",
   *       "nombre": "Liga Premium",
   *       "posicion": 1,
   *       "tusPuntos": 45,
   *       "maxPuntos": 50,
   *       "participantes": 25
   *     }
   *   ]
   * }
   */
  @Get('leagues')
  @ApiOperation({ summary: 'Get leagues the user participates in' })
  @ApiResponse({ status: 200, description: 'Leagues retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getLeagues(@Request() req): Promise<DashboardLeaguesResponseDto> {
    try {
      const userId = req.user.userId;
      return await this.dashboardService.getLeagues(userId);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch leagues');
    }
  }

  /**
   * GET /dashboard/performance
   *
   * Returns the authenticated user's performance data for the last 12 weeks.
   * Each entry contains an ISO week identifier and the number of correct
   * predictions made during that week. Results are sorted by week descending.
   *
   * @returns {PerformanceWeekDto[]} Array of weekly performance entries
   * @throws {401} Unauthorized - Missing or invalid JWT token
   * @throws {500} Internal Server Error - Failed to fetch performance data
   *
   * @example Response 200
   * [
   *   { "week": "2026-W10", "points": 5 },
   *   { "week": "2026-W09", "points": 3 }
   * ]
   */
  @Get('performance')
  @ApiOperation({ summary: 'Get user weekly performance for last 12 weeks' })
  @ApiResponse({ status: 200, description: 'Performance data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPerformance(@Request() req): Promise<PerformanceWeekDto[]> {
    try {
      const userId = req.user.userId;
      return await this.dashboardService.getPerformance(userId);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch performance data');
    }
  }

  /**
   * GET /dashboard/predictions/recent
   *
   * Returns the authenticated user's 5 most recent predictions,
   * ordered by submission date descending. Each prediction includes
   * match details, the user's predicted score, actual result, and
   * whether the prediction was correct.
   *
   * @returns {RecentPredictionsResponseDto} Object containing array of recent predictions
   * @throws {401} Unauthorized - Missing or invalid JWT token
   * @throws {500} Internal Server Error - Failed to fetch predictions
   *
   * @example Response 200
   * {
   *   "predicciones": [
   *     {
   *       "id": "clxyz...",
   *       "match": "Colombia vs Brazil",
   *       "tuPrediccion": "2-1",
   *       "resultado": "2-1",
   *       "acierto": true,
   *       "fecha": "15/3/2026"
   *     }
   *   ]
   * }
   */
  @Get('predictions/recent')
  @ApiOperation({ summary: 'Get the 5 most recent predictions for the user' })
  @ApiResponse({ status: 200, description: 'Recent predictions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getRecentPredictions(@Request() req): Promise<RecentPredictionsResponseDto> {
    try {
      const userId = req.user.userId;
      return await this.dashboardService.getRecentPredictions(userId);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch recent predictions');
    }
  }
}
