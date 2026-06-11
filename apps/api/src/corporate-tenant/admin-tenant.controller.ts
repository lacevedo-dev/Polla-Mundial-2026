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
import { TenantProvisioningService } from './tenant-provisioning.service';
import {
    CreateTenantDto,
    UpdateTenantDto,
    UpdateTenantBrandingDto,
    UpdateTenantConfigDto,
    ProvisionTenantOwnerDto,
    ResendCredentialsDto,
} from './dto/tenant.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/tenants')
export class AdminTenantController {
    constructor(
        private readonly tenantService: TenantService,
        private readonly limitsService: TenantLimitsService,
        private readonly provisioningService: TenantProvisioningService,
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

    /**
     * Provisiona el OWNER (o ADMIN) inicial de la empresa con contraseña temporal.
     * Si el email ya existe como User, lo reutiliza y solo crea el TenantMember.
     * Si es nuevo: crea User con `mustChangePassword=true` y envía email con credenciales.
     */
    @Post(':id/provision-owner')
    @HttpCode(HttpStatus.OK)
    provisionOwner(@Param('id') id: string, @Body() dto: ProvisionTenantOwnerDto) {
        return this.provisioningService.provisionOwner(id, dto);
    }

    @Post(':id/resend-credentials')
    @HttpCode(HttpStatus.OK)
    resendCredentials(@Param('id') id: string, @Body() dto: ResendCredentialsDto) {
        return this.provisioningService.resendCredentials(id, dto);
    }
}
