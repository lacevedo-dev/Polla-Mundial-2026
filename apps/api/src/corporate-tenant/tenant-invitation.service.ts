import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from '../email/email-queue.service';
import { TenantLimitsService } from './tenant-limits.service';

@Injectable()
export class TenantInvitationService {
    private readonly logger = new Logger(TenantInvitationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly emailQueue: EmailQueueService,
        private readonly limitsService: TenantLimitsService,
    ) {}

    private generateToken(): string {
        return randomBytes(24).toString('hex');
    }

    private buildInviteLink(tenantSlug: string, token: string): string {
        return `https://${tenantSlug}.zonapronosticos.com/join-org?token=${token}`;
    }

    private buildInviteEmail(tenantName: string, link: string, branding?: { primaryColor?: string | null; companyDisplayName?: string | null } | null): { html: string; text: string } {
        const displayName = branding?.companyDisplayName ?? tenantName;
        const color = branding?.primaryColor ?? '#16a34a';

        const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 20px; padding: 40px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="width: 56px; height: 56px; background: ${color}20; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
        <span style="font-size: 28px;">🏆</span>
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a;">${displayName}</h1>
      <p style="margin: 8px 0 0; color: #64748b; font-size: 14px;">te invita a la Polla del Mundial 2026</p>
    </div>
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
      ¡Hola! Has sido invitado a participar en la polla corporativa de <strong>${displayName}</strong>.
      Haz clic en el botón para aceptar y comenzar a competir.
    </p>
    <div style="text-align: center; margin-bottom: 28px;">
      <a href="${link}" style="display: inline-block; background: ${color}; color: white; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 12px; text-decoration: none;">
        Aceptar Invitación
      </a>
    </div>
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
      Si no puedes hacer clic en el botón, copia este enlace:<br/>
      <a href="${link}" style="color: ${color}; word-break: break-all;">${link}</a>
    </p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="color: #cbd5e1; font-size: 11px; text-align: center; margin: 0;">
      Esta invitación expira en 7 días. Si no reconoces este mensaje, ignóralo.
    </p>
  </div>
</body>
</html>`;

        const text = `${displayName} te invita a la Polla del Mundial 2026.\n\nAcepta tu invitación aquí: ${link}\n\nEsta invitación expira en 7 días.`;

        return { html, text };
    }

    async inviteSingle(tenantId: string, email: string, role: 'OWNER' | 'ADMIN' | 'PLAYER' = 'PLAYER') {
        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id: tenantId },
            include: { branding: { select: { primaryColor: true, companyDisplayName: true } } },
        });
        if (!tenant) throw new NotFoundException('Tenant no encontrado');

        const alreadyMember = await this.prisma.tenantMember.findFirst({
            where: { tenantId, user: { email } },
        });
        if (alreadyMember) throw new BadRequestException(`${email} ya es miembro de esta organización`);

        await this.limitsService.checkUserLimit(tenantId);

        const token = this.generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const invitation = await this.prisma.tenantInvitation.upsert({
            where: { tenantId_email: { tenantId, email } },
            create: { tenantId, email, role, token, expiresAt, sentAt: new Date() },
            update: { role, token, status: 'SENT', expiresAt, sentAt: new Date(), resendCount: { increment: 1 } },
        });

        const link = this.buildInviteLink(tenant.slug, token);
        const { html, text } = this.buildInviteEmail(tenant.name, link, tenant.branding);

        await this.emailQueue.enqueueEmail({
            type: 'VERIFICATION',
            priority: 'HIGH',
            required: false,
            recipientEmail: email,
            subject: `Invitación a ${tenant.branding?.companyDisplayName ?? tenant.name} — Polla Mundial 2026`,
            html,
            text,
            dedupeKey: `tenant-invite:${tenantId}:${email}:${invitation.id}`,
        });

        return { ok: true, invitationId: invitation.id };
    }

    async inviteBulk(tenantId: string, emails: string[], role: 'OWNER' | 'ADMIN' | 'PLAYER' = 'PLAYER', bulkBatchId?: string) {
        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id: tenantId },
            include: { branding: { select: { primaryColor: true, companyDisplayName: true } } },
        });
        if (!tenant) throw new NotFoundException('Tenant no encontrado');

        const uniqueEmails = [...new Set(emails.map(e => e.toLowerCase().trim()))].filter(Boolean);
        if (uniqueEmails.length === 0) throw new BadRequestException('No hay emails válidos en la lista');
        if (uniqueEmails.length > 500) throw new BadRequestException('Máximo 500 emails por lote');

        const existingMembers = await this.prisma.tenantMember.findMany({
            where: { tenantId, user: { email: { in: uniqueEmails } } },
            include: { user: { select: { email: true } } },
        });
        const existingEmails = new Set(existingMembers.map(m => m.user.email.toLowerCase()));

        const batchId = bulkBatchId ?? `batch-${Date.now()}`;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const results = { total: uniqueEmails.length, queued: 0, skipped: 0, failed: 0 };

        for (const email of uniqueEmails) {
            if (existingEmails.has(email)) {
                results.skipped++;
                continue;
            }

            try {
                const token = this.generateToken();
                const inviteLink = this.buildInviteLink(tenant.slug, token);

                await this.prisma.tenantInvitation.upsert({
                    where: { tenantId_email: { tenantId, email } },
                    create: { tenantId, email, role, token, expiresAt, bulkBatchId: batchId, sentAt: now },
                    update: { role, token, status: 'SENT', expiresAt, bulkBatchId: batchId, sentAt: now, resendCount: { increment: 1 } },
                });

                const { html, text } = this.buildInviteEmail(tenant.name, inviteLink, tenant.branding);

                await this.emailQueue.enqueueEmail({
                    type: 'VERIFICATION',
                    priority: 'MEDIUM',
                    required: false,
                    recipientEmail: email,
                    subject: `Invitación a ${tenant.branding?.companyDisplayName ?? tenant.name} — Polla Mundial 2026`,
                    html,
                    text,
                    dedupeKey: `tenant-bulk-invite:${tenantId}:${email}:${batchId}`,
                });

                results.queued++;
            } catch (err: any) {
                this.logger.warn(`[BulkInvite] Error al invitar ${email}: ${err?.message}`);
                results.failed++;
            }
        }

        return { ...results, batchId };
    }

    async listInvitations(tenantId: string) {
        return this.prisma.tenantInvitation.findMany({
            where: { tenantId },
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        });
    }

    async resendInvitation(tenantId: string, invitationId: string) {
        const invitation = await this.prisma.tenantInvitation.findFirst({
            where: { id: invitationId, tenantId },
        });
        if (!invitation) throw new NotFoundException('Invitación no encontrada');

        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id: tenantId },
            include: { branding: { select: { primaryColor: true, companyDisplayName: true } } },
        });
        if (!tenant) throw new NotFoundException('Tenant no encontrado');

        const newToken = this.generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await this.prisma.tenantInvitation.update({
            where: { id: invitationId },
            data: { token: newToken, status: 'SENT', expiresAt, sentAt: new Date(), resendCount: { increment: 1 } },
        });

        const link = this.buildInviteLink(tenant.slug, newToken);
        const { html, text } = this.buildInviteEmail(tenant.name, link, tenant.branding);

        await this.emailQueue.enqueueEmail({
            type: 'VERIFICATION',
            priority: 'HIGH',
            required: false,
            recipientEmail: invitation.email,
            subject: `(Reenvío) Invitación a ${tenant.branding?.companyDisplayName ?? tenant.name}`,
            html,
            text,
            dedupeKey: `tenant-invite-resend:${invitationId}:${Date.now()}`,
        });

        return { ok: true };
    }

    async acceptByToken(token: string, userId: string) {
        const invitation = await this.prisma.tenantInvitation.findUnique({
            where: { token },
            include: { tenant: { select: { id: true, slug: true, name: true, maxUsers: true } } },
        });

        if (!invitation) throw new NotFoundException('Invitación no válida');
        if (invitation.status === 'ACCEPTED') throw new BadRequestException('Esta invitación ya fue aceptada');
        if (invitation.expiresAt && invitation.expiresAt < new Date()) {
            throw new BadRequestException('Esta invitación ha expirado');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        if (!user) throw new NotFoundException('Usuario no encontrado');
        if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
            throw new BadRequestException('Esta invitación no es para tu cuenta');
        }

        await this.limitsService.checkUserLimit(invitation.tenantId);

        await this.prisma.$transaction([
            this.prisma.tenantInvitation.update({
                where: { token },
                data: { status: 'ACCEPTED' },
            }),
            this.prisma.tenantMember.upsert({
                where: { tenantId_userId: { tenantId: invitation.tenantId, userId } },
                create: {
                    tenantId: invitation.tenantId,
                    userId,
                    role: invitation.role,
                    status: 'ACTIVE',
                    joinedAt: new Date(),
                },
                update: { status: 'ACTIVE', role: invitation.role, joinedAt: new Date() },
            }),
        ]);

        return { ok: true, tenantSlug: invitation.tenant.slug, tenantName: invitation.tenant.name };
    }
}
