import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin')
export class AdminStatsController {
    constructor(private readonly adminService: AdminService) {}

    @Get('stats')
    @ApiOperation({ summary: 'Get system-wide statistics' })
    async getSystemStats() {
        return this.adminService.getSystemStats();
    }
}
