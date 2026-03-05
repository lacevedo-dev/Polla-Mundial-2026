import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto, UpdateMatchScoreDto } from './dto/match.dto';
import { MatchStatus } from '@prisma/client';
import { PredictionsService } from '../predictions/predictions.service';

@Injectable()
export class MatchesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly predictionsService: PredictionsService,
    ) { }

    async create(createMatchDto: CreateMatchDto) {
        return this.prisma.match.create({
            data: {
                ...createMatchDto,
                status: MatchStatus.SCHEDULED,
            },
            include: {
                homeTeam: true,
                awayTeam: true,
            },
        });
    }

    async findAll() {
        return this.prisma.match.findMany({
            include: {
                homeTeam: true,
                awayTeam: true,
            },
            orderBy: {
                matchDate: 'asc',
            },
        });
    }

    async findOne(id: string) {
        const match = await this.prisma.match.findUnique({
            where: { id },
            include: {
                homeTeam: true,
                awayTeam: true,
            },
        });

        if (!match) {
            throw new NotFoundException(`Match with ID ${id} not found`);
        }

        return match;
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
        });

        // Disparar cálculo de puntos
        await this.predictionsService.calculateMatchPoints(id);

        return updatedMatch;
    }

    async findByPhase(phase: any) {
        return this.prisma.match.findMany({
            where: { phase },
            include: {
                homeTeam: true,
                awayTeam: true,
            },
            orderBy: {
                matchDate: 'asc',
            },
        });
    }
}
