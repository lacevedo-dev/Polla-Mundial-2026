import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantProvisioningService as BaseTenantProvisioningService } from '@api-base/corporate-tenant/tenant-provisioning.service';

@Injectable()
export class TenantProvisioningService extends BaseTenantProvisioningService {
    async resendCredentials(tenantId: string, dto: any) {
        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id: tenantId },
            include: { branding: { select: { primaryColor: true, companyDisplayName: true } } },
        });
        if (!tenant) throw new NotFoundException('Tenant no encontrado');

        const documentNumber = this.normalizeDocumentNumber(dto.documentNumber);

        let user: { id: string; name: string; documentNumber: string | null; email: string } | null = null;

        if (documentNumber) {
            user = await this.prisma.user.findFirst({
                where: { documentNumber },
                select: { id: true, name: true, documentNumber: true, email: true },
            });
        } else if (dto.email) {
            user = await this.prisma.user.findFirst({
                where: { email: dto.email },
                select: { id: true, name: true, documentNumber: true, email: true },
            });
        }

        if (!user) {
            const identifier = documentNumber ?? dto.email ?? 'desconocido';
            throw new NotFoundException(`No existe ningún usuario con el identificador ${identifier}`);
        }

        const email = user.email;

        // Verificar que es miembro activo del tenant
        const member = await this.prisma.tenantMember.findFirst({
            where: { tenantId, userId: user.id, status: 'ACTIVE' },
        });
        if (!member) throw new BadRequestException(`El usuario no es miembro activo de este tenant`);

        // Generar nueva contraseña temporal y actualizar usuario
        const tempPassword = dto.tempPassword?.trim() || this.generateTempPassword();
        const passwordHash = await (await import('bcrypt')).hash(tempPassword, 10);
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
}
