import { Controller, Post, Get, Patch, UseGuards, HttpCode, HttpStatus, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ResetSystemDto } from './dto/reset-system.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/system')
export class AdminSystemController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly adminService: AdminService,
    ) {}

    @Post('reset-test-data')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ 
        summary: 'Reset test data - Selectively delete predictions, leagues, and related data',
        description: 'WARNING: This will delete selected data types. Use only for testing purposes.'
    })
    async resetTestData(@Body() options: ResetSystemDto = {}) {
        // Verificar que el modo prueba está habilitado
        const testModeConfig = await this.adminService.getSystemConfig('test_mode');
        const isTestModeEnabled = (testModeConfig?.value as { enabled?: boolean })?.enabled === true;
        
        if (!isTestModeEnabled) {
            throw new BadRequestException('El modo prueba no está habilitado. Actívalo desde la configuración del sistema.');
        }

        // Si no se especifica ninguna opción, reiniciar todo
        const shouldResetAll = !options.predictions && !options.participations && !options.leagues && !options.payments && !options.notifications;
        const resetOptions = {
            predictions: shouldResetAll || options.predictions,
            participations: shouldResetAll || options.participations,
            leagues: shouldResetAll || options.leagues,
            payments: shouldResetAll || options.payments,
            notifications: shouldResetAll || options.notifications,
        };

        try {
            // Eliminar datos en orden correcto para respetar las relaciones de la base de datos
            const deletedCounts = await this.prisma.$transaction(async (tx) => {
                const counts = {
                    predictions: 0,
                    participations: 0,
                    payments: 0,
                    orders: 0,
                    notifications: 0,
                    leagues: 0,
                };

                // 1. Eliminar predicciones (dependen de participaciones y partidos)
                if (resetOptions.predictions) {
                    const result = await tx.prediction.deleteMany({});
                    counts.predictions = result.count;
                }

                // 2. Eliminar participaciones (dependen de ligas y usuarios)
                if (resetOptions.participations) {
                    const result = await tx.participationObligation.deleteMany({});
                    counts.participations = result.count;
                }

                // 3. Eliminar pagos/órdenes (dependen de ligas y usuarios)
                if (resetOptions.payments) {
                    const paymentsResult = await tx.payment.deleteMany({});
                    const ordersResult = await tx.order.deleteMany({});
                    counts.payments = paymentsResult.count;
                    counts.orders = ordersResult.count;
                }

                // 4. Eliminar notificaciones relacionadas con ligas
                if (resetOptions.notifications) {
                    const result = await tx.notification.deleteMany({
                        where: {
                            OR: [
                                { type: 'INVITE_RECEIVED' },
                                { type: 'LEAGUE_UPDATE' },
                                { type: 'MATCH_REMINDER' },
                            ]
                        }
                    });
                    counts.notifications = result.count;
                }

                // 5. Eliminar ligas (debe ser último porque otras entidades dependen de él)
                if (resetOptions.leagues) {
                    const result = await tx.league.deleteMany({});
                    counts.leagues = result.count;
                }

                return counts;
            });

            const result = await this.prisma.$transaction(async (tx) => {
                const predictions = await tx.prediction.count();
                const participations = await tx.participationObligation.count();
                const leagues = await tx.league.count();
                const payments = await tx.payment.count();
                const orders = await tx.order.count();

                return {
                    predictions,
                    participations,
                    leagues,
                    payments,
                    orders,
                };
            });

            // Construir mensaje descriptivo
            const deletedItems: string[] = [];
            if (resetOptions.predictions && deletedCounts.predictions > 0) deletedItems.push(`${deletedCounts.predictions} predicciones`);
            if (resetOptions.participations && deletedCounts.participations > 0) deletedItems.push(`${deletedCounts.participations} participaciones`);
            if (resetOptions.leagues && deletedCounts.leagues > 0) deletedItems.push(`${deletedCounts.leagues} ligas`);
            if (resetOptions.payments && (deletedCounts.payments > 0 || deletedCounts.orders > 0)) {
                deletedItems.push(`${deletedCounts.payments} pagos y ${deletedCounts.orders} órdenes`);
            }
            if (resetOptions.notifications && deletedCounts.notifications > 0) deletedItems.push(`${deletedCounts.notifications} notificaciones`);

            const message = deletedItems.length > 0
                ? `Eliminados: ${deletedItems.join(', ')}`
                : 'No se encontraron datos para eliminar';

            return {
                success: true,
                message,
                deletedRecords: deletedCounts,
                resetOptions,
                remainingRecords: {
                    predictions: result.predictions,
                    participations: result.participations,
                    leagues: result.leagues,
                    payments: result.payments,
                    orders: result.orders,
                },
            };
        } catch (error) {
            throw new Error(`Error al reiniciar el sistema: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    @Get('test-mode')
    @ApiOperation({ 
        summary: 'Get test mode configuration',
        description: 'Returns whether test mode is enabled for the system'
    })
    async getTestMode() {
        const config = await this.adminService.getSystemConfig('test_mode');
        return {
            enabled: (config?.value as { enabled?: boolean })?.enabled === true,
            updatedAt: config?.updatedAt,
        };
    }

    @Patch('test-mode')
    @ApiOperation({ 
        summary: 'Update test mode configuration',
        description: 'Enable or disable test mode for the system'
    })
    async updateTestMode(@Body() body: { enabled: boolean }) {
        await this.adminService.setSystemConfig('test_mode', {
            enabled: body.enabled,
        });

        return {
            success: true,
            enabled: body.enabled,
            message: body.enabled 
                ? 'Modo prueba activado. Ahora puedes reiniciar el sistema las veces que necesites.'
                : 'Modo prueba desactivado. La función de reinicio está bloqueada.',
        };
    }
}
