import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailJobPriority, EmailJobType } from '@prisma/client';
import {
    CorpRankingExportPayload,
    CorpRankingService,
} from '@corp-api/corporate-tenant/corp-ranking.service';
import { PrismaService } from '@corp-api/prisma/prisma.service';
import { EmailQueueService } from '@corp-api/email/email-queue.service';
import { CorpRankingPdfService } from './corp-ranking-pdf.service';

@Injectable()
export class CorpRankingReportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly corpRanking: CorpRankingService,
        private readonly pdfService: CorpRankingPdfService,
        private readonly emailQueue: EmailQueueService,
    ) {}

    async getExport(tenantId: string, category?: string): Promise<CorpRankingExportPayload> {
        return this.corpRanking.getRankingExport(tenantId, category);
    }

    async getPdfBuffer(tenantId: string, category?: string): Promise<{
        buffer: Buffer;
        filename: string;
        exportPayload: CorpRankingExportPayload;
        orgName: string;
    }> {
        const [exportPayload, orgName] = await Promise.all([
            this.corpRanking.getRankingExport(tenantId, category),
            this.resolveOrgName(tenantId),
        ]);

        if (!exportPayload.league) {
            throw new NotFoundException('No hay polla activa para este tenant');
        }

        const buffer = await this.pdfService.buildRankingPdf({ orgName, exportPayload });
        const slug = this.slugify(exportPayload.league.name);
        const filename = `ranking_${slug}_${this.dateStamp(exportPayload.generatedAt)}.pdf`;

        return { buffer, filename, exportPayload, orgName };
    }

    async sendPdfByEmail(tenantId: string, email: string, category?: string): Promise<{ message: string }> {
        const recipient = email?.trim().toLowerCase();
        if (!recipient) {
            throw new BadRequestException('Debes indicar un correo destino');
        }

        const { buffer, filename, exportPayload, orgName } = await this.getPdfBuffer(tenantId, category);
        const leagueName = exportPayload.league!.name;
        const subject = `Listado de participantes por puntaje — ${leagueName}`;
        const html = this.buildEmailHtml(orgName, leagueName, exportPayload.totalParticipants, filename);
        const text = [
            `Listado de participantes por puntaje`,
            ``,
            `Organización: ${orgName}`,
            `Polla: ${leagueName}`,
            `Participantes: ${exportPayload.totalParticipants}`,
            ``,
            `Adjuntamos el PDF ${filename}.`,
        ].join('\n');

        const queued = await this.emailQueue.enqueueEmail({
            type: EmailJobType.PREDICTIONS_REPORT,
            priority: EmailJobPriority.HIGH,
            required: true,
            recipientEmail: recipient,
            subject,
            html,
            text,
            dedupeKey: `ranking-report:${tenantId}:${recipient}:${Date.now()}`,
            leagueId: exportPayload.league!.id,
            attachments: [
                {
                    filename,
                    contentBase64: buffer.toString('base64'),
                    contentType: 'application/pdf',
                },
            ],
        });

        if (!queued) {
            throw new BadRequestException(
                'No se pudo encolar el correo (destinatario en lista negra o rechazo de cola).',
            );
        }

        return { message: `Listado encolado para envío a ${recipient}` };
    }

    private async resolveOrgName(tenantId: string): Promise<string> {
        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id: tenantId },
            select: {
                name: true,
                branding: { select: { companyDisplayName: true } },
            },
        });
        return tenant?.branding?.companyDisplayName?.trim()
            || tenant?.name?.trim()
            || 'Portal Corporativo';
    }

    private buildEmailHtml(
        orgName: string,
        leagueName: string,
        totalParticipants: number,
        filename: string,
    ): string {
        return `
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e2e8f0;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;">${orgName}</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">Listado de participantes por puntaje</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.5;">
      Adjuntamos el ranking completo de <strong>${leagueName}</strong>
      (${totalParticipants} participante${totalParticipants === 1 ? '' : 's'}), ordenado por puntaje.
    </p>
    <div style="background:#f8fafc;border-radius:12px;padding:14px 16px;margin:0 0 8px;">
      <p style="margin:0;font-size:13px;color:#64748b;">Archivo adjunto</p>
      <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#0f172a;">${filename}</p>
    </div>
  </div>
</body>
</html>`.trim();
    }

    private slugify(value: string): string {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 40) || 'polla';
    }

    private dateStamp(iso: string): string {
        const d = new Date(iso);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${day}`;
    }
}
