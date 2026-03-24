import {
    Controller, Get, Post, Param, Query, UseGuards,
    ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ParticipationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminPaymentsService } from './admin-payments.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/payments')
export class AdminPaymentsController {
    constructor(private readonly adminPayments: AdminPaymentsService) {}

    @Get('obligations')
    @ApiOperation({ summary: 'List all participation obligations with filters' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'leagueId', required: false })
    @ApiQuery({ name: 'userId', required: false })
    @ApiQuery({ name: 'status', required: false, enum: ParticipationStatus })
    @ApiQuery({ name: 'category', required: false })
    async getObligations(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('leagueId') leagueId?: string,
        @Query('userId') userId?: string,
        @Query('status') status?: ParticipationStatus,
        @Query('category') category?: string,
    ) {
        return this.adminPayments.getObligations({ page, limit, leagueId, userId, status, category });
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get payment obligation statistics' })
    async getStats(@Query('leagueId') leagueId?: string) {
        return this.adminPayments.getObligationStats(leagueId);
    }

    @Post('obligations/:id/notify')
    @ApiOperation({ summary: 'Send payment reminder to a specific user for one obligation' })
    async notifyOne(@Param('id') id: string) {
        return this.adminPayments.sendPaymentReminder(id);
    }

    @Post('obligations/notify-bulk')
    @ApiOperation({ summary: 'Send payment reminders to all pending obligations' })
    async notifyBulk(@Query('leagueId') leagueId?: string) {
        return this.adminPayments.sendBulkReminders(leagueId);
    }

    @Post('obligations/expire-overdue')
    @ApiOperation({ summary: 'Manually trigger expiration of overdue obligations' })
    async expireOverdue() {
        return this.adminPayments.expireOverdueObligations();
    }
}
