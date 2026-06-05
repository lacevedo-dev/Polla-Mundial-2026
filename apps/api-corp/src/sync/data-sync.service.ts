import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../overrides/prisma.service';
import axios, { AxiosError } from 'axios';

/**
 * Servicio de sincronizacion de datos desde el API principal.
 * Mantiene actualizados: Usuarios administrativos corporativos, Torneos, Equipos, Partidos.
 */
@Injectable()
export class DataSyncService implements OnModuleInit {
    private readonly logger = new Logger(DataSyncService.name);
    private readonly mainApiUrl: string;
    private readonly internalApiKey: string;

    constructor(private readonly prisma: PrismaService) {
        this.mainApiUrl = process.env.MAIN_API_URL?.trim() || 'http://localhost:3000';
        this.internalApiKey = process.env.INTERNAL_API_KEY?.trim() || '';

        if (!this.internalApiKey) {
            this.logger.warn('INTERNAL_API_KEY no configurado - sincronizacion deshabilitada');
        }
    }

    /** Sincroniza usuarios administrativos corporativos para login independiente en api-corp. */
    async syncAdminUsers(): Promise<number> {
        if (!this.internalApiKey) return 0;

        try {
            this.logger.log('Sincronizando usuarios corporativos administrativos...');

            const response = await axios.get(`${this.mainApiUrl}/internal/corp-admin-users`, {
                headers: { 'x-internal-api-key': this.internalApiKey },
            });

            const adminMembers = Array.isArray(response.data) ? response.data : [];
            let synced = 0;

            for (const item of adminMembers) {
                const tenant = item?.tenant;
                const user = item?.user;
                const membership = item?.membership;

                if (!tenant?.id || !user?.id || !membership?.id || !membership?.tenantId || !membership?.userId) {
                    continue;
                }

                await this.prisma.corporateTenant.upsert({
                    where: { id: tenant.id },
                    create: {
                        id: tenant.id,
                        slug: tenant.slug,
                        name: tenant.name,
                        legalName: tenant.legalName ?? null,
                        contactEmail: tenant.contactEmail ?? '',
                        status: tenant.status,
                        planTier: tenant.planTier,
                        allowedDomains: stringifyNullable(tenant.allowedDomains),
                        customDomain: tenant.customDomain ?? null,
                        ssoEnabled: Boolean(tenant.ssoEnabled),
                        ssoProvider: tenant.ssoProvider ?? null,
                        ssoConfig: stringifyNullable(tenant.ssoConfig),
                        maxUsers: tenant.maxUsers ?? 50,
                        maxLeagues: tenant.maxLeagues ?? 3,
                    } as any,
                    update: {
                        slug: tenant.slug,
                        name: tenant.name,
                        legalName: tenant.legalName ?? null,
                        contactEmail: tenant.contactEmail ?? '',
                        status: tenant.status,
                        planTier: tenant.planTier,
                        allowedDomains: stringifyNullable(tenant.allowedDomains),
                        customDomain: tenant.customDomain ?? null,
                        ssoEnabled: Boolean(tenant.ssoEnabled),
                        ssoProvider: tenant.ssoProvider ?? null,
                        ssoConfig: stringifyNullable(tenant.ssoConfig),
                        maxUsers: tenant.maxUsers ?? 50,
                        maxLeagues: tenant.maxLeagues ?? 3,
                    } as any,
                });

                await this.prisma.user.upsert({
                    where: { id: user.id },
                    create: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        username: user.username,
                        documentNumber: user.documentNumber ?? null,
                        phone: user.phone ?? null,
                        countryCode: user.countryCode ?? '+57',
                        avatar: user.avatar ?? null,
                        birthDate: user.birthDate ? new Date(user.birthDate) : null,
                        passwordHash: user.passwordHash,
                        mustChangePassword: Boolean(user.mustChangePassword),
                        emailVerified: Boolean(user.emailVerified),
                        status: user.status,
                    } as any,
                    update: {
                        name: user.name,
                        email: user.email,
                        username: user.username,
                        documentNumber: user.documentNumber ?? null,
                        phone: user.phone ?? null,
                        countryCode: user.countryCode ?? '+57',
                        avatar: user.avatar ?? null,
                        birthDate: user.birthDate ? new Date(user.birthDate) : null,
                        passwordHash: user.passwordHash,
                        mustChangePassword: Boolean(user.mustChangePassword),
                        emailVerified: Boolean(user.emailVerified),
                        status: user.status,
                    } as any,
                });

                await this.prisma.tenantMember.upsert({
                    where: { id: membership.id },
                    create: {
                        id: membership.id,
                        tenantId: membership.tenantId,
                        userId: membership.userId,
                        role: membership.role,
                        status: membership.status,
                        invitedAt: membership.invitedAt ? new Date(membership.invitedAt) : null,
                        joinedAt: membership.joinedAt ? new Date(membership.joinedAt) : null,
                    } as any,
                    update: {
                        role: membership.role,
                        status: membership.status,
                        invitedAt: membership.invitedAt ? new Date(membership.invitedAt) : null,
                        joinedAt: membership.joinedAt ? new Date(membership.joinedAt) : null,
                    } as any,
                });

                synced += 1;
            }

            this.logger.log(`${synced} usuarios administrativos corporativos sincronizados`);
            return synced;
        } catch (error) {
            this.logger.error('Error sincronizando usuarios administrativos corporativos:', this.formatError(error));
            return 0;
        }
    }

    onModuleInit(): void {
        const syncOnStartup = process.env.CORP_SYNC_ON_STARTUP !== 'false';
        this.logger.log(
            `Configuracion sync corporativa: mainApiUrl=${this.mainApiUrl}, internalApiKeyConfigured=${this.internalApiKey ? 'yes' : 'no'}, syncOnStartup=${syncOnStartup ? 'yes' : 'no'}`,
        );

        if (syncOnStartup) {
            setTimeout(() => {
                this.syncAll().catch((error) => {
                    this.logger.error('Error en sincronizacion inicial:', this.formatError(error));
                });
            }, 3000);
        }
    }

    /** Sincroniza torneos activos cada hora. */
    @Cron(CronExpression.EVERY_HOUR)
    async syncTournaments(): Promise<number> {
        if (!this.internalApiKey) return 0;

        try {
            this.logger.log('Sincronizando torneos...');

            const response = await axios.get(`${this.mainApiUrl}/internal/tournaments`, {
                headers: { 'x-internal-api-key': this.internalApiKey },
            });

            const tournaments = Array.isArray(response.data) ? response.data : [];

            for (const tournament of tournaments) {
                await this.prisma.tournament.upsert({
                    where: { id: tournament.id },
                    create: {
                        id: tournament.id,
                        name: tournament.name,
                        season: tournament.season != null ? String(tournament.season) : null,
                        country: tournament.country,
                        logo: tournament.logo ?? tournament.logoUrl ?? null,
                        startDate: tournament.startDate ? new Date(tournament.startDate) : null,
                        endDate: tournament.endDate ? new Date(tournament.endDate) : null,
                        active: tournament.active,
                        externalId: stringifyNullable(tournament.externalId ?? tournament.apiFootballLeagueId),
                    } as any,
                    update: {
                        name: tournament.name,
                        season: tournament.season != null ? String(tournament.season) : null,
                        country: tournament.country,
                        logo: tournament.logo ?? tournament.logoUrl ?? null,
                        startDate: tournament.startDate ? new Date(tournament.startDate) : null,
                        endDate: tournament.endDate ? new Date(tournament.endDate) : null,
                        active: tournament.active,
                        externalId: stringifyNullable(tournament.externalId ?? tournament.apiFootballLeagueId),
                    } as any,
                });
            }

            this.logger.log(`${tournaments.length} torneos sincronizados`);
            return tournaments.length;
        } catch (error) {
            this.logger.error('Error sincronizando torneos:', this.formatError(error));
            return 0;
        }
    }

    /** Sincroniza equipos cada 6 horas. */
    @Cron(CronExpression.EVERY_6_HOURS)
    async syncTeams(): Promise<number> {
        if (!this.internalApiKey) return 0;

        try {
            this.logger.log('Sincronizando equipos...');

            const response = await axios.get(`${this.mainApiUrl}/internal/teams`, {
                headers: { 'x-internal-api-key': this.internalApiKey },
            });

            const teams = Array.isArray(response.data) ? response.data : [];

            for (const team of teams) {
                await this.prisma.team.upsert({
                    where: { id: team.id },
                    create: {
                        id: team.id,
                        name: team.name,
                        code: team.code,
                        logo: team.logo ?? team.flagUrl ?? null,
                        country: team.country,
                        externalId: stringifyNullable(team.externalId ?? team.apiFootballTeamId),
                    } as any,
                    update: {
                        name: team.name,
                        code: team.code,
                        logo: team.logo ?? team.flagUrl ?? null,
                        country: team.country,
                        externalId: stringifyNullable(team.externalId ?? team.apiFootballTeamId),
                    } as any,
                });
            }

            this.logger.log(`${teams.length} equipos sincronizados`);
            return teams.length;
        } catch (error) {
            this.logger.error('Error sincronizando equipos:', this.formatError(error));
            return 0;
        }
    }

    /** Sincroniza partidos cada 10 minutos. */
    @Cron(CronExpression.EVERY_10_MINUTES)
    async syncMatches(): Promise<{ synced: number; skipped: number }> {
        if (!this.internalApiKey) return { synced: 0, skipped: 0 };

        try {
            this.logger.log('Sincronizando partidos...');

            const from = new Date();
            from.setDate(from.getDate() - 30);
            const to = new Date();
            to.setDate(to.getDate() + 60);

            const response = await axios.get(`${this.mainApiUrl}/internal/matches`, {
                headers: { 'x-internal-api-key': this.internalApiKey },
                params: {
                    from: from.toISOString(),
                    to: to.toISOString(),
                },
            });

            const matches = Array.isArray(response.data) ? response.data : [];
            let synced = 0;
            let skipped = 0;

            for (const match of matches) {
                const matchDate = match.date ?? match.matchDate;
                if (!match.tournamentId || !match.homeTeamId || !match.awayTeamId || !matchDate) {
                    skipped += 1;
                    continue;
                }

                await this.prisma.match.upsert({
                    where: { id: match.id },
                    create: {
                        id: match.id,
                        tournamentId: match.tournamentId,
                        homeTeamId: match.homeTeamId,
                        awayTeamId: match.awayTeamId,
                        date: new Date(matchDate),
                        venue: match.venue,
                        round: match.round,
                        stage: match.stage,
                        homeScore: match.homeScore,
                        awayScore: match.awayScore,
                        status: match.status,
                        externalId: match.externalId,
                    } as any,
                    update: {
                        date: new Date(matchDate),
                        venue: match.venue,
                        round: match.round,
                        stage: match.stage,
                        homeScore: match.homeScore,
                        awayScore: match.awayScore,
                        status: match.status,
                    } as any,
                });
                synced += 1;
            }

            this.logger.log(`${synced} partidos sincronizados${skipped ? ` (${skipped} omitidos por datos incompletos)` : ''}`);
            return { synced, skipped };
        } catch (error) {
            this.logger.error('Error sincronizando partidos:', this.formatError(error));
            return { synced: 0, skipped: 0 };
        }
    }

    /** Sincronizacion manual completa. */
    async syncAll(): Promise<{ ok: boolean; adminUsers?: number; tournaments?: number; teams?: number; matches?: { synced: number; skipped: number }; skipped?: boolean; reason?: string }> {
        if (!this.internalApiKey) {
            this.logger.warn('Sincronizacion omitida: INTERNAL_API_KEY no configurado');
            return { ok: false, skipped: true, reason: 'INTERNAL_API_KEY no configurado' };
        }

        this.logger.log('Iniciando sincronizacion completa...');
        const adminUsers = await this.syncAdminUsers();
        const tournaments = await this.syncTournaments();
        const teams = await this.syncTeams();
        const matches = await this.syncMatches();
        this.logger.log('Sincronizacion completa finalizada');
        return { ok: true, adminUsers, tournaments, teams, matches };
    }

    private formatError(error: unknown): string {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            return `HTTP ${axiosError.response?.status ?? 'sin respuesta'} ${axiosError.message} ${JSON.stringify(axiosError.response?.data ?? {})}`;
        }

        return error instanceof Error ? error.message : String(error);
    }
}

function stringifyNullable(value: unknown): string | null {
    return value === undefined || value === null ? null : String(value);
}
