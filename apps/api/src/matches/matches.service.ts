import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto, UpdateMatchScoreDto } from './dto/match.dto';
import { MatchStatus, Phase } from '@prisma/client';
import { PredictionsService } from '../predictions/predictions.service';
import { matchWithTeamsSelect, toMatchResponse } from './match-response.util';
import { PredictionReportService } from '../prediction-report/prediction-report.service';

@Injectable()
export class MatchesService {
    private readonly logger = new Logger(MatchesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly predictionsService: PredictionsService,
        private readonly predictionReportService: PredictionReportService,
    ) { }

    async create(createMatchDto: CreateMatchDto) {
        const match = await this.prisma.match.create({
            data: {
                ...createMatchDto,
                status: MatchStatus.SCHEDULED,
            },
            select: matchWithTeamsSelect,
        });

        return toMatchResponse(match);
    }

    async findAll() {
        const matches = await this.prisma.match.findMany({
            select: matchWithTeamsSelect,
            orderBy: {
                matchDate: 'asc',
            },
        });

        return matches.map(toMatchResponse);
    }

    async findOne(id: string) {
        const match = await this.prisma.match.findUnique({
            where: { id },
            select: matchWithTeamsSelect,
        });

        if (!match) {
            throw new NotFoundException(`Match with ID ${id} not found`);
        }

        return toMatchResponse(match);
    }

    async updateScore(id: string, updateScoreDto: UpdateMatchScoreDto) {
        await this.findOne(id);

        const updatedMatch = await this.prisma.match.update({
            where: { id },
            data: {
                homeScore: updateScoreDto.homeScore,
                awayScore: updateScoreDto.awayScore,
                status: MatchStatus.FINISHED,
            },
            select: matchWithTeamsSelect,
        });

        await this.recalculateFinishedMatchScoring(id, { sendReport: true });

        return toMatchResponse(updatedMatch);
    }

    async recalculateFinishedMatchScoring(
        matchId: string,
        options: { sendReport?: boolean } = {},
    ) {
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            select: {
                id: true,
                phase: true,
                homeScore: true,
                awayScore: true,
                homeTeamId: true,
                awayTeamId: true,
                advancingTeamId: true,
            },
        });

        if (!match) {
            throw new NotFoundException(`Match with ID ${matchId} not found`);
        }

        if (match.homeScore === null || match.awayScore === null) {
            throw new BadRequestException('El partido no tiene marcador registrado para calcular puntos.');
        }

        if (match.phase !== Phase.GROUP && match.homeScore !== match.awayScore) {
            const advancingTeamId = match.homeScore > match.awayScore
                ? match.homeTeamId
                : match.awayTeamId;
            if (advancingTeamId && match.advancingTeamId !== advancingTeamId) {
                await this.prisma.match.update({
                    where: { id: matchId },
                    data: { advancingTeamId },
                });
            }
        }

        await this.predictionsService.calculateMatchPoints(matchId);
        await this.predictionsService.calculatePhaseBonuses(matchId).catch((error: Error) => {
            this.logger.error(`Error calculating phase bonuses for match ${matchId}: ${error.message}`);
        });

        if (options.sendReport) {
            this.predictionReportService.sendMatchResultsReport(matchId).catch((error: Error) => {
                this.logger.error(`Error sending results email for match ${matchId}: ${error.message}`);
            });
        }
    }

    async findByPhase(phase: any) {
        const matches = await this.prisma.match.findMany({
            where: { phase },
            select: matchWithTeamsSelect,
            orderBy: {
                matchDate: 'asc',
            },
        });

        return matches.map(toMatchResponse);
    }

    async findByLeague(leagueId: string) {
        // Solo retornar partidos con LeagueMatch activo
        const leagueMatches = await this.prisma.leagueMatch.findMany({
            where: {
                leagueId,
                active: true
            },
            select: { matchId: true },
        });

        if (leagueMatches.length === 0) {
            this.logger.warn(`[findByLeague] No hay partidos activos para leagueId=${leagueId}`);
            
            // Diagnóstico: verificar si hay torneos vinculados
            const leagueTournaments = await this.prisma.leagueTournament.findMany({
                where: { leagueId },
                select: { tournamentId: true },
            });
            
            if (leagueTournaments.length === 0) {
                this.logger.warn(`[findByLeague] La polla ${leagueId} no tiene torneos vinculados`);
            } else {
                this.logger.warn(`[findByLeague] La polla ${leagueId} tiene ${leagueTournaments.length} torneos vinculados pero 0 partidos activos en LeagueMatch`);
                
                // Verificar cuántos partidos hay disponibles en esos torneos
                const availableMatches = await this.prisma.match.count({
                    where: {
                        tournamentId: { in: leagueTournaments.map(lt => lt.tournamentId) }
                    }
                });
                
                this.logger.warn(`[findByLeague] Hay ${availableMatches} partidos disponibles en los torneos vinculados que NO están activos en LeagueMatch`);
            }
            
            return []; // Sin partidos activos = array vacío
        }

        const matches = await this.prisma.match.findMany({
            where: { id: { in: leagueMatches.map(lm => lm.matchId) } },
            select: matchWithTeamsSelect,
            orderBy: { matchDate: 'asc' },
        });

        this.logger.log(`[findByLeague] Retornando ${matches.length} partidos activos para leagueId=${leagueId}`);
        return matches.map(toMatchResponse);
    }
}
