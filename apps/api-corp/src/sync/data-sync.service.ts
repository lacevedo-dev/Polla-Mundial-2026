import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../overrides/prisma.service';
import axios from 'axios';

/**
 * Servicio de sincronización de datos desde el API principal
 * Mantiene actualizados: Torneos, Equipos, Partidos
 */
@Injectable()
export class DataSyncService {
    private readonly logger = new Logger(DataSyncService.name);
    private readonly mainApiUrl: string;
    private readonly internalApiKey: string;

    constructor(private readonly prisma: PrismaService) {
        this.mainApiUrl = process.env.MAIN_API_URL?.trim() || 'http://localhost:3000';
        this.internalApiKey = process.env.INTERNAL_API_KEY?.trim() || '';

        if (!this.internalApiKey) {
            this.logger.warn('INTERNAL_API_KEY no configurado - sincronización deshabilitada');
        }
    }

    /**
     * Sincroniza torneos activos cada hora
     */
    @Cron(CronExpression.EVERY_HOUR)
    async syncTournaments() {
        if (!this.internalApiKey) return;

        try {
            this.logger.log('Sincronizando torneos...');
            
            const response = await axios.get(`${this.mainApiUrl}/internal/tournaments`, {
                headers: { 'x-internal-api-key': this.internalApiKey },
            });

            const tournaments = response.data;

            for (const tournament of tournaments) {
                await this.prisma.tournament.upsert({
                    where: { id: tournament.id },
                    create: {
                        id: tournament.id,
                        name: tournament.name,
                        season: tournament.season,
                        country: tournament.country,
                        logo: tournament.logo,
                        startDate: tournament.startDate ? new Date(tournament.startDate) : null,
                        endDate: tournament.endDate ? new Date(tournament.endDate) : null,
                        active: tournament.active,
                        externalId: tournament.externalId,
                    },
                    update: {
                        name: tournament.name,
                        season: tournament.season,
                        country: tournament.country,
                        logo: tournament.logo,
                        startDate: tournament.startDate ? new Date(tournament.startDate) : null,
                        endDate: tournament.endDate ? new Date(tournament.endDate) : null,
                        active: tournament.active,
                        externalId: tournament.externalId,
                    },
                });
            }

            this.logger.log(`✅ ${tournaments.length} torneos sincronizados`);
        } catch (error) {
            this.logger.error('Error sincronizando torneos:', error instanceof Error ? error.message : error);
        }
    }

    /**
     * Sincroniza equipos cada 6 horas
     */
    @Cron(CronExpression.EVERY_6_HOURS)
    async syncTeams() {
        if (!this.internalApiKey) return;

        try {
            this.logger.log('Sincronizando equipos...');
            
            const response = await axios.get(`${this.mainApiUrl}/internal/teams`, {
                headers: { 'x-internal-api-key': this.internalApiKey },
            });

            const teams = response.data;

            for (const team of teams) {
                await this.prisma.team.upsert({
                    where: { id: team.id },
                    create: {
                        id: team.id,
                        name: team.name,
                        code: team.code,
                        logo: team.logo,
                        country: team.country,
                        externalId: team.externalId,
                    },
                    update: {
                        name: team.name,
                        code: team.code,
                        logo: team.logo,
                        country: team.country,
                        externalId: team.externalId,
                    },
                });
            }

            this.logger.log(`✅ ${teams.length} equipos sincronizados`);
        } catch (error) {
            this.logger.error('Error sincronizando equipos:', error instanceof Error ? error.message : error);
        }
    }

    /**
     * Sincroniza partidos cada 15 minutos
     */
    @Cron(CronExpression.EVERY_10_MINUTES)
    async syncMatches() {
        if (!this.internalApiKey) return;

        try {
            this.logger.log('Sincronizando partidos...');
            
            // Obtener partidos de los últimos 30 días y próximos 60 días
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

            const matches = response.data;

            for (const match of matches) {
                await this.prisma.match.upsert({
                    where: { id: match.id },
                    create: {
                        id: match.id,
                        tournamentId: match.tournamentId,
                        homeTeamId: match.homeTeamId,
                        awayTeamId: match.awayTeamId,
                        date: new Date(match.date),
                        venue: match.venue,
                        round: match.round,
                        stage: match.stage,
                        homeScore: match.homeScore,
                        awayScore: match.awayScore,
                        status: match.status,
                        externalId: match.externalId,
                    },
                    update: {
                        date: new Date(match.date),
                        venue: match.venue,
                        round: match.round,
                        stage: match.stage,
                        homeScore: match.homeScore,
                        awayScore: match.awayScore,
                        status: match.status,
                    },
                });
            }

            this.logger.log(`✅ ${matches.length} partidos sincronizados`);
        } catch (error) {
            this.logger.error('Error sincronizando partidos:', error instanceof Error ? error.message : error);
        }
    }

    /**
     * Sincronización manual completa
     */
    async syncAll() {
        this.logger.log('Iniciando sincronización completa...');
        await this.syncTournaments();
        await this.syncTeams();
        await this.syncMatches();
        this.logger.log('✅ Sincronización completa finalizada');
    }
}
