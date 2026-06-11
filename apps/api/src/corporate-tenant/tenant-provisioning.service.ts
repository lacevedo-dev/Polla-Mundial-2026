import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { TenantRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from '../email/email-queue.service';
import { TenantLimitsService } from './tenant-limits.service';
import { ProvisionTenantOwnerDto, ResendCredentialsDto } from './dto/tenant.dto';

@Injectable()
export class TenantProvisioningService {
    protected readonly logger = new Logger(TenantProvisioningService.name);

    constructor(
        protected readonly prisma: PrismaService,
        protected readonly emailQueue: EmailQueueService,
        protected readonly limitsService: TenantLimitsService,
    ) {}

    /**
     * Crea (o reutiliza) un usuario y lo asigna como OWNER/ADMIN del tenant.
     * Si el usuario es nuevo: setea passwordHash con la contraseña temporal y mustChangePassword=true.
     * Si ya existe: solo crea/actualiza el TenantMember y NO toca la contraseña.
     */
    async provisionOwner(tenantId: string, dto: ProvisionTenantOwnerDto) {
        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id: tenantId },
            include: { branding: { select: { primaryColor: true, companyDisplayName: true } } },
        });
        if (!tenant) throw new NotFoundException('Tenant no encontrado');

        const email = dto.email.toLowerCase().trim();
        const documentNumber = this.normalizeDocumentNumber(dto.documentNumber ?? dto.username);
        const role = (dto.role ?? 'OWNER') as TenantRole;
        const sendEmail = dto.sendEmail !== false;

        // Buscar usuario existente — documento es la clave única en contexto corporativo
        let existingUser: { id: string; name: string; email: string; documentNumber: string | null } | null = null;

        if (documentNumber) {
            existingUser = await this.prisma.user.findFirst({
                where: { documentNumber },
                select: { id: true, name: true, email: true, documentNumber: true },
            });
        }

        if (existingUser && existingUser.email !== email) {
            throw new BadRequestException('El número de documento ya está registrado con otro correo electrónico');
        }

        let userId: string;
        let isNewUser = false;
        let tempPassword: string | undefined;

        if (existingUser) {
            userId = existingUser.id;
            await this.limitsService.checkUserLimit(tenantId);
        } else {
            // Validar límite ANTES de crear el user
            await this.limitsService.checkUserLimit(tenantId);

            tempPassword = dto.tempPassword?.trim() || this.generateTempPassword();
            const passwordHash = await bcrypt.hash(tempPassword, 10);
            const username = await this.resolveUniqueUsername(dto.username || documentNumber || email.split('@')[0]);

            const created = await this.prisma.user.create({
                data: {
                    name: dto.name.trim(),
                    email,
                    username,
                    documentNumber,
                    phone: dto.phone,
                    passwordHash,
                    mustChangePassword: true,
                    emailVerified: true, // provisión por superadmin: email ya validado externamente
                    systemRole: 'USER',
                },
                select: { id: true },
            });
            userId = created.id;
            isNewUser = true;
        }

        // Crear o actualizar membership
        const member = await this.prisma.tenantMember.upsert({
            where: { tenantId_userId: { tenantId, userId } },
            create: {
                tenantId,
                userId,
                role,
                status: 'ACTIVE',
                joinedAt: new Date(),
            },
            update: {
                role,
                status: 'ACTIVE',
                joinedAt: new Date(),
            },
        });

        // Auto-enrolar en todas las pollas ACTIVE del tenant
        const activeLeagues = await this.prisma.league.findMany({
            where: { tenantId, status: 'ACTIVE' },
            select: { id: true },
        });
        if (activeLeagues.length > 0) {
            await Promise.all(
                activeLeagues.map((league) =>
                    this.prisma.leagueMember.upsert({
                        where: { userId_leagueId: { userId, leagueId: league.id } },
                        create: { leagueId: league.id, userId, role: 'PLAYER', status: 'ACTIVE', joinedAt: new Date() },
                        update: { status: 'ACTIVE' },
                    }),
                ),
            );
        }

        // Marcar invitación previa como ACEPTADA si existe
        await this.prisma.tenantInvitation.updateMany({
            where: { tenantId, email, status: { in: ['SENT'] } },
            data: { status: 'ACCEPTED' },
        });

        const portalUrl = this.resolvePortalUrl(tenant);
        let emailSent = false;
        let emailQueued = false;
        let emailError: string | undefined;

        // Enviar email con credenciales (solo si es usuario nuevo y sendEmail=true)
        if (sendEmail && isNewUser && tempPassword) {
            const contactUrl = tenant.customDomain ? `https://${tenant.customDomain}` : portalUrl;
            const { html, text } = this.buildCredentialsEmail({
                userName: dto.name.split(' ')[0],
                tenantName: tenant.branding?.companyDisplayName ?? tenant.name,
                portalUrl,
                documentNumber: documentNumber ?? email,
                tempPassword,
                primaryColor: tenant.branding?.primaryColor ?? '#f59e0b',
                contactUrl,
            });

            try {
                const jobId = await this.emailQueue.enqueueEmailGetId({
                    type: 'VERIFICATION',
                    priority: 'HIGH',
                    required: true,
                    recipientEmail: email,
                    subject: `Tu acceso de la Polla de ${tenant.branding?.companyDisplayName ?? tenant.name}`,
                    html,
                    text,
                    dedupeKey: `tenant-provision:${tenantId}:${userId}:${Date.now()}`,
                });

                if (jobId) {
                    emailQueued = true;
                    // Despachar inmediatamente sin esperar al scheduler
                    try {
                        const result = await this.emailQueue.dispatchJobById(jobId);
                        emailSent = result.sent;
                        if (!result.sent) {
                            this.logger.warn(`Email de provisión encolado pero no despachado inmediatamente para ${email} (jobId: ${jobId})`);
                        }
                    } catch (dispatchErr: any) {
                        this.logger.warn(`Dispatch inmediato falló para ${email}, el scheduler lo reintentará: ${dispatchErr?.message}`);
                        emailSent = false; // quedó en PENDING para el scheduler
                    }
                } else {
                    emailError = 'El email estaba en lista negra o fue rechazado';
                    this.logger.warn(`Email de provisión rechazado para ${email}`);
                }
            } catch (err: any) {
                emailError = err?.message;
                this.logger.error(`No se pudo encolar email de provisión para ${email}: ${err?.message}`);
            }
        }

        return {
            ok: true,
            userId,
            memberId: member.id,
            isNewUser,
            role,
            tempPassword: isNewUser && !sendEmail ? tempPassword : undefined,
            portalUrl,
            email: {
                queued: emailQueued,
                sent: emailSent,
                pendingDispatch: emailQueued && !emailSent,
                error: emailError,
            },
        };
    }

    /**
     * Reenvía credenciales a un miembro existente del tenant.
     * Genera (o usa) una nueva contraseña temporal, activa mustChangePassword=true
     * y envía el email con despacho inmediato.
     */
    async resendCredentials(tenantId: string, dto: ResendCredentialsDto) {
        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id: tenantId },
            include: { branding: { select: { primaryColor: true, companyDisplayName: true } } },
        });
        if (!tenant) throw new NotFoundException('Tenant no encontrado');

        if (!dto.email) throw new BadRequestException('Se requiere un email válido');

        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            select: { id: true, name: true, documentNumber: true, email: true },
        });
        if (!user) throw new NotFoundException(`No existe ningún usuario con el email ${dto.email}`);

        const email = user.email;

        // Verificar que es miembro activo del tenant
        const member = await this.prisma.tenantMember.findFirst({
            where: { tenantId, userId: user.id, status: 'ACTIVE' },
        });
        if (!member) throw new BadRequestException(`El usuario no es miembro activo de este tenant`);

        // Generar nueva contraseña temporal y actualizar usuario
        const tempPassword = dto.tempPassword?.trim() || this.generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash, mustChangePassword: true },
        });

        const portalUrl = this.resolvePortalUrl(tenant);
        const contactUrl = tenant.customDomain ? `https://${tenant.customDomain}` : portalUrl;
        const { html, text } = this.buildCredentialsEmail({
            userName: user.name.split(' ')[0],
            tenantName: tenant.branding?.companyDisplayName ?? tenant.name,
            portalUrl,
            documentNumber: user.documentNumber ?? email,
            tempPassword,
            primaryColor: tenant.branding?.primaryColor ?? '#f59e0b',
            contactUrl,
        });

        let emailSent = false;
        let emailQueued = false;
        let emailError: string | undefined;

        try {
            const jobId = await this.emailQueue.enqueueEmailGetId({
                type: 'VERIFICATION',
                priority: 'HIGH',
                required: true,
                recipientEmail: email,
                subject: `Tu acceso de la Polla de ${tenant.branding?.companyDisplayName ?? tenant.name}`,
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
                        this.logger.warn(`Reenvío encolado pero no despachado inmediatamente para ${email}`);
                    }
                } catch (dispatchErr: any) {
                    this.logger.warn(`Dispatch inmediato de reenvío falló para ${email}: ${dispatchErr?.message}`);
                }
            } else {
                emailError = 'El email estaba en lista negra o fue rechazado';
            }
        } catch (err: any) {
            emailError = err?.message;
            this.logger.error(`No se pudo encolar reenvío para ${email}: ${err?.message}`);
        }

        return {
            ok: true,
            userId: user.id,
            tempPassword,
            portalUrl,
            email: {
                queued: emailQueued,
                sent: emailSent,
                pendingDispatch: emailQueued && !emailSent,
                error: emailError,
            },
        };
    }

    /* ─────────────────────────────────────────────────────── */

    /**
     * Genera una contraseña temporal legible: 12 caracteres,
     * sin caracteres ambiguos (0/O/1/l/I).
     */
    protected generateTempPassword(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let out = '';
        for (let i = 0; i < 12; i++) {
            out += chars[Math.floor(Math.random() * chars.length)];
        }
        return out;
    }

    /**
     * Convierte un texto en username válido y verifica unicidad.
     * Si choca, agrega sufijo numérico hasta encontrar disponible.
     */
    protected async resolveUniqueUsername(base: string): Promise<string> {
        const sanitized = base
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 20) || 'user';

        let candidate = sanitized;
        let i = 1;
        while (await this.prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })) {
            candidate = `${sanitized}${i}`;
            i++;
            if (i > 999) throw new BadRequestException('No se pudo generar un username único');
        }
        return candidate;
    }

    protected resolvePortalUrl(tenant: { slug: string; customDomain: string | null }): string {
        if (tenant.customDomain) {
            return `https://${tenant.customDomain}`;
        }
        return `https://${tenant.slug}.zonapronosticos.com`;
    }

    protected normalizeDocumentNumber(value?: string | null): string | null {
        const trimmed = value?.trim();
        if (!trimmed) return null;
        const digitsOnly = trimmed.replace(/\D/g, '');
        return digitsOnly || trimmed;
    }

    protected buildCredentialsEmail(params: {
        userName: string;
        tenantName: string;
        portalUrl: string;
        documentNumber: string;
        tempPassword: string;
        primaryColor: string;
        contactUrl: string;
    }): { html: string; text: string } {
        const { userName, tenantName, portalUrl, documentNumber, tempPassword, primaryColor, contactUrl } = params;
        const websiteDisplay = contactUrl.replace(/^https?:\/\//, '');

        const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 40px 20px; margin: 0;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 20px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
    <div style="text-align: center; margin-bottom: 28px;">
      <div style="display: inline-flex; width: 56px; height: 56px; background: ${primaryColor}20; border-radius: 14px; align-items: center; justify-content: center; margin-bottom: 16px;">
        <span style="font-size: 28px;">🔑</span>
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a;">Bienvenido a ${tenantName}</h1>
      <p style="margin: 8px 0 0; color: #64748b; font-size: 14px;">Tu acceso al portal corporativo está listo</p>
    </div>

    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      Hemos creado una cuenta de administrador para la <strong>Polla ${tenantName}</strong>.
    </p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 0 0 24px;">
      <p style="margin: 0 0 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Tus credenciales de acceso</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 100px;">Usuario:</td>
          <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${documentNumber}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Contraseña:</td>
          <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 600; font-family: 'Courier New', monospace; background: white; padding-left: 10px; border-radius: 6px;">${tempPassword}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Portal:</td>
          <td style="padding: 6px 0;"><a href="${portalUrl}" style="color: ${primaryColor}; font-size: 14px; font-weight: 600; text-decoration: none;">${portalUrl}</a></td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${portalUrl}/login" style="display: inline-block; background: ${primaryColor}; color: #0f172a; font-size: 15px; font-weight: 700; padding: 14px 36px; border-radius: 12px; text-decoration: none;">
        Ingresar al portal
      </a>
    </div>

    <div style="background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 8px; padding: 14px 16px; margin: 0 0 16px;">
      <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.5;">
        <strong>Por seguridad</strong>, deberás cambiar tu contraseña al iniciar sesión por primera vez.
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0; line-height: 1.5;">
      Si no esperabas este correo, ignóralo o contáctanos con <strong>${tenantName}</strong>
      en <a href="https://${websiteDisplay}" style="color: ${primaryColor};">${websiteDisplay}</a>.
    </p>
  </div>
</body>
</html>`.trim();

        const text = `Polla ${tenantName}\n\nHemos creado una cuenta de administrador para la Polla ${tenantName}.\n\nTus credenciales de acceso:\n\nUsuario: ${documentNumber}\nContraseña: ${tempPassword}\nPortal: ${portalUrl}\n\nPor seguridad, deberás cambiar tu contraseña al iniciar sesión por primera vez.\n\nIngresa aquí: ${portalUrl}/login\n\nSi no esperabas este correo, ignóralo o contáctanos con ${tenantName} en ${websiteDisplay}.`;

        return { html, text };
    }
}
