import { Controller, Post, Param, Req, UseGuards, NotFoundException, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '@corp-api/auth/guards/jwt-auth.guard';
import { TenantMemberGuard } from '@corp-api/corporate-tenant/guards/tenant-member.guard';
import { TenantStaffGuard } from '@corp-api/corporate-tenant/guards/tenant-staff.guard';
import { PrismaService } from '@corp-api/prisma/prisma.service';
import { EmailQueueService } from '@corp-api/email/email-queue.service';

@Controller('corp')
@UseGuards(JwtAuthGuard, TenantMemberGuard)
export class CorpMembersResendController {
    private readonly logger = new Logger(CorpMembersResendController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly emailQueue: EmailQueueService,
    ) {}

    @UseGuards(TenantStaffGuard)
    @HttpCode(HttpStatus.OK)
    @Post('members/:memberId/resend-credentials')
    async resendMemberCredentials(@Req() req: any, @Param('memberId') memberId: string) {
        const tenantId: string = req.tenantId;

        const member = await this.prisma.tenantMember.findFirst({
            where: { id: memberId, tenantId },
            include: { user: { select: { id: true, name: true, email: true, documentNumber: true } } },
        });
        if (!member) throw new NotFoundException('Miembro no encontrado');

        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id: tenantId },
            include: { branding: { select: { primaryColor: true, companyDisplayName: true } } },
        });
        if (!tenant) throw new NotFoundException('Tenant no encontrado');

        const { user } = member;

        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let tempPassword = '';
        for (let i = 0; i < 12; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

        const bcrypt = await import('bcrypt');
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        await this.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash, mustChangePassword: true },
        });

        const portalUrl = tenant.customDomain
            ? `https://${tenant.customDomain}`
            : `https://${tenant.slug}.zonapronosticos.com`;

        const tenantName = tenant.branding?.companyDisplayName ?? tenant.name;
        const primaryColor = tenant.branding?.primaryColor ?? '#f59e0b';
        const documentDisplay = user.documentNumber ?? user.email;
        const websiteDisplay = portalUrl.replace(/^https?:\/\//, '');
        const firstName = user.name.split(' ')[0];

        const html = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;padding:40px 20px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:20px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
    <div style="text-align:center;margin-bottom:28px;">
      <span style="font-size:28px;">🔑</span>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:800;color:#0f172a;">Acceso a ${tenantName}</h1>
      <p style="margin:8px 0 0;color:#64748b;font-size:14px;">Tus credenciales de acceso han sido renovadas</p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Tus credenciales</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:100px;">Usuario:</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${documentDisplay}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Contraseña:</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;font-family:'Courier New',monospace;">${tempPassword}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Portal:</td><td style="padding:6px 0;"><a href="${portalUrl}" style="color:${primaryColor};font-size:14px;font-weight:600;text-decoration:none;">${portalUrl}</a></td></tr>
      </table>
    </div>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${portalUrl}/login" style="display:inline-block;background:${primaryColor};color:#0f172a;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;">Ingresar al portal</a>
    </div>
    <div style="background:#fef3c7;border-left:3px solid #f59e0b;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0;color:#78350f;font-size:13px;"><strong>Por seguridad</strong>, deberás cambiar tu contraseña al iniciar sesión por primera vez.</p>
    </div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
    <p style="color:#94a3b8;font-size:11px;text-align:center;margin:0;">Si no esperabas este correo, ignóralo o contáctanos con <strong>${tenantName}</strong> en <a href="${portalUrl}" style="color:${primaryColor};">${websiteDisplay}</a>.</p>
  </div>
</body>
</html>`.trim();

        const text = `${tenantName}\n\nHola ${firstName}, tus credenciales de acceso han sido renovadas.\n\nUsuario: ${documentDisplay}\nContraseña: ${tempPassword}\nPortal: ${portalUrl}\n\nDeberás cambiar tu contraseña al iniciar sesión por primera vez.\n\nIngresa aquí: ${portalUrl}/login`;

        let emailSent = false;
        let emailQueued = false;
        let emailError: string | undefined;

        try {
            const jobId = await this.emailQueue.enqueueEmailGetId({
                type: 'VERIFICATION',
                priority: 'HIGH',
                required: true,
                recipientEmail: user.email,
                subject: `Tu acceso a la Polla de ${tenantName}`,
                html,
                text,
                dedupeKey: `tenant-resend:${tenantId}:${user.id}:${Date.now()}`,
            });

            if (jobId) {
                emailQueued = true;
                try {
                    const result = await this.emailQueue.dispatchJobById(jobId);
                    emailSent = result.sent;
                    if (!result.sent) {
                        this.logger.warn(`Reenvío encolado pero no despachado inmediatamente para ${user.email}`);
                    }
                } catch (dispatchErr: any) {
                    this.logger.warn(`Dispatch inmediato de reenvío falló para ${user.email}: ${dispatchErr?.message}`);
                }
            } else {
                emailError = 'El email estaba en lista negra o fue rechazado';
            }
        } catch (err: any) {
            emailError = err?.message;
            this.logger.error(`No se pudo encolar reenvío para ${user.email}: ${err?.message}`);
        }

        return {
            ok: true,
            userId: user.id,
            tempPassword,
            portalUrl,
            email: { queued: emailQueued, sent: emailSent, pendingDispatch: emailQueued && !emailSent, error: emailError },
        };
    }
}
