import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NotificationsProxyService {
    private readonly logger = new Logger(NotificationsProxyService.name);

    private get mainApiUrl(): string {
        return process.env.MAIN_API_URL ?? '';
    }

    private get isConfigured(): boolean {
        return Boolean(this.mainApiUrl);
    }

    constructor(private readonly http: HttpService) {}

    async proxyRequest(
        method: 'GET' | 'PATCH' | 'POST',
        path: string,
        userHeaders: Record<string, string>,
        params?: Record<string, string>,
    ): Promise<unknown> {
        if (!this.isConfigured) {
            this.logger.warn('MAIN_API_URL no configurado — proxy de notificaciones omitido');
            throw new ServiceUnavailableException('MAIN_API_URL no configurado');
        }

        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        const url = `${this.mainApiUrl}${path}${query}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (userHeaders.authorization) {
            headers['Authorization'] = userHeaders.authorization;
        }
        if (userHeaders['x-tenant-slug']) {
            headers['X-Tenant-Slug'] = userHeaders['x-tenant-slug'];
        }

        try {
            const res = await firstValueFrom(
                this.http.request({
                    method,
                    url,
                    headers,
                }),
            );
            return res.data;
        } catch (err: any) {
            const status = err?.response?.status;
            const data = err?.response?.data;
            this.logger.error(`Error proxy notificaciones ${method} ${path}: ${err?.message} (status=${status})`);
            if (status === 401 || status === 403) {
                throw new ServiceUnavailableException(data?.message ?? 'Error de autenticación con API principal');
            }
            throw new ServiceUnavailableException(data?.message ?? 'No se pudo conectar con el servidor principal');
        }
    }
}
