import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto, UpdateMatchScoreDto } from './dto/match.dto';
import { MatchStatus } from '@prisma/client';
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
        const match = await this.findOne(id);

        const updatedMatch = await this.prisma.match.update({
            where: { id },
            data: {
                homeScore: updateScoreDto.homeScore,
                awayScore: updateScoreDto.awayScore,
                status: MatchStatus.FINISHED,
            },
            select: matchWithTeamsSelect,
        });

        // Disparar cálculo de puntos
        await this.predictionsService.calculateMatchPoints(id);
        await this.predictionsService.calculatePhaseBonuses(id).catch((error: Error) => {
            this.logger.error(`Error calculating phase bonuses for match ${id}: ${error.message}`);
        });
        this.predictionReportService.sendMatchResultsReport(id).catch((error: Error) => {
            this.logger.error(`Error sending results email for match ${id}: ${error.message}`);
        });

        return toMatchResponse(updatedMatch);
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
        try {
            const leagueTournaments = await this.prisma.leagueTournament.findMany({
                where: { leagueId },
                select: { tournamentId: true },
            });

            // If league has no tournaments assigned, fall back to all matches
            const where = leagueTournaments.length > 0
                ? { tournamentId: { in: leagueTournaments.map(lt => lt.tournamentId) } }
                : {};

            const matches = await this.prisma.match.findMany({
                where,
                select: matchWithTeamsSelect,
                orderBy: { matchDate: 'asc' },
            });

            return matches.map(toMatchResponse);
        } catch {
            // Fallback: return all matches if league-tournament table unavailable
            return this.findAll();
        }
    }
}
