import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(private readonly tenantService: TenantService) {}

    async use(req: Request & { tenantId?: string | null }, _res: Response, next: NextFunction) {
        const slug = req.headers['x-tenant-slug'] as string | undefined;
        const host = req.headers['host'] as string | undefined;

        req.tenantId = null;

        if (slug) {
            req.tenantId = await this.tenantService.resolveBySlug(slug);
        } else if (host) {
            const hostname = host.split(':')[0];
            const parts = hostname.split('.');

            if (parts.length >= 3) {
                const subdomain = parts[0];
                const baseDomain = parts.slice(1).join('.');

                if (baseDomain === 'zonapronosticos.com') {
                    req.tenantId = await this.tenantService.resolveBySlug(subdomain);
                }
            }

            if (!req.tenantId && hostname !== 'tupollamundial.com' && hostname !== 'zonapronosticos.com') {
                req.tenantId = await this.tenantService.resolveByCustomDomain(hostname);
            }
        }

        next();
    }
}
