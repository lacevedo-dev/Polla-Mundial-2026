import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WhatsappGroupJobType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WhatsappWebService } from '../whatsapp/whatsapp-web.service';
import { WhatsappGroupService } from '../whatsapp/whatsapp-group.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class AdminWhatsappController {
  constructor(
    private readonly waWeb: WhatsappWebService,
    private readonly waGroup: WhatsappGroupService,
    private readonly prisma: PrismaService,
  ) {}

  /** Estado de la sesión WhatsApp Web */
  @Get('status')
  getStatus() {
    return { status: this.waWeb.getStatus() };
  }

  /** Fuerza reinicialización del cliente (útil tras desconexión manual) */
  @Post('reinitialize')
  async reinitialize() {
    await this.waWeb.reinitialize();
    return { ok: true, status: this.waWeb.getStatus() };
  }

  /** QR como data URL para escanear con el teléfono */
  @Get('qr')
  getQr() {
    const qr = this.waWeb.getQrDataUrl();
    if (!qr) throw new NotFoundException('QR not available — session may already be connected or not initialized');
    return { qrDataUrl: qr };
  }

  /** Desconectar sesión */
  @Post('disconnect')
  async disconnect() {
    await this.waWeb.disconnect();
    return { ok: true };
  }

  /** Lista grupos del WhatsApp conectado (para el picker de ligas) */
  @Get('groups')
  async listGroups() {
    try {
      const groups = await this.waWeb.listGroups();
      return { groups };
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  /** Jobs recientes */
  @Get('jobs')
  async recentJobs() {
    const jobs = await this.waGroup.getRecentJobs(50);
    return { jobs };
  }

  /** Reintentar un job fallido */
  @Post('jobs/:jobId/retry')
  async retryJob(@Param('jobId') jobId: string) {
    await this.waGroup.resetFailedJob(jobId);
    return { ok: true };
  }

  /**
   * Publicar manualmente el reporte de un partido en el grupo de una liga.
   * type: "results" | "predictions"
   */
  @Post('publish/:matchId/:leagueId/:type')
  async publishManual(
    @Param('matchId') matchId: string,
    @Param('leagueId') leagueId: string,
    @Param('type') type: string,
  ) {
    const jobType =
      type === 'results'
        ? WhatsappGroupJobType.RESULT_REPORT
        : type === 'predictions'
          ? WhatsappGroupJobType.PREDICTION_REPORT
          : null;

    if (!jobType) {
      throw new BadRequestException('type must be "results" or "predictions"');
    }

    await this.waGroup.enqueueManual(jobType, matchId, leagueId);
    return { ok: true, message: 'Job enqueued — will be published in next dispatcher tick' };
  }

  /** Asignar / quitar grupo de WhatsApp a una liga */
  @Post('league/:leagueId/group')
  async setLeagueGroup(
    @Param('leagueId') leagueId: string,
    @Body() body: { groupId: string | null },
  ) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('League not found');

    await this.prisma.league.update({
      where: { id: leagueId },
      data: { whatsappGroupId: body.groupId ?? null },
    });

    return { ok: true, leagueId, groupId: body.groupId ?? null };
  }

  /** Leer el groupId actual de una liga */
  @Get('league/:leagueId/group')
  async getLeagueGroup(@Param('leagueId') leagueId: string) {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, name: true, code: true, whatsappGroupId: true },
    });
    if (!league) throw new NotFoundException('League not found');
    return league;
  }

  /** Eliminar (descartar) un job específico */
  @Delete('jobs/:jobId')
  async deleteJob(@Param('jobId') jobId: string) {
    await this.prisma.whatsappGroupJob.delete({ where: { id: jobId } });
    return { ok: true };
  }
}
