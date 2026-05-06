import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantService } from './tenant.service';
import { TenantLimitsService } from './tenant-limits.service';
import {
    CreateTenantDto,
    UpdateTenantDto,
    UpdateTenantBrandingDto,
    UpdateTenantConfigDto,
} from './dto/tenant.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/tenants')
export class AdminTenantController {
    constructor(
        private readonly tenantService: TenantService,
        private readonly limitsService: TenantLimitsService,
    ) {}

    @Get()
    findAll() {
        return this.tenantService.findAll();
    }

    @Post()
    create(@Body() dto: CreateTenantDto) {
        return this.tenantService.create(dto);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.tenantService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
        return this.tenantService.update(id, dto);
    }

    @Patch(':id/branding')
    updateBranding(@Param('id') id: string, @Body() dto: UpdateTenantBrandingDto) {
        return this.tenantService.updateBranding(id, dto);
    }

    @Patch(':id/config')
    updateConfig(@Param('id') id: string, @Body() dto: UpdateTenantConfigDto) {
        return this.tenantService.updateConfig(id, dto);
    }

    @Get(':id/members')
    getMembers(@Param('id') id: string) {
        return this.tenantService.getMembers(id);
    }

    @Get(':id/stats')
    getStats(@Param('id') id: string) {
        return this.tenantService.getStats(id);
    }

    @Get(':id/usage')
    @HttpCode(HttpStatus.OK)
    getUsage(@Param('id') id: string) {
        return this.limitsService.getTenantUsage(id);
    }

    @Post(':id/suspend')
    @HttpCode(HttpStatus.OK)
    suspend(@Param('id') id: string) {
        return this.tenantService.update(id, { status: 'SUSPENDED' });
    }

    @Post(':id/activate')
    @HttpCode(HttpStatus.OK)
    activate(@Param('id') id: string) {
        return this.tenantService.update(id, { status: 'ACTIVE' });
    }
}
