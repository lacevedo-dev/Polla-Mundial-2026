import { Controller, Get, Post, Param, Body, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PredictionReportService } from './prediction-report.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/prediction-report')
export class PredictionReportController {
  constructor(private readonly reportService: PredictionReportService) {}

  /**
   * Previsualiza el HTML del correo en el browser.
   * GET /admin/prediction-report/preview/:matchId/:leagueId
   */
  @Get('preview/:matchId/:leagueId')
  async preview(
    @Param('matchId') matchId: string,
    @Param('leagueId') leagueId: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.reportService.getPreviewHtml(matchId, leagueId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /**
   * EnvÃ­a el reporte a un email de prueba (sin marcar el match como enviado).
   * POST /admin/prediction-report/send-test
   * Body: { matchId, leagueId, email }
   */
  @Post('send-test')
  async sendTest(
    @Body() body: { matchId: string; leagueId: string; email: string },
  ): Promise<{ message: string }> {
    await this.reportService.sendReportForMatch(body.matchId, body.leagueId, body.email);
    return { message: `Reporte de prueba enviado a ${body.email}` };
  }

  /**
   * Fuerza el envÃ­o del reporte a todos los miembros activos de la liga
   * (marca el match como enviado).
   * POST /admin/prediction-report/send-now
   * Body: { matchId, leagueId }
   */
  @Post('send-now')
  async sendNow(
    @Body() body: { matchId: string; leagueId: string },
  ): Promise<{ message: string }> {
    await this.reportService.sendReportForMatch(body.matchId, body.leagueId);
    return { message: 'Reporte enviado a todos los miembros activos de la liga' };
  }

  /**
   * Dispara manualmente el scheduler (Ãºtil para testing).
   * POST /admin/prediction-report/trigger
   */
  @Post('trigger')
  async trigger(): Promise<{ message: string }> {
    await this.reportService.sendPendingReports();
    return { message: 'RevisiÃ³n de reportes pendientes completada' };
  }

  @Get('preview-start/:matchId')
  async previewStart(
    @Param('matchId') matchId: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.reportService.getPreviewStartHtml(matchId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('preview-results/:matchId')
  async previewResults(
    @Param('matchId') matchId: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.reportService.getPreviewResultsHtml(matchId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Post('resend-start/:matchId')
  async resendStart(
    @Param('matchId') matchId: string,
  ): Promise<{ message: string; leagues: number; recipients: number }> {
    const result = await this.reportService.resendPredictionsReport(matchId);
    return { message: 'Correo de arranque reenviado', ...result };
  }

  @Post('resend-results/:matchId')
  async resendResults(
    @Param('matchId') matchId: string,
  ): Promise<{ message: string; leagues: number; recipients: number }> {
    const result = await this.reportService.resendResultsReport(matchId);
    return { message: 'Correo de cierre reenviado', ...result };
  }
}
