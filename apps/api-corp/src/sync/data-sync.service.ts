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
                        googleId: user.googleId ?? null,
                        githubId: user.githubId ?? null,
                        plan: user.plan ?? 'FREE',
                        emailVerified: Boolean(user.emailVerified),
                        systemRole: user.systemRole ?? 'USER',
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
                        googleId: user.googleId ?? null,
                        githubId: user.githubId ?? null,
                        plan: user.plan ?? 'FREE',
                        emailVerified: Boolean(user.emailVerified),
                        systemRole: user.systemRole ?? 'USER',
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

    /** Sincroniza datos corporativos base para operar con BD propia. */
    async syncCorporateBootstrap(): Promise<{ tenants: number; users: number; tenantMembers: number; leagues: number; leagueMembers: number; leagueTournaments: number; leagueMatches: number }> {
        if (!this.internalApiKey) {
            return { tenants: 0, users: 0, tenantMembers: 0, leagues: 0, leagueMembers: 0, leagueTournaments: 0, leagueMatches: 0 };
        }

        try {
            this.logger.log('Sincronizando bootstrap corporativo completo...');

            const response = await axios.get(`${this.mainApiUrl}/internal/corp-bootstrap`, {
                headers: { 'x-internal-api-key': this.internalApiKey },
            });

            const tenants = Array.isArray(response.data) ? response.data : [];
            const counts = {
                tenants: 0,
                users: 0,
                tenantMembers: 0,
                leagues: 0,
                leagueMembers: 0,
                leagueTournaments: 0,
                leagueMatches: 0,
            };

            for (const tenant of tenants) {
                if (!tenant?.id) continue;

                await this.upsertCorporateTenant(tenant);
                counts.tenants += 1;

                if (tenant.branding?.tenantId) {
                    await this.prisma.tenantBranding.upsert({
                        where: { tenantId: tenant.branding.tenantId },
                        create: {
                            id: tenant.branding.id,
                            tenantId: tenant.branding.tenantId,
                            logoUrl: tenant.branding.logoUrl ?? null,
                            faviconUrl: tenant.branding.faviconUrl ?? null,
                            primaryColor: tenant.branding.primaryColor ?? '#16a34a',
                            secondaryColor: tenant.branding.secondaryColor ?? '#15803d',
                            accentColor: tenant.branding.accentColor ?? '#bbf7d0',
                            fontFamily: tenant.branding.fontFamily ?? 'Inter',
                            heroImageUrl: tenant.branding.heroImageUrl ?? null,
                            sidebarImageUrl: tenant.branding.sidebarImageUrl ?? null,
                            companyDisplayName: tenant.branding.companyDisplayName ?? null,
                            customCss: tenant.branding.customCss ?? null,
                            emailHeaderHtml: tenant.branding.emailHeaderHtml ?? null,
                            emailFooterHtml: tenant.branding.emailFooterHtml ?? null,
                            emailInviteTemplate: tenant.branding.emailInviteTemplate ?? null,
                        } as any,
                        update: {
                            logoUrl: tenant.branding.logoUrl ?? null,
                            faviconUrl: tenant.branding.faviconUrl ?? null,
                            primaryColor: tenant.branding.primaryColor ?? '#16a34a',
                            secondaryColor: tenant.branding.secondaryColor ?? '#15803d',
                            accentColor: tenant.branding.accentColor ?? '#bbf7d0',
                            fontFamily: tenant.branding.fontFamily ?? 'Inter',
                            heroImageUrl: tenant.branding.heroImageUrl ?? null,
                            sidebarImageUrl: tenant.branding.sidebarImageUrl ?? null,
                            companyDisplayName: tenant.branding.companyDisplayName ?? null,
                            customCss: tenant.branding.customCss ?? null,
                            emailHeaderHtml: tenant.branding.emailHeaderHtml ?? null,
                            emailFooterHtml: tenant.branding.emailFooterHtml ?? null,
                            emailInviteTemplate: tenant.branding.emailInviteTemplate ?? null,
                        } as any,
                    });
                }

                if (tenant.config?.tenantId) {
                    await this.prisma.tenantConfig.upsert({
                        where: { tenantId: tenant.config.tenantId },
                        create: {
                            id: tenant.config.id,
                            tenantId: tenant.config.tenantId,
                            enablePayments: Boolean(tenant.config.enablePayments),
                            enableAiInsights: Boolean(tenant.config.enableAiInsights),
                            enablePublicLeagues: Boolean(tenant.config.enablePublicLeagues),
                            enableUserSelfRegister: Boolean(tenant.config.enableUserSelfRegister),
                            requireInvitation: tenant.config.requireInvitation !== false,
                            enableEmailNotif: tenant.config.enableEmailNotif !== false,
                            enablePushNotif: tenant.config.enablePushNotif !== false,
                            enableStageFees: tenant.config.enableStageFees !== false,
                        } as any,
                        update: {
                            enablePayments: Boolean(tenant.config.enablePayments),
                            enableAiInsights: Boolean(tenant.config.enableAiInsights),
                            enablePublicLeagues: Boolean(tenant.config.enablePublicLeagues),
                            enableUserSelfRegister: Boolean(tenant.config.enableUserSelfRegister),
                            requireInvitation: tenant.config.requireInvitation !== false,
                            enableEmailNotif: tenant.config.enableEmailNotif !== false,
                            enablePushNotif: tenant.config.enablePushNotif !== false,
                            enableStageFees: tenant.config.enableStageFees !== false,
                        } as any,
                    });
                }

                for (const member of tenant.members ?? []) {
                    if (!member?.id || !member?.user?.id) continue;
                    await this.upsertCorporateUser(member.user);
                    counts.users += 1;
                    await this.prisma.tenantMember.upsert({
                        where: { id: member.id },
                        create: {
                            id: member.id,
                            tenantId: member.tenantId,
                            userId: member.userId,
                            role: member.role,
                            status: member.status,
                            invitedAt: member.invitedAt ? new Date(member.invitedAt) : null,
                            joinedAt: member.joinedAt ? new Date(member.joinedAt) : null,
                        } as any,
                        update: {
                            role: member.role,
                            status: member.status,
                            invitedAt: member.invitedAt ? new Date(member.invitedAt) : null,
                            joinedAt: member.joinedAt ? new Date(member.joinedAt) : null,
                        } as any,
                    });
                    counts.tenantMembers += 1;
                }

                for (const league of tenant.leagues ?? []) {
                    if (!league?.id) continue;
                    const primaryTournamentId = league.primaryTournamentId && await this.existsById('tournament', league.primaryTournamentId)
                        ? league.primaryTournamentId
                        : null;
                    await this.prisma.league.upsert({
                        where: { id: league.id },
                        create: {
                            id: league.id,
                            name: league.name,
                            description: league.description ?? null,
                            code: league.code,
                            privacy: league.privacy,
                            logo: league.logo ?? league.logoUrl ?? null,
                            maxParticipants: league.maxParticipants ?? 10,
                            includeBaseFee: league.includeBaseFee ?? true,
                            baseFee: league.baseFee ?? null,
                            includeStageFees: Boolean(league.includeStageFees),
                            currency: league.currency ?? 'COP',
                            adminFeePercent: league.adminFeePercent ?? 10,
                            plan: league.plan ?? 'FREE',
                            status: league.status,
                            closePredictionMinutes: league.closePredictionMinutes ?? 15,
                            primaryTournamentId,
                            tenantId: league.tenantId ?? tenant.id,
                        } as any,
                        update: {
                            name: league.name,
                            description: league.description ?? null,
                            code: league.code,
                            privacy: league.privacy,
                            logo: league.logo ?? league.logoUrl ?? null,
                            maxParticipants: league.maxParticipants ?? 10,
                            includeBaseFee: league.includeBaseFee ?? true,
                            baseFee: league.baseFee ?? null,
                            includeStageFees: Boolean(league.includeStageFees),
                            currency: league.currency ?? 'COP',
                            adminFeePercent: league.adminFeePercent ?? 10,
                            plan: league.plan ?? 'FREE',
                            status: league.status,
                            closePredictionMinutes: league.closePredictionMinutes ?? 15,
                            primaryTournamentId,
                            tenantId: league.tenantId ?? tenant.id,
                        } as any,
                    });
                    counts.leagues += 1;

                    for (const leagueMember of league.members ?? []) {
                        if (!leagueMember?.id || !leagueMember?.user?.id) continue;
                        await this.upsertCorporateUser(leagueMember.user);
                        await this.prisma.leagueMember.upsert({
                            where: { id: leagueMember.id },
                            create: {
                                id: leagueMember.id,
                                leagueId: leagueMember.leagueId,
                                userId: leagueMember.userId,
                                role: leagueMember.role ?? 'PLAYER',
                                status: leagueMember.status ?? 'ACTIVE',
                                joinedAt: leagueMember.joinedAt ? new Date(leagueMember.joinedAt) : new Date(),
                            } as any,
                            update: {
                                role: leagueMember.role ?? 'PLAYER',
                                status: leagueMember.status ?? 'ACTIVE',
                                joinedAt: leagueMember.joinedAt ? new Date(leagueMember.joinedAt) : new Date(),
                            } as any,
                        });
                        counts.leagueMembers += 1;
                    }

                    for (const leagueTournament of league.leagueTournaments ?? []) {
                        if (!leagueTournament?.id || !leagueTournament?.leagueId || !leagueTournament?.tournamentId) continue;
                        if (!await this.existsById('tournament', leagueTournament.tournamentId)) continue;
                        await this.prisma.leagueTournament.upsert({
                            where: { id: leagueTournament.id },
                            create: {
                                id: leagueTournament.id,
                                leagueId: leagueTournament.leagueId,
                                tournamentId: leagueTournament.tournamentId,
                                addedAt: leagueTournament.addedAt ? new Date(leagueTournament.addedAt) : new Date(),
                            } as any,
                            update: {
                                leagueId: leagueTournament.leagueId,
                                tournamentId: leagueTournament.tournamentId,
                                addedAt: leagueTournament.addedAt ? new Date(leagueTournament.addedAt) : new Date(),
                            } as any,
                        });
                        counts.leagueTournaments += 1;
                    }

                    for (const leagueMatch of league.leagueMatches ?? []) {
                        if (!leagueMatch?.id || !leagueMatch?.leagueId || !leagueMatch?.matchId) continue;
                        if (!await this.existsById('match', leagueMatch.matchId)) continue;
                        await this.prisma.leagueMatch.upsert({
                            where: { id: leagueMatch.id },
                            create: {
                                id: leagueMatch.id,
                                leagueId: leagueMatch.leagueId,
                                matchId: leagueMatch.matchId,
                                active: leagueMatch.active !== false,
                                addedAt: leagueMatch.addedAt ? new Date(leagueMatch.addedAt) : new Date(),
                                addedBy: leagueMatch.addedBy ?? null,
                            } as any,
                            update: {
                                leagueId: leagueMatch.leagueId,
                                matchId: leagueMatch.matchId,
                                active: leagueMatch.active !== false,
                                addedAt: leagueMatch.addedAt ? new Date(leagueMatch.addedAt) : new Date(),
                                addedBy: leagueMatch.addedBy ?? null,
                            } as any,
                        });
                        counts.leagueMatches += 1;
                    }
                }
            }

            this.logger.log(`Bootstrap corporativo sincronizado: ${JSON.stringify(counts)}`);
            return counts;
        } catch (error) {
            this.logger.error('Error sincronizando bootstrap corporativo:', this.formatError(error));
            return { tenants: 0, users: 0, tenantMembers: 0, leagues: 0, leagueMembers: 0, leagueTournaments: 0, leagueMatches: 0 };
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
                        season: normalizeInt(tournament.season, new Date().getFullYear()),
                        country: tournament.country,
                        type: tournament.type ?? 'KNOCKOUT',
                        logoUrl: tournament.logoUrl ?? tournament.logo ?? null,
                        active: tournament.active,
                        apiFootballLeagueId: normalizeInt(tournament.apiFootballLeagueId ?? tournament.externalId, 0),
                    } as any,
                    update: {
                        name: tournament.name,
                        season: normalizeInt(tournament.season, new Date().getFullYear()),
                        country: tournament.country,
                        type: tournament.type ?? 'KNOCKOUT',
                        logoUrl: tournament.logoUrl ?? tournament.logo ?? null,
                        active: tournament.active,
                        apiFootballLeagueId: normalizeInt(tournament.apiFootballLeagueId ?? tournament.externalId, 0),
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
                        code: team.code ?? team.shortCode ?? team.name,
                        group: team.group ?? null,
                        flagUrl: team.flagUrl ?? team.logo ?? null,
                        shortCode: team.shortCode ?? team.code ?? null,
                        apiFootballTeamId: normalizeNullableInt(team.apiFootballTeamId ?? team.externalId),
                    } as any,
                    update: {
                        name: team.name,
                        code: team.code ?? team.shortCode ?? team.name,
                        group: team.group ?? null,
                        flagUrl: team.flagUrl ?? team.logo ?? null,
                        shortCode: team.shortCode ?? team.code ?? null,
                        apiFootballTeamId: normalizeNullableInt(team.apiFootballTeamId ?? team.externalId),
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
                const matchDate = match.matchDate ?? match.date;
                if (!match.tournamentId || !match.homeTeamId || !match.awayTeamId || !matchDate) {
                    skipped += 1;
                    continue;
                }

                await this.prisma.match.upsert({
                    where: { id: match.id },
                    create: {
                        id: match.id,
                        homeTeamId: match.homeTeamId,
                        awayTeamId: match.awayTeamId,
                        homeScore: match.homeScore,
                        awayScore: match.awayScore,
                        phase: match.phase ?? 'GROUP',
                        group: match.group ?? null,
                        matchNumber: match.matchNumber ?? null,
                        venue: match.venue,
                        matchDate: new Date(matchDate),
                        status: match.status,
                        externalId: match.externalId,
                        lastSyncAt: match.lastSyncAt ? new Date(match.lastSyncAt) : new Date(),
                        syncCount: normalizeInt(match.syncCount, 0),
                        round: match.round,
                        tournamentId: match.tournamentId,
                        predictionReportSentAt: match.predictionReportSentAt ? new Date(match.predictionReportSentAt) : null,
                        advancingTeamId: match.advancingTeamId ?? null,
                        resultNotificationSentAt: match.resultNotificationSentAt ? new Date(match.resultNotificationSentAt) : null,
                        elapsed: match.elapsed ?? null,
                        statusShort: match.statusShort ?? null,
                        eventsNoDataAt: match.eventsNoDataAt ? new Date(match.eventsNoDataAt) : null,
                    } as any,
                    update: {
                        homeTeamId: match.homeTeamId,
                        awayTeamId: match.awayTeamId,
                        homeScore: match.homeScore,
                        awayScore: match.awayScore,
                        phase: match.phase ?? 'GROUP',
                        group: match.group ?? null,
                        matchNumber: match.matchNumber ?? null,
                        venue: match.venue,
                        matchDate: new Date(matchDate),
                        status: match.status,
                        round: match.round,
                        tournamentId: match.tournamentId,
                        lastSyncAt: match.lastSyncAt ? new Date(match.lastSyncAt) : new Date(),
                        syncCount: normalizeInt(match.syncCount, 0),
                        predictionReportSentAt: match.predictionReportSentAt ? new Date(match.predictionReportSentAt) : null,
                        advancingTeamId: match.advancingTeamId ?? null,
                        resultNotificationSentAt: match.resultNotificationSentAt ? new Date(match.resultNotificationSentAt) : null,
                        elapsed: match.elapsed ?? null,
                        statusShort: match.statusShort ?? null,
                        eventsNoDataAt: match.eventsNoDataAt ? new Date(match.eventsNoDataAt) : null,
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

    /** Sincronizacion inicial/manual completa. La data corporativa solo se sincroniza aqui, no por cron. */
    async syncAll(): Promise<{ ok: boolean; bootstrap?: Awaited<ReturnType<DataSyncService['syncCorporateBootstrap']>>; tournaments?: number; teams?: number; matches?: { synced: number; skipped: number }; skipped?: boolean; reason?: string }> {
        if (!this.internalApiKey) {
            this.logger.warn('Sincronizacion omitida: INTERNAL_API_KEY no configurado');
            return { ok: false, skipped: true, reason: 'INTERNAL_API_KEY no configurado' };
        }

        this.logger.log('Iniciando sincronizacion completa...');
        const tournaments = await this.syncTournaments();
        const teams = await this.syncTeams();
        const matches = await this.syncMatches();
        const bootstrap = await this.syncCorporateBootstrap();
        this.logger.log('Sincronizacion completa finalizada');
        return { ok: true, bootstrap, tournaments, teams, matches };
    }

    private async upsertCorporateTenant(tenant: any): Promise<void> {
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
    }

    private async upsertCorporateUser(user: any): Promise<void> {
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
                googleId: user.googleId ?? null,
                githubId: user.githubId ?? null,
                plan: user.plan ?? 'FREE',
                emailVerified: Boolean(user.emailVerified),
                systemRole: user.systemRole ?? 'USER',
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
                googleId: user.googleId ?? null,
                githubId: user.githubId ?? null,
                plan: user.plan ?? 'FREE',
                emailVerified: Boolean(user.emailVerified),
                systemRole: user.systemRole ?? 'USER',
                status: user.status,
            } as any,
        });
    }

    private async existsById(modelName: 'tournament' | 'match', id: string): Promise<boolean> {
        const model = (this.prisma as any)[modelName];
        const record = await model.findUnique({ where: { id }, select: { id: true } });
        return Boolean(record);
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

function normalizeNullableInt(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizeInt(value: unknown, fallback: number): number {
    return normalizeNullableInt(value) ?? fallback;
}
