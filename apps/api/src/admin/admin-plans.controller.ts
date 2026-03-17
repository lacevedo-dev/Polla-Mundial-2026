import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

const PLAN_DEFAULTS = {
    FREE: {
        maxLeagues: 1,
        maxParticipants: 10,
        features: ['Predicciones básicas', 'Clasificación', 'Acceso a ligas públicas'],
        price: 0,
        siCredits: 3,
    },
    GOLD: {
        maxLeagues: 5,
        maxParticipants: 50,
        features: ['Todo lo de FREE', 'Múltiples ligas', 'Estadísticas avanzadas', 'Soporte prioritario'],
        price: 9900,
        siCredits: 30,
    },
    DIAMOND: {
        maxLeagues: -1,
        maxParticipants: -1,
        features: ['Todo lo de GOLD', 'Ligas ilimitadas', 'Participantes ilimitados', 'Personalización avanzada', 'API access'],
        price: 29900,
        siCredits: 100,
    },
};

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/plans')
export class AdminPlansController {
    constructor(private readonly adminService: AdminService) {}

    @Get()
    @ApiOperation({ summary: 'Get all plan configurations' })
    async getPlans() {
        const configs = await this.adminService.getAllSystemConfigs();
        const planConfigs: Record<string, any> = {};

        for (const plan of ['FREE', 'GOLD', 'DIAMOND']) {
            const saved = configs.find((c) => c.key === `plan:${plan}`);
            planConfigs[plan] = saved ? saved.value : PLAN_DEFAULTS[plan as keyof typeof PLAN_DEFAULTS];
        }

        return planConfigs;
    }

    @Patch(':planName')
    @ApiOperation({ summary: 'Update plan configuration' })
    async updatePlan(@Param('planName') planName: string, @Body() dto: any) {
        const validPlans = ['FREE', 'GOLD', 'DIAMOND'];
        if (!validPlans.includes(planName.toUpperCase())) {
            return { error: 'Plan inválido' };
        }
        return this.adminService.setSystemConfig(`plan:${planName.toUpperCase()}`, dto);
    }
}
