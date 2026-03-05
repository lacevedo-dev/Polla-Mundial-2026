import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePredictionDto } from './dto/prediction.dto';
import { MemberStatus } from '@prisma/client';

@Injectable()
export class PredictionsService {
    constructor(private readonly prisma: PrismaService) { }

    async upsertPrediction(userId: string, createPredictionDto: CreatePredictionDto) {
        const { matchId, leagueId, homeScore, awayScore } = createPredictionDto;

        // 1. Verificar que el usuario sea miembro activo de la liga
        const membership = await this.prisma.leagueMember.findUnique({
            where: { userId_leagueId: { userId, leagueId } },
        });

        if (!membership || membership.status !== MemberStatus.ACTIVE) {
            throw new ForbiddenException('No eres un miembro activo de esta liga');
        }

        // 2. Obtener información del partido y de la liga (para el tiempo de cierre)
        const [match, league] = await Promise.all([
            this.prisma.match.findUnique({ where: { id: matchId } }),
            this.prisma.league.findUnique({ where: { id: leagueId } }),
        ]);

        if (!match || !league) {
            throw new NotFoundException('Partido o Liga no encontrados');
        }

        // 3. Validar si el tiempo para predecir ya expiró
        const now = new Date();
        const matchDate = new Date(match.matchDate);
        const closingTime = new Date(matchDate.getTime() - league.closePredictionMinutes * 60000);

        if (now > closingTime) {
            throw new BadRequestException('El tiempo para realizar predicciones ha expirado para este partido');
        }

        // 4. Crear o actualizar la predicción
        return this.prisma.prediction.upsert({
            where: {
                userId_matchId_leagueId: { userId, matchId, leagueId },
            },
            update: {
                homeScore,
                awayScore,
                submittedAt: now,
            },
            create: {
                userId,
                matchId,
                leagueId,
                homeScore,
                awayScore,
                submittedAt: now,
            },
        });
    }

    async findByLeagueAndUser(leagueId: string, userId: string) {
        return this.prisma.prediction.findMany({
            where: { leagueId, userId },
            include: {
                match: {
                    include: {
                        homeTeam: true,
                        awayTeam: true,
                    },
                },
            },
        });
    }

    async calculateMatchPoints(matchId: string) {
        // 1. Obtener el partido finalizado
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
        });

        if (!match || match.homeScore === null || match.awayScore === null) {
            return;
        }

        // 2. Obtener todas las predicciones para este partido
        const predictions = await this.prisma.prediction.findMany({
            where: { matchId },
            include: {
                league: {
                    include: {
                        scoringRules: {
                            where: { active: true }
                        }
                    }
                }
            }
        });

        // 3. Procesar cada predicción
        for (const pred of predictions) {
            const points = this.calculatePointsForOne(match, pred, pred.league.scoringRules);

            await this.prisma.prediction.update({
                where: { id: pred.id },
                data: {
                    points: points.total,
                    pointDetail: points.detail as any,
                }
            });
        }
    }

    private calculatePointsForOne(match: any, pred: any, rules: any[]) {
        let total = 0;
        const detail: any[] = [];

        const actualHome = match.homeScore;
        const actualAway = match.awayScore;
        const predHome = pred.homeScore;
        const predAway = pred.awayScore;

        const actualWinner = actualHome > actualAway ? 'HOME' : actualHome < actualAway ? 'AWAY' : 'DRAW';
        const predWinner = predHome > predAway ? 'HOME' : predHome < predAway ? 'AWAY' : 'DRAW';

        // Regla: Marcador Exacto
        if (actualHome === predHome && actualAway === predAway) {
            const rule = rules.find(r => r.ruleType === 'EXACT_SCORE');
            if (rule) {
                total += rule.points;
                detail.push({ type: 'EXACT_SCORE', points: rule.points });
            } else {
                // Default if no rule defined
                total += 5;
                detail.push({ type: 'EXACT_SCORE (default)', points: 5 });
            }
            // Si es exacto, usualmente no se suman las otras (depende del diseño, aquí paramos o seguimos)
            return { total, detail };
        }

        // Regla: Ganador Correcto
        if (actualWinner === predWinner) {
            const rule = rules.find(r => r.ruleType === 'CORRECT_WINNER');
            if (rule) {
                total += rule.points;
                detail.push({ type: 'CORRECT_WINNER', points: rule.points });
            } else {
                total += 2;
                detail.push({ type: 'CORRECT_WINNER (default)', points: 2 });
            }
        }

        // Regla: Diferencia de Goles Correcta
        const actualDiff = actualHome - actualAway;
        const predDiff = predHome - predAway;
        if (actualDiff === predDiff && actualWinner !== 'DRAW') {
            const rule = rules.find(r => r.ruleType === 'CORRECT_DIFF');
            if (rule) {
                total += rule.points;
                detail.push({ type: 'CORRECT_DIFF', points: rule.points });
            }
            // Nota: No sumamos diff en empates porque ya está cubierto por ganador si el empate es el mismo
        }

        return { total, detail };
    }

    async getLeaderboard(leagueId: string) {
        // Cálculo básico de ranking basado en la suma de puntos
        const members = await this.prisma.leagueMember.findMany({
            where: { leagueId, status: MemberStatus.ACTIVE },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
        });

        const predictions = await this.prisma.prediction.groupBy({
            by: ['userId'],
            _sum: {
                points: true,
            },
            where: { leagueId },
        });

        const leaderboard = members.map((member) => {
            const predSum = predictions.find((p) => p.userId === member.userId);
            return {
                ...member.user,
                points: predSum?._sum?.points || 0,
            };
        }).sort((a, b) => b.points - a.points);

        return leaderboard;
    }
}
