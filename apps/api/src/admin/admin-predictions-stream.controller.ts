import {
    Controller, Post, Body, UseGuards, Sse, MessageEvent,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { Observable, Subject } from 'rxjs';

export enum PredictionStrategy {
    RANDOM = 'random',
    CONSERVATIVE = 'conservative',
    HOME_BIAS = 'home_bias',
    REALISTIC = 'realistic',
}

export class BulkSeedStreamDto {
    @IsArray()
    @IsString({ each: true })
    leagueIds: string[];

    @IsArray()
    @IsString({ each: true })
    matchIds?: string[];

    @IsEnum(PredictionStrategy)
    strategy?: PredictionStrategy;

    @IsBoolean()
    simulatePayments?: boolean;
}

interface ProgressEvent {
    type: 'progress' | 'league_start' | 'league_complete' | 'member_complete' | 'complete' | 'error';
    message: string;
    data?: any;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/predictions')
export class AdminPredictionsStreamController {
    constructor(private readonly prisma: PrismaService) {}

    @Sse('bulk-seed-stream')
    @ApiOperation({ summary: 'Seed predictions with real-time progress streaming' })
    bulkSeedStream(@CurrentUser() user: { id: string }, @Body() dto: BulkSeedStreamDto): Observable<MessageEvent> {
        const subject = new Subject<MessageEvent>();
        
        // Start async processing
        this.processBulkSeed(user, dto, subject).catch(error => {
            subject.next({
                data: {
                    type: 'error',
                    message: error.message || 'Error al generar pronósticos',
                    data: { error: error.toString() }
                }
            } as MessageEvent);
            subject.complete();
        });

        return subject.asObservable();
    }

    private async processBulkSeed(user: { id: string }, dto: BulkSeedStreamDto, subject: Subject<MessageEvent>) {
        const { leagueIds, matchIds, strategy = PredictionStrategy.RANDOM, simulatePayments = false } = dto;

        try {
            if (leagueIds.length === 0) {
                throw new BadRequestException('Debe seleccionar al menos una polla');
            }

            subject.next({
                data: {
                    type: 'progress',
                    message: 'Validando pollas seleccionadas...',
                    data: { step: 'validation', progress: 0 }
                }
            } as MessageEvent);

            // Validate leagues exist
            const leagues = await this.prisma.league.findMany({
                where: { id: { in: leagueIds } },
                select: { id: true, name: true, baseFee: true },
            });

            if (leagues.length === 0) {
                throw new BadRequestException('No se encontraron las pollas seleccionadas');
            }

            subject.next({
                data: {
                    type: 'progress',
                    message: `${leagues.length} polla(s) encontrada(s)`,
                    data: { step: 'validation', progress: 10, leagues: leagues.length }
                }
            } as MessageEvent);

            // Get matches to seed
            const matchWhere: any = matchIds?.length
                ? { id: { in: matchIds } }
                : {
                    matchDate: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) },
                    OR: [{ status: 'NS' }, { status: null }],
                  };

            const matches = await this.prisma.match.findMany({
                where: matchWhere,
                select: { id: true, homeTeamId: true, awayTeamId: true },
                take: 200,
            });

            if (matches.length === 0) {
                throw new BadRequestException('No se encontraron partidos para semillar');
            }

            subject.next({
                data: {
                    type: 'progress',
                    message: `${matches.length} partido(s) encontrado(s)`,
                    data: { step: 'validation', progress: 20, matches: matches.length }
                }
            } as MessageEvent);

            // Score generator based on strategy
            const generateScores = (): { home: number; away: number } => {
                switch (strategy) {
                    case PredictionStrategy.CONSERVATIVE:
                        const conservativeScores = [0, 0, 0, 1, 1, 1, 1, 2];
                        const home = conservativeScores[Math.floor(Math.random() * conservativeScores.length)];
                        const away = Math.random() < 0.6 ? home : conservativeScores[Math.floor(Math.random() * conservativeScores.length)];
                        return { home, away };

                    case PredictionStrategy.HOME_BIAS:
                        const homeScore = [1, 1, 2, 2, 2, 3, 3, 4][Math.floor(Math.random() * 8)];
                        const awayScore = [0, 0, 0, 1, 1, 2][Math.floor(Math.random() * 6)];
                        return { home: homeScore, away: awayScore };

                    case PredictionStrategy.REALISTIC:
                        const rand = Math.random();
                        if (rand < 0.4) {
                            const score = [0, 1, 1, 2][Math.floor(Math.random() * 4)];
                            return { home: score, away: score };
                        } else if (rand < 0.7) {
                            return { home: [1, 2, 2, 3][Math.floor(Math.random() * 4)], away: [0, 0, 1, 1][Math.floor(Math.random() * 4)] };
                        } else {
                            return { home: [0, 0, 1, 1][Math.floor(Math.random() * 4)], away: [1, 2, 2, 3][Math.floor(Math.random() * 4)] };
                        }

                    case PredictionStrategy.RANDOM:
                    default:
                        const scores = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 1, 0, 2, 1, 3];
                        return {
                            home: scores[Math.floor(Math.random() * scores.length)],
                            away: scores[Math.floor(Math.random() * scores.length)],
                        };
                }
            };

            let totalCreated = 0;
            let totalSkipped = 0;
            let totalPayments = 0;
            const leagueResults: Array<{ name: string; members: number; created: number; skipped: number; payments: number }> = [];

            const BATCH_SIZE = 50; // Process predictions in batches

            for (let leagueIndex = 0; leagueIndex < leagues.length; leagueIndex++) {
                const league = leagues[leagueIndex];
                
                subject.next({
                    data: {
                        type: 'league_start',
                        message: `Procesando polla: ${league.name}`,
                        data: { 
                            leagueIndex, 
                            totalLeagues: leagues.length,
                            leagueName: league.name,
                            progress: 20 + (leagueIndex / leagues.length) * 70
                        }
                    }
                } as MessageEvent);

                // Get all active members
                const members = await this.prisma.leagueMember.findMany({
                    where: { leagueId: league.id, status: 'ACTIVE' },
                    select: { userId: true },
                });

                if (members.length === 0) {
                    subject.next({
                        data: {
                            type: 'progress',
                            message: `Polla ${league.name} no tiene miembros activos, omitiendo...`,
                            data: { leagueName: league.name }
                        }
                    } as MessageEvent);
                    continue;
                }

                // Ensure SUPERADMIN is always included (add if not already a member)
                const superadminIsMember = members.some(m => m.userId === user.id);
                if (!superadminIsMember) {
                    // Add SUPERADMIN as member if not already
                    try {
                        await this.prisma.leagueMember.create({
                            data: {
                                userId: user.id,
                                leagueId: league.id,
                                status: 'ACTIVE',
                            },
                        });
                        members.push({ userId: user.id });
                        
                        subject.next({
                            data: {
                                type: 'progress',
                                message: `SUPERADMIN agregado a ${league.name}`,
                                data: { leagueName: league.name }
                            }
                        } as MessageEvent);
                    } catch (error) {
                        // Already exists, just add to the list
                        members.push({ userId: user.id });
                    }
                }

                let created = 0;
                let skipped = 0;
                let payments = 0;

                for (let memberIndex = 0; memberIndex < members.length; memberIndex++) {
                    const member = members[memberIndex];
                    
                    try {
                        // Batch predictions for this member
                        const predictionsToCreate: any[] = [];

                        for (const match of matches) {
                            try {
                                const existing = await this.prisma.prediction.findUnique({
                                    where: { 
                                        userId_matchId_leagueId: { 
                                            userId: member.userId, 
                                            matchId: match.id, 
                                            leagueId: league.id 
                                        } 
                                    },
                                    select: { id: true },
                                });

                                if (existing) {
                                    skipped++;
                                    continue;
                                }

                                const { home, away } = generateScores();
                                predictionsToCreate.push({
                                    userId: member.userId,
                                    matchId: match.id,
                                    leagueId: league.id,
                                    homeScore: home,
                                    awayScore: away,
                                    submittedAt: new Date(),
                                });
                            } catch (matchError) {
                                // Log individual match error but continue processing
                                console.error(`Error processing match ${match.id} for member ${member.userId}:`, matchError);
                                skipped++;
                            }
                        }

                        // Create predictions in batches with retry logic
                        for (let i = 0; i < predictionsToCreate.length; i += BATCH_SIZE) {
                            const batch = predictionsToCreate.slice(i, i + BATCH_SIZE);
                            let retries = 3;
                            let success = false;

                            while (retries > 0 && !success) {
                                try {
                                    await this.prisma.prediction.createMany({
                                        data: batch,
                                        skipDuplicates: true,
                                    });
                                    created += batch.length;
                                    success = true;
                                } catch (batchError) {
                                    retries--;
                                    if (retries === 0) {
                                        console.error(`Failed to create batch after 3 retries:`, batchError);
                                        skipped += batch.length;
                                    } else {
                                        // Wait before retry (exponential backoff)
                                        await new Promise(resolve => setTimeout(resolve, (3 - retries) * 1000));
                                    }
                                }
                            }
                        }

                        // Simulate payment if requested
                        if (simulatePayments && league.baseFee && league.baseFee > 0) {
                            try {
                                const existingPayment = await this.prisma.payment.findFirst({
                                    where: { userId: member.userId, leagueId: league.id, status: 'CONFIRMED' },
                                    select: { id: true },
                                });

                                if (!existingPayment) {
                                    await this.prisma.payment.create({
                                        data: {
                                            userId: member.userId,
                                            leagueId: league.id,
                                            amount: league.baseFee,
                                            method: 'GATEWAY',
                                            status: 'CONFIRMED',
                                            note: 'Pago simulado para testing (seed)',
                                        },
                                    });
                                    payments++;
                                }
                            } catch (paymentError) {
                                console.error(`Error creating payment for member ${member.userId}:`, paymentError);
                            }
                        }

                        // Send progress update every member
                        if ((memberIndex + 1) % 5 === 0 || memberIndex === members.length - 1) {
                            subject.next({
                                data: {
                                    type: 'member_complete',
                                    message: `${memberIndex + 1}/${members.length} miembros procesados en ${league.name}`,
                                    data: {
                                        leagueName: league.name,
                                        memberIndex: memberIndex + 1,
                                        totalMembers: members.length,
                                        created,
                                        skipped,
                                        progress: 20 + ((leagueIndex + (memberIndex + 1) / members.length) / leagues.length) * 70
                                    }
                                }
                            } as MessageEvent);
                        }
                    } catch (memberError) {
                        // Log member error but continue with next member
                        console.error(`Error processing member ${member.userId} in league ${league.name}:`, memberError);
                        subject.next({
                            data: {
                                type: 'progress',
                                message: `Error procesando miembro, continuando con el siguiente...`,
                                data: { 
                                    leagueName: league.name,
                                    warning: true 
                                }
                            }
                        } as MessageEvent);
                    }
                }

                totalCreated += created;
                totalSkipped += skipped;
                totalPayments += payments;
                leagueResults.push({ 
                    name: league.name, 
                    members: members.length, 
                    created, 
                    skipped, 
                    payments 
                });

                subject.next({
                    data: {
                        type: 'league_complete',
                        message: `Completada polla: ${league.name} (${created} creados, ${skipped} omitidos)`,
                        data: {
                            leagueName: league.name,
                            members: members.length,
                            created,
                            skipped,
                            payments,
                            progress: 20 + ((leagueIndex + 1) / leagues.length) * 70
                        }
                    }
                } as MessageEvent);
            }

            // Send final result
            subject.next({
                data: {
                    type: 'complete',
                    message: '¡Generación de pronósticos completada!',
                    data: {
                        strategy,
                        leagues: leagueResults,
                        matches: matches.length,
                        totalCreated,
                        totalSkipped,
                        totalPayments,
                        progress: 100
                    }
                }
            } as MessageEvent);

            subject.complete();

        } catch (error) {
            subject.next({
                data: {
                    type: 'error',
                    message: error.message || 'Error al generar pronósticos',
                    data: { error: error.toString() }
                }
            } as MessageEvent);
            subject.complete();
        }
    }
}
