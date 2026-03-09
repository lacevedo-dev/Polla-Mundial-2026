import { Controller, Get, UseGuards, Request, InternalServerErrorException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard/stats
   * Get user statistics: correct/incorrect predictions, streak, success rate
   */
  @Get('stats')
  async getStats(@Request() req) {
    try {
      const userId = req.user.userId;
      return await this.dashboardService.getStats(userId);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch dashboard stats');
    }
  }

  /**
   * GET /dashboard/leagues
   * Get user's leagues with position and points
   */
  @Get('leagues')
  async getLeagues(@Request() req) {
    try {
      const userId = req.user.userId;
      return await this.dashboardService.getLeagues(userId);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch leagues');
    }
  }

  /**
   * GET /dashboard/performance
   * Get performance data for last 12 weeks
   */
  @Get('performance')
  async getPerformance(@Request() req) {
    try {
      const userId = req.user.userId;
      return await this.dashboardService.getPerformance(userId);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch performance data');
    }
  }

  /**
   * GET /dashboard/predictions/recent
   * Get user's last 5 predictions
   */
  @Get('predictions/recent')
  async getRecentPredictions(@Request() req) {
    try {
      const userId = req.user.userId;
      return await this.dashboardService.getRecentPredictions(userId);
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch recent predictions');
    }
  }
}
