import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Proxy hacia el VPS principal para obtener datos de fútbol.
 * Las llamadas se autentican con INTERNAL_API_KEY.
 *
 * En Phase 1 (misma DB) este módulo retorna datos directamente.
 * En Phase 2 (DB separada) será el único punto de acceso a Match/Team/Tournament.
 */
@Injectable()
export class FootballProxyService {
    private readonly logger = new Logger(FootballProxyService.name);

    private get mainApiUrl(): string {
        return process.env.MAIN_API_URL ?? '';
    }

    private get internalApiKey(): string {
        return process.env.INTERNAL_API_KEY ?? '';
    }

    private get headers() {
        return {
            'x-internal-api-key': this.internalApiKey,
            'Content-Type': 'application/json',
        };
    }

    private get isConfigured(): boolean {
        return Boolean(this.mainApiUrl && this.internalApiKey);
    }

    constructor(private readonly http: HttpService) {}

    async getMatches(params?: { from?: string; to?: string; tournamentId?: string }): Promise<any[]> {
        if (!this.isConfigured) {
            this.logger.warn('MAIN_API_URL o INTERNAL_API_KEY no configurados — getMatches retorna []');
            return [];
        }
        try {
            const query = new URLSearchParams(params as any).toString();
            const url = `${this.mainApiUrl}/internal/matches${query ? '?' + query : ''}`;
            const res = await firstValueFrom(this.http.get(url, { headers: this.headers }));
            return res.data ?? [];
        } catch (err: any) {
            this.logger.error(`Error al obtener partidos del VPS principal: ${err?.message}`);
            throw new ServiceUnavailableException('No se pudo conectar con el servidor principal de datos');
        }
    }

    async getTournaments(): Promise<any[]> {
        if (!this.isConfigured) {
            this.logger.warn('MAIN_API_URL o INTERNAL_API_KEY no configurados — getTournaments retorna []');
            return [];
        }
        try {
            const res = await firstValueFrom(
                this.http.get(`${this.mainApiUrl}/internal/tournaments`, { headers: this.headers }),
            );
            return res.data ?? [];
        } catch (err: any) {
            this.logger.error(`Error al obtener torneos del VPS principal: ${err?.message}`);
            throw new ServiceUnavailableException('No se pudo conectar con el servidor principal de datos');
        }
    }

    async getTeams(): Promise<any[]> {
        if (!this.isConfigured) {
            this.logger.warn('MAIN_API_URL o INTERNAL_API_KEY no configurados — getTeams retorna []');
            return [];
        }
        try {
            const res = await firstValueFrom(
                this.http.get(`${this.mainApiUrl}/internal/teams`, { headers: this.headers }),
            );
            return res.data ?? [];
        } catch (err: any) {
            this.logger.error(`Error al obtener equipos del VPS principal: ${err?.message}`);
            throw new ServiceUnavailableException('No se pudo conectar con el servidor principal de datos');
        }
    }

    async syncUserToMain(userData: {
        id: string;
        email: string;
        name: string;
        passwordHash: string;
    }): Promise<void> {
        if (!this.isConfigured) {
            this.logger.warn('MAIN_API_URL no configurado — syncUserToMain omitido');
            return;
        }
        try {
            await firstValueFrom(
                this.http.post(`${this.mainApiUrl}/internal/users/sync`, userData, {
                    headers: this.headers,
                }),
            );
        } catch (err: any) {
            this.logger.error(`Error al sincronizar usuario con VPS principal: ${err?.message}`);
        }
    }
}
