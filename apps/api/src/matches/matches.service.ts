import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto, UpdateMatchScoreDto } from './dto/match.dto';
import { MatchStatus } from '@prisma/client';
import { PredictionsService } from '../predictions/predictions.service';
import { matchWithTeamsSelect, toMatchResponse } from './match-response.util';

@Injectable()
export class MatchesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly predictionsService: PredictionsService,
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
}
